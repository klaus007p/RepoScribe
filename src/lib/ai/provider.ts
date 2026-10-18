import { getEnv } from "@/lib/env";
import type { DocumentationAIResult, DocumentType, SourceExcerpt } from "@/lib/validation/documentation-schemas";
import type { RepositoryFacts } from "@/lib/validation/repository-schemas";
import { OllamaProvider } from "./ollama-provider";
import { OpenRouterProvider } from "./openrouter-provider";

export interface DocumentationAIInput {
    documentType: DocumentType;
    repositoryFacts: RepositoryFacts;
    sourceExcerpts: SourceExcerpt[];
    existingMarkdown?: string;
    userInstructions?: string;
}

export interface GenerationMeta {
    provider: "OLLAMA" | "OPENROUTER";
    modelId: string;
    promptVersion: string;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
}

export type GeneratedDocumentation = DocumentationAIResult & { meta: GenerationMeta };

export interface DocumentationAIProvider {
    generateDocumentation(input: DocumentationAIInput): Promise<GeneratedDocumentation>;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatCompletion {
    text: string;
    inputTokens?: number;
    outputTokens?: number;
}

/** Provider and keys come only from server environment variables, never from a request. */
export function getProvider(): DocumentationAIProvider {
    const env = getEnv();
    if (env.AI_PROVIDER === "openrouter") {
        return new OpenRouterProvider({
            apiKey: env.OPENROUTER_API_KEY!,
            model: env.OPENROUTER_MODEL!,
            appUrl: env.APP_URL,
        });
    }
    return new OllamaProvider({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_MODEL });
}