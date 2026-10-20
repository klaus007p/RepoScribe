import { describe, expect, it, vi } from "vitest";
import { selectExcerptFiles } from "@/lib/analysis/select-source-excerpts";
import { generateApiDocs } from "@/lib/documentation/generate-api-docs";
import { generateReadme } from "@/lib/documentation/generate-readme";
import type { DocumentationAIProvider } from "@/lib/ai/provider";
import type { FileManifest } from "@/lib/validation/repository-schemas";
import { makeFacts } from "./fixtures/facts";

const sha = "a".repeat(40);
const manifest: FileManifest = {
    selected: ["package.json", "src/app/api/x/route.ts", "src/lib/other.ts", ".env.example"].map((path) => ({
        path,
        sha,
        size: 10,
    })),
    treePaths: ["package.json", "src/app/api/x/route.ts", "src/lib/other.ts", ".env.example"],
};

const meta = { provider: "OLLAMA" as const, modelId: "m", promptVersion: "v1", durationMs: 1 };
const mockProvider = (markdown: string): DocumentationAIProvider => ({
    generateDocumentation: vi.fn().mockResolvedValue({ markdown, sourceReferences: [], warnings: [], meta }),
});

describe("selectExcerptFiles", () => {
    it("selects route files for API and manifests for README", () => {
        const facts = makeFacts();
        facts.packages = [{ filePath: "package.json", scripts: [], dependencies: [], devDependencies: [], engines: {}, workspaces: [] }];
        facts.routes = [
            {
                framework: "nextjs-app-router", method: "GET", path: "/api/x", pathParams: [], queryParams: [],
                validationSchemas: [], statusCodes: [], authHints: [], filePath: "src/app/api/x/route.ts",
                line: 1, certainty: "detected", notes: [],
            },
        ];
        const api = selectExcerptFiles(facts, manifest, "API").map((f) => f.path);
        expect(api).toContain("src/app/api/x/route.ts");
        expect(api).not.toContain("src/lib/other.ts");

        const readme = selectExcerptFiles(facts, manifest, "README").map((f) => f.path);
        expect(readme).toEqual(expect.arrayContaining(["package.json", ".env.example"]));
    });

    it("never selects files outside the manifest", () => {
        const facts = makeFacts();
        facts.middlewareFiles = ["middleware.ts"];
        expect(selectExcerptFiles(facts, manifest, "API").map((f) => f.path)).not.toContain("middleware.ts");
    });
});

describe("generateApiDocs", () => {
    it("does not call the model when no routes were detected", async () => {
        const provider = mockProvider("should never be used");
        const draft = await generateApiDocs({ facts: makeFacts(), manifest }, { provider });
        expect(provider.generateDocumentation).not.toHaveBeenCalled();
        expect(draft.markdown).toContain("No API routes were detected");
        expect(draft.meta).toBeNull();
    });

    it("verifies model output against the facts", async () => {
        const facts = makeFacts();
        facts.routes = [
            {
                framework: "nextjs-app-router", method: "GET", path: "/api/x", pathParams: [], queryParams: [],
                validationSchemas: [], statusCodes: [200], authHints: [], filePath: "src/app/api/x/route.ts",
                line: 3, certainty: "detected", notes: [],
            },
        ];
        const provider = mockProvider("GET /api/x\nGET /api/invented");
        const draft = await generateApiDocs({ facts, manifest }, { provider, loadExcerpts: async () => [] });
        expect(draft.warnings.join("\n")).toMatch(/GET \/api\/invented was not found/);
        expect(draft.sourceReferences.some((r) => r.filePath === "src/app/api/x/route.ts" && r.startLine === 3)).toBe(true);
        expect(draft.meta?.modelId).toBe("m");
    });
});

describe("generateReadme", () => {
    it("passes instructions to the provider and always adds the review warning", async () => {
        const provider = mockProvider("# Title");
        const draft = await generateReadme(
            { facts: makeFacts(), manifest, instructions: "Keep it short" },
            { provider, loadExcerpts: async () => [] },
        );
        const input = vi.mocked(provider.generateDocumentation).mock.calls[0][0];
        expect(input.userInstructions).toBe("Keep it short");
        expect(draft.warnings.join("\n")).toMatch(/were not executed/);
    });
});