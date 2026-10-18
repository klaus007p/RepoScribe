import { describe, it, expect } from "vitest";
import { analyzePackage, detectPackageManager } from "@/lib/analysis/analyze-package";
import { detectStack } from "@/lib/analysis/detect-stack";

const raw = `{
  "name": "demo",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": { "next": "15.0.0", "react": "19.0.0" },
  "devDependencies": { "typescript": "5.0.0" }
}`;

describe("analyzePackage", () => {
    it("extracts scripts with line numbers", () => {
        const { facts } = analyzePackage("package.json", raw);
        expect(facts?.scripts).toEqual([
            { name: "dev", command: "next dev", line: 4 },
            { name: "build", command: "next build", line: 5 },
        ]);
    });

    it("returns a warning for invalid JSON", () => {
        const { facts, warnings } = analyzePackage("package.json", "{ nope");
        expect(facts).toBeNull();
        expect(warnings).toHaveLength(1);
    });
});

describe("detectPackageManager", () => {
    it("uses root lockfiles", () => {
        expect(detectPackageManager(["package.json", "pnpm-lock.yaml"])).toBe("pnpm");
    });
    it("prefers the packageManager field", () => {
        expect(detectPackageManager(["package-lock.json"], "yarn@4.0.0")).toBe("yarn");
    });
    it("ignores nested lockfiles", () => {
        expect(detectPackageManager(["apps/web/yarn.lock"])).toBeNull();
    });
});

describe("detectStack", () => {
    it("detects Next.js App Router and TypeScript", () => {
        const { facts } = analyzePackage("package.json", raw);
        const stack = detectStack([facts!], ["tsconfig.json", "src/app/api/x/route.ts"]);
        expect(stack.technologies).toEqual(expect.arrayContaining(["Next.js", "React", "TypeScript"]));
        expect(stack.frameworks.nextAppRouter).toBe(true);
    });

    it("warns when no supported framework is found", () => {
        const stack = detectStack(
            [{ filePath: "package.json", scripts: [], dependencies: [], devDependencies: [], engines: {}, workspaces: [] }],
            [],
        );
        expect(stack.warnings).toHaveLength(1);
    });
});