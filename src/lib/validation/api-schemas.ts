import { z } from "zod";
import { documentTypeSchema } from "./documentation-schemas";

export const MAX_MARKDOWN_CHARS = 100_000;
export const MAX_MARKDOWN_BODY_BYTES = 450_000;

const optionalInstructions = z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(1000).optional(),
);

export const generateBodySchema = z.object({
    scanId: z.string().min(1).max(64),
    documents: z
        .array(documentTypeSchema)
        .min(1)
        .max(2)
        .transform((d) => [...new Set(d)]),
    instructions: optionalInstructions,
    consentHostedInference: z.boolean().optional(),
});

export const patchDraftBodySchema = z.object({
    contentMarkdown: z
        .string()
        .max(MAX_MARKDOWN_CHARS)
        .refine((s) => s.trim().length > 0, "Document cannot be empty"),
});

export const regenerateBodySchema = z.object({
    headingPath: z.string().trim().min(1).max(200),
    instructions: optionalInstructions,
    consentHostedInference: z.boolean().optional(),
});