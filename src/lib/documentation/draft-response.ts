import type { DocumentationDraft } from "@prisma/client";
import { z } from "zod";
import { sourceReferenceSchema, type SourceReference } from "@/lib/validation/repository-schemas";

const referencesSchema = z.array(sourceReferenceSchema).catch([]);
const warningsSchema = z.array(z.string()).catch([]);

export function readReferences(value: unknown): SourceReference[] {
    return referencesSchema.parse(value);
}

export function buildDraftResponse(d: DocumentationDraft) {
    return {
        id: d.id,
        scanId: d.scanId,
        type: d.type,
        status: d.status,
        contentMarkdown: d.contentMarkdown,
        sourceReferences: readReferences(d.sourceReferences),
        warnings: warningsSchema.parse(d.warnings),
        model: d.provider
            ? { provider: d.provider, modelId: d.modelId, promptVersion: d.promptVersion }
            : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        expiresAt: d.expiresAt.toISOString(),
    };
}