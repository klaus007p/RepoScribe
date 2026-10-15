import { getEnv } from "@/lib/env";
import { LIMITS } from "@/lib/config";
import { AppError } from "@/lib/http/error";

const GITHUB_API = "https://api.github.com";

export async function githubFetch<T>(path: string): Promise<T> {
    if (!path.startsWith("/repos/")) {
        throw new AppError("INTERNAL_ERROR", 500, "Invalid GitHub API path.");
    }

    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "reposcribe",
    };
    const token = getEnv().GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
        res = await fetch(`${GITHUB_API}${path}`, {
            headers,
            signal: AbortSignal.timeout(LIMITS.githubTimeoutMs),
            cache: "no-store",
        });
    } catch {
        throw new AppError("PROVIDER_UNAVAILABLE", 503, "GitHub did not respond in time. Try again.", true);
    }

    if (res.ok) return (await res.json()) as T;

    if (res.status === 404) {
        throw new AppError(
            "NOT_FOUND",
            404,
            "Repository or branch not found. It may be private or misspelled.",
        );
    }
    if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get("x-ratelimit-remaining");
        if (remaining === "0" || res.status === 429) {
            throw new AppError("RATE_LIMITED", 429, "GitHub rate limit reached. Try again later.", true);
        }
        throw new AppError("NOT_FOUND", 404, "This repository is not accessible.");
    }
    if (res.status === 401) {
        throw new AppError("PROVIDER_UNAVAILABLE", 503, "GitHub authentication is misconfigured on the server.");
    }
    throw new AppError("PROVIDER_UNAVAILABLE", 503, "GitHub returned an unexpected error.", true);
}

export function encodeRef(ref: string): string {
    return ref.split("/").map(encodeURIComponent).join("/");
}