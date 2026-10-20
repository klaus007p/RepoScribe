import { getProvider, type DocumentationAIProvider, type GenerationMeta } from "@/lib/ai/provider";
import { loadExcerpts as defaultLoadExcerpts } from "@/lib/analysis/select-source-excerpts";
import type { DocumentType } from "@/lib/validation/documentation-schemas";
import type { FileManifest, RepositoryFacts, SourceReference } from "@/lib/validation/repository-schemas";
import { verifyDocumentation } from "./verify-documentation";

export interface GenerationContext {
    facts: RepositoryFacts;
    manifest: FileManifest;
    instructions?: string;
}
export interface GenerationDeps {
    provider?: DocumentationAIProvider;
    loadExcerpts?: typeof defaultLoadExcerpts;
}
export interface DraftResult {
    type: DocumentType;
    markdown: string;
    sourceReferences: SourceReference[];
    warnings: string[];
    meta: GenerationMeta | null; // null when no model was needed
}

export async function generateDocument(
    type: DocumentType,
    ctx: GenerationContext,
    deps: GenerationDeps = {},
): Promise<DraftResult> {
    const provider = deps.provider ?? getProvider();
    const load = deps.loadExcerpts ?? defaultLoadExcerpts;

    const excerpts = await load(ctx.facts, ctx.manifest, type);
    const raw = await provider.generateDocumentation({
        documentType: type,
        repositoryFacts: ctx.facts,
        sourceExcerpts: excerpts,
        userInstructions: ctx.instructions,
    });

    const verified = verifyDocumentation({
        documentType: type,
        markdown: raw.markdown,
        sourceReferences: raw.sourceReferences,
        warnings: raw.warnings,
        facts: ctx.facts,
        treePaths: ctx.manifest.treePaths,
    });
    return { type, ...verified, meta: raw.meta };
}