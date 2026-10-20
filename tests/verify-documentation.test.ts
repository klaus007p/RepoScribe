import { describe, expect, it } from "vitest";
import { normalizeRoutePath, verifyDocumentation } from "@/lib/documentation/verify-documentation";
import type { RepositoryFacts } from "@/lib/validation/repository-schemas";
import { makeFacts } from "./fixtures/facts";

const route = (method: string, path: string, filePath: string, line: number) => ({
    framework: "nextjs-app-router" as const,
    method: method as "GET",
    path,
    pathParams: [],
    queryParams: [],
    validationSchemas: [],
    statusCodes: [200],
    authHints: [],
    filePath,
    line,
    certainty: "detected" as const,
    notes: [],
});

function facts(): RepositoryFacts {
    const f = makeFacts();
    f.packages = [
        {
            filePath: "package.json",
            scripts: [{ name: "dev", command: "next dev", line: 4 }],
            dependencies: [],
            devDependencies: [],
            engines: {},
            workspaces: [],
        },
    ];
    f.environmentVariables = [
        { name: "DATABASE_URL", usedIn: [{ filePath: "src/db.ts", line: 3 }] },
    ];
    f.routes = [route("GET", "/api/users/{id}", "src/app/api/users/[id]/route.ts", 5)];
    return f;
}

const run = (markdown: string, over: Partial<Parameters<typeof verifyDocumentation>[0]> = {}) =>
    verifyDocumentation({
        documentType: "README",
        markdown,
        sourceReferences: [],
        warnings: [],
        facts: facts(),
        treePaths: ["package.json", "src/db.ts", "src/app/api/users/[id]/route.ts"],
        ...over,
    });

describe("normalizeRoutePath", () => {
    it("treats all param styles as equal", () => {
        const a = normalizeRoutePath("/api/users/:id");
        expect(a).toBe(normalizeRoutePath("/api/users/{id}"));
        expect(a).toBe(normalizeRoutePath("/api/users/[id]/"));
        expect(normalizeRoutePath("/a/{...slug}")).toBe(normalizeRoutePath("/a/[...slug]"));
    });
});

describe("scripts and package manager", () => {
    it("flags hallucinated scripts and attaches a line reference for real ones", () => {
        const r = run("Run `npm run dev` or `npm run deploy`.");
        expect(r.warnings.join("\n")).toMatch(/Script "deploy" is documented but does not exist/);
        expect(r.warnings.join("\n")).not.toMatch(/Script "dev"/);
        expect(r.sourceReferences).toContainEqual({
            filePath: "package.json",
            startLine: 4,
            endLine: 4,
            claim: 'Script "dev" is defined',
        });
    });

    it("flags a package manager mismatch", () => {
        expect(run("Install with `pnpm install`.").warnings.join("\n")).toMatch(/uses pnpm, but the repository appears to use npm/);
    });
});

describe("routes", () => {
    it("flags routes that do not exist and passes real ones in tables", () => {
        const r = run("| GET | /api/users/:id |\n### GET /api/ghost", { documentType: "API" });
        const text = r.warnings.join("\n");
        expect(text).toMatch(/GET \/api\/ghost was not found/);
        expect(text).not.toMatch(/users/);
        expect(r.sourceReferences.some((x) => x.claim === "Route GET /api/users/{id}")).toBe(true);
    });

    it("flags wrong methods", () => {
        expect(run("POST /api/users/{id}", { documentType: "API" }).warnings.join("\n")).toMatch(/with method\(s\) GET, not POST/);
    });

    it("warns when detected routes are missing from an API document", () => {
        expect(run("# API\nNothing here.", { documentType: "API" }).warnings.join("\n")).toMatch(/1 detected route\(s\) are missing/);
    });
});

describe("env vars, paths, references", () => {
    it("flags unknown env vars but accepts known ones, including in code blocks", () => {
        const r = run("Set `DATABASE_URL` and `STRIPE_SECRET`.\n```\nDATABASE_URL=\nAPI_TOKEN=\n```");
        const text = r.warnings.join("\n");
        expect(text).toMatch(/STRIPE_SECRET/);
        expect(text).toMatch(/API_TOKEN/);
        expect(text).not.toMatch(/DATABASE_URL is documented/);
    });

    it("flags missing files but ignores .env and aliases", () => {
        const r = run("See `src/db.ts`, `src/nope.ts`, `.env.local` and `@/lib/x.ts`.");
        const text = r.warnings.join("\n");
        expect(text).toMatch(/src\/nope\.ts/);
        expect(text).not.toMatch(/src\/db\.ts/);
        expect(text).not.toMatch(/\.env\.local/);
        expect(text).not.toMatch(/lib\/x\.ts/);
    });

    it("drops references to unknown files", () => {
        const r = run("Hello", {
            sourceReferences: [
                { filePath: "package.json", claim: "ok" },
                { filePath: "ghost.ts", claim: "bad" },
            ],
        });
        expect(r.sourceReferences.map((x) => x.filePath)).toEqual(["package.json"]);
        expect(r.warnings.join("\n")).toMatch(/1 source reference\(s\)/);
    });
});

describe("sanitizing", () => {
    it("removes scripts outside code fences but keeps them inside", () => {
        const r = run("Hi <script>alert(1)</script>\n```html\n<script src=\"a.js\"></script>\n```");
        expect(r.markdown).not.toContain("alert(1)");
        expect(r.markdown).toContain('<script src="a.js"></script>');
    });

    it("redacts secrets in the output", () => {
        const token = "ghp_" + "a".repeat(36);
        const r = run(`Token: ${token}`);
        expect(r.markdown).not.toContain(token);
        expect(r.warnings.join("\n")).toMatch(/redacted/);
    });

    it("warns about unverified authentication claims", () => {
        expect(run("This endpoint requires a bearer token.").warnings.join("\n")).toMatch(/no authentication code was detected/);
    });
});