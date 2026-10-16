import { LIMITS } from "@/lib/config";
import { AppError } from "@/lib/http/errors";
import { githubFetch, encodeRef } from "./client";

interface RepoResponse {
    private: boolean;
    default_branch: string;
}
interface CommitResponse {
    sha: string;
    commit: { tree: { sha: string } };
}
interface TreeResponse {
    sha: string;
    truncated: boolean;
    tree: { path: string; type: "blob" | "tree" | "commit"; sha: string; size?: number }[];
}

export interface TreeEntry {
    path: string;
    sha: string;
    size: number;
}

export interface RepositoryTree {
    defaultBranch: string;
    resolvedRef: string;
    commitSha: string;
    treeSha: string;
    entries: TreeEntry[];
    truncated: boolean;
    warnings: string[];
}

export async function getRepositoryTree(
    owner: string,
    repo: string,
    requestedRef?: string,
): Promise<RepositoryTree> {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const warnings: string[] = [];

    const meta = await githubFetch<RepoResponse>(base);
    if (meta.private) {
        throw new AppError("NOT_FOUND", 404, "Only public repositories are supported.");
    }

    const resolvedRef = requestedRef ?? meta.default_branch;
    const commit = await githubFetch<CommitResponse>(`${base}/commits/${encodeRef(resolvedRef)}`);
    const treeSha = commit.commit.tree.sha;

    const tree = await githubFetch<TreeResponse>(`${base}/git/trees/${treeSha}?recursive=1`);

    if (tree.truncated) {
        warnings.push("GitHub truncated the repository tree. The scan is incomplete.");
    }

    let entries: TreeEntry[] = tree.tree
        .filter((e) => e.type === "blob")
        .map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }));

    if (entries.length > LIMITS.maxTreeEntries) {
        warnings.push(
            `Repository has ${entries.length} files; only the first ${LIMITS.maxTreeEntries} were considered.`,
        );
        entries = entries.slice(0, LIMITS.maxTreeEntries);
    }

    return {
        defaultBranch: meta.default_branch,
        resolvedRef,
        commitSha: commit.sha,
        treeSha,
        entries,
        truncated: tree.truncated,
        warnings,
    };
}