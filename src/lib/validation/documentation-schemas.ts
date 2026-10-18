import { z } from "zod";
import type { SourceReference } from "./repository-schemas";

export const documentTypeSchema = z.enum(["README", "API"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export interface SourceExcerpt {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
}

// What the model must return. Optional values are nullable so the schema also works in strict mode.
export const aiResultSchema = z.object({
    markdown: z.string().trim().min(1).max(100_000),
    sourceReferences: z
        .array(
            z.object({
                filePath: z.string().min(1).max(500),
                startLine: z.number().int().positive().nullish(),
                endLine: z.number().int().positive().nullish(),
                claim: z.string().max(500),
            }),
        )
        .max(100),
    warnings: z.array(z.string().max(500)).max(50),
});

export interface DocumentationAIResult {
    markdown: string;
    sourceReferences: SourceReference[];
    warnings: string[];
}

export function normalizeAiResult(raw: z.infer<typeof aiResultSchema>): DocumentationAIResult {
    return {
        markdown: raw.markdown,
        sourceReferences: raw.sourceReferences.map((r) => ({
            filePath: r.filePath,
            startLine: r.startLine ?? undefined,
            endLine: r.endLine ?? undefined,
            claim: r.claim,
        })),
        warnings: raw.warnings,
    };
}

// JSON Schema sent to providers that support structured output.
export const AI_RESULT_JSON_SCHEMA = {
    type: "object",
    properties: {
        markdown: { type: "string" },
        sourceReferences: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    filePath: { type: "string" },
                    startLine: { type: ["integer", "null"] },
                    endLine: { type: ["integer", "null"] },
                    claim: { type: "string" },
                },
                required: ["filePath", "startLine", "endLine", "claim"],
                additionalProperties: false,
            },
        },
        warnings: { type: "array", items: { type: "string" } },
    },
    required: ["markdown", "sourceReferences", "warnings"],
    additionalProperties: false,
} as const;