import { fetchFiles } from "@/lib/github/get-file-content";
import type { DocumentType, SourceExcerpt } from "@/lib/validation/documentation-schemas";
import type { FileManifest, RepositoryFacts } from "@/lib/validation/repository-schemas";
import type { SelectedFile } from "./filter-files";

export const EXCERPT_LIMITS = { maxFiles: 25, maxLinesPerFile: 150 } as const;

const ENV_EXAMPLE_RE = /(^|\/)\.env(\.[a-z]+)?\.(example|sample|template|dist)$/i;
const ENTRY_RE = /^(src\/)?(app\/(layout|page)\.(tsx|jsx|ts|js)|index\.(ts|js)|main\.(ts|js)|server\.(ts|js))$/;
const EXPRESS_ENTRY_RE = /(^|\/)(server|app|index|main)\.(ts|js|mjs|cjs)$/;

export function selectExcerptFiles(
    facts: RepositoryFacts,
    manifest: FileManifest,
    type: DocumentType,
): SelectedFile[] {
    const byPath = new Map(manifest.selected.map((f) => [f.path, f]));
    const picked: string[] = [];
    const add = (p?: string | null) => {
        if (p && byPath.has(p) && !picked.includes(p)) picked.push(p);
    };

    if (type === "API") {
        facts.routes.forEach((r) => add(r.filePath));
        facts.middlewareFiles.forEach(add);
        if (facts.stack.frameworks.express) {
            manifest.selected.forEach((f) => EXPRESS_ENTRY_RE.test(f.path) && add(f.path));
        }
        add(facts.packages[0]?.filePath);
    } else {
        facts.packages.slice(0, 3).forEach((p) => add(p.filePath));
        add(facts.existingDocs.readmePath);
        manifest.selected.forEach((f) => ENV_EXAMPLE_RE.test(f.path) && add(f.path));
        facts.importantFiles.forEach((f) => add(f.path));
        manifest.selected.forEach((f) => ENTRY_RE.test(f.path) && add(f.path));
    }

    return picked.slice(0, EXCERPT_LIMITS.maxFiles).map((p) => ({ ...byPath.get(p)!, score: 0 }));
}

/** Files are fetched by blob SHA from the pinned tree, redacted, truncated and never stored. */
export async function loadExcerpts(
    facts: RepositoryFacts,
    manifest: FileManifest,
    type: DocumentType,
): Promise<SourceExcerpt[]> {
    const files = selectExcerptFiles(facts, manifest, type);
    if (files.length === 0) return [];

    const { files: fetched } = await fetchFiles(facts.repository.owner, facts.repository.name, files);
    const order = new Map(files.map((f, i) => [f.path, i]));
    fetched.sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));

    return fetched.map((f) => {
        const kept = f.content.split(/\r?\n/).slice(0, EXCERPT_LIMITS.maxLinesPerFile);
        return { filePath: f.path, startLine: 1, endLine: kept.length, content: kept.join("\n") };
    });
}