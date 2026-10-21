import { getProvider } from "@/lib/ai/provider";
import { loadExcerpts as defaultLoadExcerpts } from "@/lib/analysis/select-source-excerpts";
import type { DocumentType } from "@/lib/validation/documentation-schemas";
import type { FileManifest, RepositoryFacts, SourceReference } from "@/lib/validation/repository-schemas";
import type { GenerationDeps } from "./generate-document";
import { findSection, normalizeSectionReplacement, replaceSection } from "./markdown-sections";
import { verifyDocumentation } from "./verify-documentation";

export async function regenerateSection(
    input: {
        type: DocumentType;
        markdown: string;
        headingPath: string;
        instructions?: string;
        existingReferences: SourceReference[];
        ctx: { facts: RepositoryFacts; manifest: FileManifest };
    },
    deps: GenerationDeps = {},
) {
    const { facts, manifest } = input.ctx;
    const range = findSection(input.markdown, input.headingPath);
    const lines = input.markdown.split(/\r?\n/);
    const sectionText = lines.slice(range.start, range.end).join("\n").trim();

    const provider = deps.provider ?? getProvider();
    const load = deps.loadExcerpts ?? defaultLoadExcerpts;
    const excerpts = await load(facts, manifest, input.type);

    const raw = await provider.generateDocumentation({
        documentType: input.type,
        repositoryFacts: facts,
        sourceExcerpts: excerpts,
        existingMarkdown: sectionText,
        userInstructions: input.instructions,
        mode: "section",
    });

    const normalized = normalizeSectionReplacement(raw.markdown, range.heading, lines[range.start]);
    const merged = replaceSection(input.markdown, range, normalized.text);

    const verified = verifyDocumentation({
        documentType: input.type,
        markdown: merged,
        sourceReferences: [...input.existingReferences, ...raw.sourceReferences],
        warnings: [...normalized.notes, ...raw.warnings],
        facts,
        treePaths: manifest.treePaths,
    });

    return { ...verified, meta: raw.meta };
}