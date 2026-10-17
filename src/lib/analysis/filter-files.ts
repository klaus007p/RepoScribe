import { LIMITS } from "@/lib/config";
import type { TreeEntry } from "@/lib/github/get-repository-tree";

export type SkipReason =
    | "excluded_directory"
    | "secret_file"
    | "binary_or_asset"
    | "lockfile"
    | "not_relevant"
    | "too_large"
    | "over_file_limit"
    | "over_byte_limit";

export interface SelectedFile extends TreeEntry {
    score: number;
}

export interface FilterResult {
    selected: SelectedFile[];
    skipped: Record<SkipReason, number>;
    warnings: string[];
}

const EXCLUDED_DIRS = new Set([
    ".git", "node_modules", ".next", "dist", "build", "coverage", "out",
    ".turbo", ".vercel", ".yarn", ".pnpm-store", "vendor", ".cache",
]);
const LOCKFILES = new Set([
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock",
    "pnpm-lock.yaml", "bun.lockb", "bun.lock",
]);
const BINARY_RE =
    /\.(png|jpe?g|gif|webp|avif|ico|svg|pdf|zip|gz|tgz|tar|7z|woff2?|ttf|otf|eot|mp[34]|mov|webm|wasm|map|bin|exe|dll)$/i;
const SAFE_ENV_RE = /^\.env(\.[a-z]+)?\.(example|sample|template|dist)$/i;
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

function isSecretFile(name: string): boolean {
    const n = name.toLowerCase();
    if (n.startsWith(".env")) return !SAFE_ENV_RE.test(n);
    if (/\.(pem|key|p12|pfx|jks|keystore|crt|cer|kdbx)$/.test(n)) return true;
    if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(n)) return true;
    if ([".npmrc", ".yarnrc", ".yarnrc.yml", ".netrc", ".htpasswd", ".pypirc"].includes(n)) return true;
    return /(secret|credential|service-account|serviceaccount)/.test(n);
}

function relevanceScore(path: string): number | null {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const lower = path.toLowerCase();
    const depth = parts.length - 1;

    if (name === "package.json") return depth === 0 ? 100 : 90 - Math.min(depth, 5);
    if (/^route\.(ts|js|tsx|jsx|mjs)$/.test(name) && /(^|\/)app\//.test(lower)) return 98;
    if (/^readme(\.\w+)?$/i.test(name)) return depth === 0 ? 95 : 40;
    if (SAFE_ENV_RE.test(name)) return 85;
    if (/^next\.config\.(js|mjs|cjs|ts)$/.test(name) || /^middleware\.(ts|js)$/.test(name)) return 85;
    if (name === "tsconfig.json") return depth === 0 ? 80 : 30;
    if (lower.endsWith("prisma/schema.prisma")) return 80;
    if (/\.md$/i.test(name) && /(^|\/)docs?\//.test(lower) && lower.includes("api")) return 70;

    if (
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(lower) ||
        /(^|\/)(__tests__|tests?|e2e|fixtures)\//.test(lower) ||
        /\.d\.ts$/.test(lower)
    ) {
        return null;
    }
    if (SOURCE_RE.test(name)) {
        return /(route|router|api|controller|server|app|index|main)/.test(lower) ? 60 : 20;
    }
    return null;
}

export function filterFiles(entries: TreeEntry[]): FilterResult {
    const skipped: Record<SkipReason, number> = {
        excluded_directory: 0, secret_file: 0, binary_or_asset: 0, lockfile: 0,
        not_relevant: 0, too_large: 0, over_file_limit: 0, over_byte_limit: 0,
    };
    const candidates: SelectedFile[] = [];

    for (const e of entries) {
        const parts = e.path.split("/");
        const name = parts[parts.length - 1];

        if (parts.slice(0, -1).some((p) => EXCLUDED_DIRS.has(p))) { skipped.excluded_directory++; continue; }
        if (isSecretFile(name)) { skipped.secret_file++; continue; }
        if (LOCKFILES.has(name)) { skipped.lockfile++; continue; }
        if (BINARY_RE.test(name)) { skipped.binary_or_asset++; continue; }

        const score = relevanceScore(e.path);
        if (score === null) { skipped.not_relevant++; continue; }
        if (e.size > LIMITS.maxFileBytes) { skipped.too_large++; continue; }

        candidates.push({ ...e, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

    const selected: SelectedFile[] = [];
    let totalBytes = 0;
    for (const c of candidates) {
        if (selected.length >= LIMITS.maxFilesSelected) { skipped.over_file_limit++; continue; }
        if (totalBytes + c.size > LIMITS.maxTotalSourceBytes) { skipped.over_byte_limit++; continue; }
        selected.push(c);
        totalBytes += c.size;
    }

    const warnings: string[] = [];
    if (skipped.too_large)
        warnings.push(`${skipped.too_large} relevant file(s) exceeded ${LIMITS.maxFileBytes / 1024} KB and were skipped.`);
    if (skipped.over_file_limit)
        warnings.push(`${skipped.over_file_limit} relevant file(s) were skipped because the ${LIMITS.maxFilesSelected}-file limit was reached.`);
    if (skipped.over_byte_limit)
        warnings.push(`${skipped.over_byte_limit} relevant file(s) were skipped because the total size limit was reached.`);
    if (skipped.secret_file)
        warnings.push(`${skipped.secret_file} potentially sensitive file(s) were excluded from analysis.`);

    return { selected, skipped, warnings };
}