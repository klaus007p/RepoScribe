import { describe, it, expect } from "vitest";
import { analyzeEnvironment } from "@/lib/analysis/analyze-environment";

const vars = analyzeEnvironment([
    {
        path: "src/a.ts",
        content: `const url = process.env.DATABASE_URL;
const k = process.env["API_KEY"];
const { PORT, HOST: h } = process.env;
process.env.NODE_ENV;`,
    },
    {
        path: ".env.example",
        content: `# Postgres connection string
DATABASE_URL=

PORT=3000 # server port
UNUSED=`,
    },
]);
const byName = Object.fromEntries(vars.map((v) => [v.name, v]));

describe("analyzeEnvironment", () => {
    it("finds names from all access styles and ignores NODE_ENV", () => {
        expect(vars.map((v) => v.name)).toEqual(["API_KEY", "DATABASE_URL", "HOST", "PORT", "UNUSED"]);
    });

    it("records usage locations", () => {
        expect(byName.DATABASE_URL.usedIn).toEqual([{ filePath: "src/a.ts", line: 1 }]);
        expect(byName.UNUSED.usedIn).toEqual([]);
    });

    it("reads descriptions from .env.example comments", () => {
        expect(byName.DATABASE_URL.description).toBe("Postgres connection string");
        expect(byName.DATABASE_URL.documentedIn).toEqual({ filePath: ".env.example", line: 2 });
        expect(byName.PORT.description).toBe("server port");
    });
});