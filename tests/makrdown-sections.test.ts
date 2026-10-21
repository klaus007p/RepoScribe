import { describe, expect, it } from "vitest";
import {
    closeOpenFence,
    findSection,
    normalizeSectionReplacement,
    parseHeadings,
    replaceSection,
} from "@/lib/documentation/markdown-sections";

const doc = [
    "# Title",
    "## Installation",
    "Install it.",
    "```bash",
    "# not a heading",
    "```",
    "### Environment Variables",
    "Old env text.",
    "## Usage",
    "Use it.",
    "",
].join("\n");

describe("parseHeadings", () => {
    it("ignores headings inside code fences and builds heading paths", () => {
        const h = parseHeadings(doc);
        expect(h.map((x) => x.title)).toEqual(["Title", "Installation", "Environment Variables", "Usage"]);
        expect(h[2].path).toEqual(["Title", "Installation", "Environment Variables"]);
    });
});

describe("findSection", () => {
    const usageLine = doc.split("\n").indexOf("## Usage");

    it("matches by path or by the last segment, case-insensitively", () => {
        expect(findSection(doc, "Installation > Environment Variables").heading.title).toBe("Environment Variables");
        expect(findSection(doc, "environment variables").heading.level).toBe(3);
    });

    it("includes subsections up to the next heading of the same or higher level", () => {
        expect(findSection(doc, "Installation").end).toBe(usageLine);
    });

    it("rejects unknown and ambiguous sections", () => {
        expect(() => findSection(doc, "Nope")).toThrow(/was not found/);
        const dup = "# A\n## Notes\n# B\n## Notes\n";
        expect(() => findSection(dup, "Notes")).toThrow(/matches 2/);
        expect(findSection(dup, "B > Notes").heading.line).toBe(3);
    });
});

describe("replaceSection", () => {
    it("replaces only the chosen section", () => {
        const range = findSection(doc, "Installation");
        const out = replaceSection(doc, range, "## Installation\nnew text");
        expect(out).toBe("# Title\n## Installation\nnew text\n\n## Usage\nUse it.\n");
    });
});

describe("normalizeSectionReplacement", () => {
    const { heading } = findSection(doc, "Installation");

    it("cuts content that spills into other sections", () => {
        const r = normalizeSectionReplacement("## Installation\nnew\n## Usage\nbad", heading, "## Installation");
        expect(r.text).toBe("## Installation\nnew");
        expect(r.notes).toHaveLength(1);
    });

    it("restores a missing or wrong-level heading", () => {
        expect(normalizeSectionReplacement("just text", heading, "## Installation").text).toMatch(/^## Installation\n\njust text/);
        const wrong = normalizeSectionReplacement("# Installation\nbody", heading, "## Installation");
        expect(wrong.text.startsWith("## Installation")).toBe(true);
        expect(wrong.notes).toHaveLength(1);
    });
});

describe("closeOpenFence", () => {
    it("closes an unterminated fence", () => {
        expect(closeOpenFence("a\n```js\ncode")).toBe("a\n```js\ncode\n```");
        expect(closeOpenFence("```\nx\n```")).toBe("```\nx\n```");
    });
});