import { describe, expect, it, vi } from "vitest";
import { regenerateSection } from "@/lib/documentation/regenerate-sections";
import type { DocumentationAIProvider } from "@/lib/ai/provider";
import { makeFacts } from "./fixtures/facts";

const doc = ["# Title", "## Installation", "Install it.", "## Usage", "Use it.", ""].join("\n");
const meta = { provider: "OLLAMA" as const, modelId: "m", promptVersion: "v1", durationMs: 1 };

describe("regenerateSection", () => {
    it("replaces one section, keeps the rest and discards spill-over", async () => {
        const provider: DocumentationAIProvider = {
            generateDocumentation: vi.fn().mockResolvedValue({
                markdown: "## Installation\nRun `npm run dev`.\n## Usage\nINJECTED",
                sourceReferences: [],
                warnings: [],
                meta,
            }),
        };
        const result = await regenerateSection(
            {
                type: "README",
                markdown: doc,
                headingPath: "Installation",
                instructions: "be brief",
                existingReferences: [],
                ctx: { facts: makeFacts(), manifest: { selected: [], treePaths: ["package.json"] } },
            },
            { provider, loadExcerpts: async () => [] },
        );

        expect(result.markdown).toContain("# Title");
        expect(result.markdown).toContain("## Usage\nUse it.");
        expect(result.markdown).not.toContain("INJECTED");
        expect(result.warnings.join("\n")).toMatch(/outside the requested section/);
        expect(result.warnings.join("\n")).toMatch(/Script "dev" is documented but does not exist/);

        const call = vi.mocked(provider.generateDocumentation).mock.calls[0][0];
        expect(call.mode).toBe("section");
        expect(call.existingMarkdown).toContain("Install it.");
        expect(call.existingMarkdown).not.toContain("Use it.");
        expect(call.userInstructions).toBe("be brief");
    });

    it("fails clearly for an unknown section without calling the model", async () => {
        const provider: DocumentationAIProvider = { generateDocumentation: vi.fn() };
        await expect(
            regenerateSection(
                {
                    type: "README",
                    markdown: doc,
                    headingPath: "Missing",
                    existingReferences: [],
                    ctx: { facts: makeFacts(), manifest: { selected: [], treePaths: [] } },
                },
                { provider },
            ),
        ).rejects.toMatchObject({ status: 404 });
        expect(provider.generateDocumentation).not.toHaveBeenCalled();
    });
});