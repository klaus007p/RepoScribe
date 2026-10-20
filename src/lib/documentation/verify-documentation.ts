import { redactSecrets } from "@/lib/security/redact-secrets";
import type { DocumentType } from "@/lib/validation/documentation-schemas";
import type { RepositoryFacts, SourceReference } from "@/lib/validation/repository-schemas";

export interface VerificationInput {
    documentType: DocumentType;
    markdown: string;
    sourceReferences: SourceReference[];
    warnings: string[];
    facts: RepositoryFacts;
    treePaths: string[];
}
export interface VerificationResult {
    markdown: string;
    sourceReferences: SourceReference[];
    warnings: string[];
}

type FactRoute = RepositoryFacts["routes"][number];

const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
const ROUTE_MENTION_RE = new RegExp(
    `\\b(${METHODS})\\b[\\s|\`*]+(\\/[A-Za-z0-9_\\-./:{}\\[\\]?=&~%@]*)`,
    "g",
);
const SCRIPT_RE = /\b(npm|pnpm|yarn|bun)\s+run\s+([A-Za-z0-9:_\-.]+)/g;
const NPM_DIRECT_RE = /\bnpm\s+(test|start)\b/g;
const INSTALL_RE = /\b(npm|pnpm|yarn|bun)\s+(?:install|i|ci|add)\b/g;
const ENV_CODE_RE = /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g;
const ENV_ASSIGN_RE = /(?:^|\n)\s*([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)=/g;
const ENV_IGNORED = new Set(["NODE_ENV"]);
const CODE_SPAN_RE = /`([^`\s]+)`/g;
const AUTH_CLAIM_RE =
    /\b(requires?|protected by|needs?|secured by)\b[^.\n]{0,40}\b(auth\w*|bearer|token|login|jwt|session)\b/i;

export function normalizeRoutePath(p: string): string {
    let out = p.split("?")[0];
    out = out
        .replace(/\[\[\.\.\.[^\]]*\]\]/g, "{...}")
        .replace(/\[\.\.\.[^\]]*\]/g, "{...}")
        .replace(/\{\.\.\.[^}]*\}/g, "{...}")
        .replace(/\{[^}]*\}/g, "{}")
        .replace(/\[[^\]]*\]/g, "{}")
        .replace(/:[A-Za-z_][A-Za-z0-9_]*\??/g, "{}");
    if (out.length > 1) out = out.replace(/\/+$/, "");
    return out;
}

function sanitizeOutsideCode(markdown: string): { text: string; changed: boolean } {
    let changed = false;
    const parts = markdown.split(/(```[\s\S]*?```)/g).map((part, i) => {
        if (i % 2 === 1) return part; // fenced code stays untouched
        const next = part
            .replace(/<(script|iframe|style|object|embed)\b[\s\S]*?<\/\1\s*>/gi, "")
            .replace(/<\/?(script|iframe|style|object|embed)\b[^>]*>/gi, "")
            .replace(/\]\(\s*javascript:[^)]*\)/gi, "](#)")
            .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
        if (next !== part) changed = true;
        return next;
    });
    return { text: parts.join(""), changed };
}

export function verifyDocumentation(input: VerificationInput): VerificationResult {
    const { documentType, facts } = input;
    const warnings: string[] = [];
    const derivedRefs: SourceReference[] = [];

    // 1. Sanitize and redact
    const sanitized = sanitizeOutsideCode(input.markdown);
    if (sanitized.changed) warnings.push("Unsafe HTML (scripts, iframes or event handlers) was removed from the document.");
    const redacted = redactSecrets(sanitized.text);
    if (redacted.count > 0) warnings.push(`${redacted.count} secret-like value(s) were redacted from the generated text.`);
    const markdown = redacted.text;

    // 2. Scripts
    const scripts = new Map<string, { filePath: string; line?: number }>();
    for (const p of facts.packages) {
        for (const s of p.scripts) if (!scripts.has(s.name)) scripts.set(s.name, { filePath: p.filePath, line: s.line });
    }
    const checkedScripts = new Set<string>();
    const checkScript = (name: string) => {
        if (checkedScripts.has(name)) return;
        checkedScripts.add(name);
        const found = scripts.get(name);
        if (!found) {
            warnings.push(`Script "${name}" is documented but does not exist in any package.json.`);
            return;
        }
        derivedRefs.push({
            filePath: found.filePath,
            startLine: found.line,
            endLine: found.line,
            claim: `Script "${name}" is defined`,
        });
    };
    for (const m of markdown.matchAll(SCRIPT_RE)) checkScript(m[2]);
    for (const m of markdown.matchAll(NPM_DIRECT_RE)) checkScript(m[1]);

    // 3. Package manager
    const usedManagers = new Set<string>();
    for (const m of markdown.matchAll(SCRIPT_RE)) usedManagers.add(m[1]);
    for (const m of markdown.matchAll(INSTALL_RE)) usedManagers.add(m[1]);
    const detected = facts.stack.packageManager;
    if (usedManagers.size > 0) {
        if (detected) {
            for (const m of usedManagers) {
                if (m !== detected) warnings.push(`The document uses ${m}, but the repository appears to use ${detected}.`);
            }
        } else {
            warnings.push("The package manager could not be determined, so the install and run commands are unverified.");
        }
    }

    // 4. Routes
    const byPath = new Map<string, FactRoute[]>();
    for (const r of facts.routes) {
        const key = normalizeRoutePath(r.path);
        byPath.set(key, [...(byPath.get(key) ?? []), r]);
    }
    const covered = new Set<FactRoute>();
    const seenMentions = new Set<string>();
    for (const m of markdown.matchAll(ROUTE_MENTION_RE)) {
        const method = m[1];
        const rawPath = m[2].replace(/[.,;:]+$/, "");
        const mention = `${method} ${rawPath}`;
        if (seenMentions.has(mention)) continue;
        seenMentions.add(mention);

        const candidates = byPath.get(normalizeRoutePath(rawPath));
        if (!candidates) {
            warnings.push(`Documented route ${mention} was not found in the source analysis.`);
            continue;
        }
        const match = candidates.find((r) => r.method === method || r.method === "ALL");
        if (!match) {
            warnings.push(
                `Route ${rawPath} exists in the source, but with method(s) ${candidates.map((r) => r.method).join(", ")}, not ${method}.`,
            );
            continue;
        }
        covered.add(match);
        derivedRefs.push({
            filePath: match.filePath,
            startLine: match.line,
            endLine: match.line,
            claim: `Route ${match.method} ${match.path}`,
        });
    }
    if (documentType === "API") {
        const missing = facts.routes.filter((r) => !covered.has(r));
        if (missing.length > 0) {
            const sample = missing.slice(0, 3).map((r) => `${r.method} ${r.path}`).join(", ");
            warnings.push(`${missing.length} detected route(s) are missing from this document (for example ${sample}).`);
        }
    }

    // 5. Environment variables
    const known = new Map(facts.environmentVariables.map((v) => [v.name, v]));
    const envMentions = new Set<string>();
    for (const m of markdown.matchAll(ENV_CODE_RE)) envMentions.add(m[1]);
    for (const m of markdown.matchAll(ENV_ASSIGN_RE)) envMentions.add(m[1]);
    for (const name of envMentions) {
        if (ENV_IGNORED.has(name)) continue;
        const v = known.get(name);
        if (!v) {
            warnings.push(`Environment variable ${name} is documented but was not found in the source or .env.example.`);
            continue;
        }
        const loc = v.documentedIn ?? v.usedIn[0];
        if (loc) {
            derivedRefs.push({ filePath: loc.filePath, startLine: loc.line, endLine: loc.line, claim: `Environment variable ${name}` });
        }
    }

    // 6. File paths
    const treeSet = new Set(input.treePaths);
    const treeComplete = !facts.completeness.treeTruncated;
    if (treeComplete) {
        const missing = new Set<string>();
        for (const m of markdown.matchAll(CODE_SPAN_RE)) {
            const token = m[1].replace(/^\.\//, "");
            if (!token.includes("/") || !/\.[A-Za-z0-9]{1,6}$/.test(token)) continue;
            if (/^(https?:|\/|~|@\/)/.test(token) || /[{}<>*:]/.test(token)) continue;
            if (!treeSet.has(token)) missing.add(token);
        }
        for (const p of missing) warnings.push(`File path ${p} is mentioned but does not exist in the repository.`);
    }

    // 7. Authentication claims
    if (AUTH_CLAIM_RE.test(markdown)) {
        const anyHints = facts.routes.some((r) => r.authHints.length > 0) || facts.middlewareFiles.length > 0;
        warnings.push(
            anyHints
                ? "Authentication is described. Auth detection is heuristic, so review these statements."
                : "Authentication is described, but no authentication code was detected. Review these statements.",
        );
    }

    // 8. Installation steps are never executed
    if (documentType === "README") {
        warnings.push("Installation and setup steps are derived from project files and were not executed. Review them before publishing.");
    }

    // 9. References: drop unknown files, add verified ones
    const refs: SourceReference[] = [];
    const seenRefs = new Set<string>();
    let dropped = 0;
    for (const r of input.sourceReferences) {
        const path = r.filePath.replace(/^\.\//, "");
        if (treeComplete && !treeSet.has(path)) {
            dropped++;
            continue;
        }
        const key = `${path}:${r.startLine ?? ""}:${r.claim}`;
        if (!seenRefs.has(key)) {
            seenRefs.add(key);
            refs.push({ ...r, filePath: path });
        }
    }
    if (dropped > 0) warnings.push(`${dropped} source reference(s) pointed to files that do not exist and were removed.`);
    for (const r of derivedRefs) {
        const key = `${r.filePath}:${r.startLine ?? ""}:${r.claim}`;
        if (!seenRefs.has(key)) {
            seenRefs.add(key);
            refs.push(r);
        }
    }

    return {
        markdown,
        sourceReferences: refs.slice(0, 150),
        warnings: [...new Set([...warnings, ...input.warnings])].slice(0, 50),
    };
}