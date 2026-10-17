import { describe, it, expect } from "vitest";
import { parseRepositoryUrl, branchSchema } from "@/lib/github/validate-repository-url";

describe("parseRepositoryUrl", () => {
    it("accepts canonical URLs", () => {
        expect(parseRepositoryUrl("https://github.com/vercel/next.js")).toEqual({
            owner: "vercel",
            repo: "next.js",
            url: "https://github.com/vercel/next.js",
        });
    });

    it("strips .git and trailing paths", () => {
        expect(parseRepositoryUrl("https://github.com/a/b.git").repo).toBe("b");
        expect(parseRepositoryUrl("https://github.com/a/b/tree/main").repo).toBe("b");
    });

    it.each([
        "http://github.com/a/b",
        "https://evil.com/a/b",
        "https://github.com.evil.com/a/b",
        "https://user:pw@github.com/a/b",
        "https://github.com/onlyowner",
        "https://github.com/a/..",
        "not a url",
        "",
    ])("rejects %s", (input) => {
        expect(() => parseRepositoryUrl(input)).toThrow();
    });
});

describe("branchSchema", () => {
    it("accepts normal refs", () => {
        expect(branchSchema.safeParse("feature/login").success).toBe(true);
        expect(branchSchema.safeParse("v1.2.0").success).toBe(true);
    });
    it("rejects traversal and junk", () => {
        expect(branchSchema.safeParse("../etc").success).toBe(false);
        expect(branchSchema.safeParse("a b").success).toBe(false);
    });
});