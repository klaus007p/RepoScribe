import { z } from "zod";
import { AI } from "@/lib/config";
import { AppError } from "@/lib/http/error";
import { AI_RESULT_JSON_SCHEMA } from "@/lib/validation/documentation-schemas";
import type { ChatCompletion, ChatMessage, DocumentationAIInput, DocumentationAIProvider, GeneratedDocumentation } from "./provider";
import { runGeneration } from "./run-generation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const responseSchema = z.object({
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
});

export class OpenRouterProvider implements DocumentationAIProvider {
    constructor(private config: { apiKey: string; model: string; appUrl: string }) { }

    generateDocumentation(input: DocumentationAIInput): Promise<GeneratedDocumentation> {
        return runGeneration((m) => this.chat(m), input, { provider: "OPENROUTER", modelId: this.config.model });
    }

    private async chat(messages: ChatMessage[]): Promise<ChatCompletion> {
        const { apiKey, model, appUrl } = this.config;
        let res: Response;
        try {
            res = await fetch(OPENROUTER_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": appUrl,
                    "X-Title": "RepoScribe",
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: AI.temperature,
                    max_tokens: AI.maxOutputTokens,
                    response_format: {
                        type: "json_schema",
                        json_schema: { name: "documentation_result", strict: true, schema: AI_RESULT_JSON_SCHEMA },
                    },
                    provider: { require_parameters: true },
                }),
                signal: AbortSignal.timeout(AI.openrouterTimeoutMs),
            });
        } catch (err) {
            const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
            throw new AppError(
                "PROVIDER_UNAVAILABLE",
                503,
                timedOut ? "The AI provider took too long to respond." : "Could not reach the AI provider.",
                true,
            );
        }

        if (res.status === 401 || res.status === 403) {
            throw new AppError("PROVIDER_UNAVAILABLE", 503, "The AI provider rejected the server's credentials.");
        }
        if (res.status === 402) {
            throw new AppError("PROVIDER_UNAVAILABLE", 503, "The AI provider account is out of credits.");
        }
        if (res.status === 429) {
            throw new AppError("RATE_LIMITED", 429, "The AI provider is rate limiting requests. Try again shortly.", true);
        }
        if (res.status === 404 || res.status === 400) {
            throw new AppError(
                "PROVIDER_UNAVAILABLE",
                503,
                "The configured model is unavailable or does not support structured output. Check OPENROUTER_MODEL.",
            );
        }
        if (!res.ok) {
            throw new AppError("PROVIDER_UNAVAILABLE", 503, "The AI provider returned an error.", true);
        }

        const data = responseSchema.safeParse(await res.json().catch(() => null));
        const text = data.success ? data.data.choices[0].message.content : null;
        if (!data.success || !text) {
            throw new AppError("AI_BAD_RESPONSE", 502, "The AI provider returned an unexpected response.", true);
        }
        return {
            text,
            inputTokens: data.data.usage?.prompt_tokens,
            outputTokens: data.data.usage?.completion_tokens,
        };
    }
}