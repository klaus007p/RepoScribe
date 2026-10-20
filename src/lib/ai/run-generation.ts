import { AppError } from "@/lib/http/error";
import { aiResultSchema, normalizeAiResult, type DocumentationAIResult } from "@/lib/validation/documentation-schemas";
import { buildMessages, PROMPT_VERSION } from "./prompts";
import type {
    ChatCompletion,
    ChatMessage,
    DocumentationAIInput,
    GeneratedDocumentation,
    GenerationMeta,
} from "./provider";



export type ChatFn = (messages: ChatMessage[]) => Promise<ChatCompletion>;

export function extractJson(text: string): unknown {
    let t = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
    if(fence) t = fence[1];
    try {
        return JSON.parse(t);
    } catch {
        const start = t.indexOf("{");
        const end = t.lastIndexOf("}");
        if (start !== -1 && end > start) {
            try {
                return JSON.parse(t.slice(start, end + 1));
            } catch {
                // fall through
            }
        }
    }
    throw new Error("No JSON object found");
}


export function parseModelOutput(text: string): DocumentationAIResult {
    const bad = () =>
        new AppError("AI_BAD_RESPONSE", 502, "The AI model returned an invalid response. Try Again.", true);
    let json: unknown;
    try {
        json = extractJson(text);
    } catch {
        throw bad();
    }
    const parsed = aiResultSchema.safeParse(json);
    if(!parsed.success) throw bad();

    return normalizeAiResult(parsed.data);
}


export async function runGeneration(
    chat: ChatFn,
    input: DocumentationAIInput,
    provider: { provider: GenerationMeta["provider"]; modelId: string}, 
): Promise<GeneratedDocumentation> {
    const started = Date.now();
    const messages = buildMessages(input);
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
        const completion = await chat(messages);
        inputTokens += completion.inputTokens ?? 0;
        outputTokens += completion.outputTokens ?? 0;
        try {
            const result = parseModelOutput(completion.text);
            return {
                ...result,
                meta: {
                    provider: provider.provider,
                    modelId: provider.modelId,
                    promptVersion: PROMPT_VERSION,
                    durationMs: Date.now() - started,
                    inputTokens: inputTokens || undefined,
                    outputTokens: outputTokens || undefined,
                },
            };
        } catch (err) {
            if(!(err instanceof AppError) || err.code !== "AI_BAD_RESPONSE" || attempt === 1) throw err;
            messages.push(
                { role: "assistant", content: completion.text.slice(0, 2000) },
                {
                    role: "user",
                    content: 
                        'Your reply was not a valid JSON in the required shape. Reply again with ONLY the JSON object: {"markdown": string, "sourceReferences": [...], "warnings": [...]}.'
                },
            );
        }
    }
    throw new AppError("AI_BAD_RESPONSE", 502, "The AI model returned an invalid response.", true);
}