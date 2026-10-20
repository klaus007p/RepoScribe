import { generateDocument, type DraftResult, type GenerationContext, type GenerationDeps } from "./generate-document";

export async function generateApiDocs(ctx: GenerationContext, deps?: GenerationDeps): Promise<DraftResult> {
    if (ctx.facts.routes.length === 0) return emptyApiDocs(ctx);
    return generateDocument("API", ctx, deps);
}

function emptyApiDocs({ facts }: GenerationContext): DraftResult {
    const notes = facts.warnings.filter((w) => /route|Pages Router/i.test(w));
    const lines = [
        "# API Reference",
        "",
        "No API routes were detected in this repository.",
        "",
        "RepoScribe detects routes in Next.js App Router route handlers (`route.ts` or `route.js`) and in Express applications. Routes defined in other ways are not detected, so this does not prove the project has no API.",
    ];
    if (notes.length) lines.push("", "## Analysis notes", "", ...notes.map((n) => `- ${n}`));
    return {
        type: "API",
        markdown: lines.join("\n") + "\n",
        sourceReferences: [],
        warnings: ["No supported API routes were detected.", ...notes],
        meta: null,
    };
}