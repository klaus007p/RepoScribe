import { z } from "zod";
import { AppError } from "@/lib/http/error";

export interface ParsedRepository {
    owner: string;
    repo: string;
    url: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9._\/-]+$/;

export const branchSchema = z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(REF_RE, "Invalid branch or tag name")
    .refine((v) => !v.includes("..") && !v.startsWith("/") && !v.endsWith("/"), "Invalid branch or tag name");

export function parseRepositoryUrl(input: string): ParsedRepository {
    const invalid = () =>
        new AppError("INVALID_INPUT", 400, "Provide a valid public GitHub repository URL.");

    let url: URL;
    try {
        url = new URL(input.trim());
    } catch {
        throw invalid();
    }

    if (url.protocol !== "https:") throw invalid();
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") throw invalid();
    if (url.username || url.password || url.port) throw invalid();

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) throw invalid();

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");

    if (!OWNER_RE.test(owner)) throw invalid();
    if (!REPO_RE.test(repo) || repo === "." || repo === "..") throw invalid();

    return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}