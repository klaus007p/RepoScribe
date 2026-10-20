import { generateDocument, type DraftResult, type GenerationContext, type GenerationDeps } from "./generate-document";

export function generateReadme(ctx: GenerationContext, deps?: GenerationDeps): Promise<DraftResult> {
    return generateDocument("README", ctx, deps);
}