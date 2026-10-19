import { z } from "zod";
import { AI } from "@/lib/config";
import { AppError } from "@/lib/http/error";
import { AI_RESULT_JSON_SCHEMA } from "@/lib/validation/documentation-schemas";
import type { ChatCompletion, ChatMessage, DocumentationAIInput, DocumentationAIProvider, GeneratedDocumentation } from "./provider";
import { runGeneration } from "./run-generation";



const responseSchema = z.object({
    message: z.object({ content: z.string() }),
    prompt_eval_count: z.number().optional(),
    eval_count: z.number().optional(),
});


export class OllamaProvider implements DocumentationAIProvider {
    constructor(private config: { baseUrl: string; model: string }) { }

    generateDocumentation(input: DocumentationAIInput): Promise<GeneratedDocumentation> {
        return runGeneration((m) => this.chat(m), input, { provider: "OLLAMA", modelId: this.config.model });
    }

    private async chat(messages: ChatMessage[]): Promise<ChatCompletion> {
        const { baseUrl, model } = this.config;
        let res: Response;
        try {
            res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    format: AI_RESULT_JSON_SCHEMA,
                    options: {
                        temperature: AI.temperature,
                        num_ctx: AI.ollamaNumCtx,
                        num_predict: AI.maxOutputTokens,
                    },
                }),
                signal: AbortSignal.timeout(AI.ollamaTimeoutMs),
            });
        } catch (err) {
            const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
            throw new AppError(
                "PROVIDER_UNAVAILABLE",
                503,
                timeout
                    ? "The local model took too long to respond. Try a smaller model."
                    : "Could not reach Ollama. Check that it is running.",
                true,
            );
        }

        if (res.status === 404) {
            throw new AppError("PROVIDER_UNAVAILABLE", 503, `Model "${model}" is not installed. Run: ollama pull ${model}`);
        }

        if(!res.ok) {
            throw new AppError("PROVIDER_UNAVAILABLE", 500, "Ollama returned an error.", true);
        }

        const data = responseSchema.safeParse(await res.json().catch(() => null));
        if (!data.success) {
            throw new AppError ("AI_BAD_RESPONSE", 502, "Ollama returned an unexpected response. ", true);
        }

        return {
            text: data.data.message.content,
            inputTokens: data.data.prompt_eval_count,
            outputTokens: data.data.eval_count,
        };
    }
}

