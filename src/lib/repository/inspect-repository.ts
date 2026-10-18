import { buildRepositoryFacts } from "@/lib/analysis/build-repository-facts";
import { filterFiles } from "@/lib/analysis/filter-files";
import { fetchFiles } from "@/lib/github/get-file-content";
import { getRepositoryTree } from "@/lib/github/get-repository-tree";
import { parseRepositoryUrl } from "@/lib/github/validate-repository-url";

export async function inspectRepository(repositoryUrl: string, branch?: string) {
    const parsed = parseRepositoryUrl(repositoryUrl);
    const tree = await getRepositoryTree(parsed.owner, parsed.repo, branch);
    const filter = filterFiles(tree.entries);
    const fetched = await fetchFiles(parsed.owner, parsed.repo, filter.selected);

    const { facts, filesScanned, filesSkipped } = buildRepositoryFacts({ parsed, tree, filter, fetched });

    // Paths and blob SHAs only. File contents are never stored.
    const fileManifest = {
        selected: filter.selected.map((f) => ({ path: f.path, sha: f.sha, size: f.size })),
        treePaths: tree.entries.map((e) => e.path),
    };

    return { parsed, tree, facts, fileManifest, filesScanned, filesSkipped };
}