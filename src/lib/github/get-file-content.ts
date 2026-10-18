import { AppError } from "@/lib/http/error";
import { redactSecrets } from "@/lib/security/redact-secrets";
import type { SelectedFile } from "@/lib/analysis/filter-files";
import { githubFetch } from "./client";

interface BlobResponse {
    content: string;
    encoding: string;
    size: number;
}

export interface FetchedFile {
    path: string;
    sha: string;
    size: number;
    content: string;
    redactions: number;
}

export interface FetchFilesResult {
    files: FetchedFile[];
    failed: string[];
    warnings: string[];
}

const SHA_RE = /^[0-9a-f]{40,64}$/;

async function getBlobText(owner: string, repo: string, sha: string): Promise<string | null> {
    if (!SHA_RE.test(sha)) throw new AppError("INTERNAL_ERROR", 500, "Invalid blob identifier.");
    const blob = await githubFetch<BlobResponse>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${sha}`,
    );
    if (blob.encoding !== "base64") return null;
    const text = Buffer.from(blob.content, "base64").toString("utf8");
    return text.includes("\u0000") ? null : text; // binary
}

export async function fetchFiles(
    owner: string,
    repo: string,
    files: SelectedFile[],
    concurrency = 8,
): Promise<FetchFilesResult> {
    const results: (FetchedFile | null)[] = new Array(files.length).fill(null);
    const failed: string[] = [];
    let next = 0;

    async function worker() {
        while (next < files.length) {
            const index = next++;
            const f = files[index];
            try {
                const text = await getBlobText(owner, repo, f.sha);
                if (text === null) {
                    failed.push(f.path);
                    continue;
                }
                const { text: safe, count } = redactSecrets(text);
                results[index] = { path: f.path, sha: f.sha, size: f.size, content: safe, redactions: count };
            } catch (err) {
                if (err instanceof AppError && err.code === "RATE_LIMITED") throw err;
                failed.push(f.path);
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

    const warnings: string[] = [];
    if (failed.length) warnings.push(`${failed.length} file(s) could not be read and were skipped.`);

    return {
        files: results.filter((r): r is FetchedFile => r !== null),
        failed,
        warnings,
    };
}