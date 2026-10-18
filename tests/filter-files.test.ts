import { describe, it, expect } from "vitest";
import { filterFiles } from "@/lib/analysis/filter-files";

const sha = "a".repeat(40);
const e = (path: string, size = 100) => ({ path, sha, size });

describe("filterFiles", () => {
    const result = filterFiles([
        e("package.json"),
        e("package-lock.json"),
        e("node_modules/x/index.js"),
        e(".env"),
        e(".env.example"),
        e("certs/server.pem"),
        e("public/logo.png"),
        e("src/app/api/users/route.ts"),
        e("src/index.ts"),
        e("src/big.ts", 200 * 1024),
        e("src/index.test.ts"),
    ]);
    const paths = result.selected.map((f) => f.path);

    it("selects relevant files", () => {
        expect(paths).toEqual(
            expect.arrayContaining(["package.json", ".env.example", "src/app/api/users/route.ts", "src/index.ts"]),
        );
    });

    it("never selects secrets, lockfiles, vendored or oversized files", () => {
        expect(paths).not.toContain(".env");
        expect(paths).not.toContain("certs/server.pem");
        expect(paths).not.toContain("package-lock.json");
        expect(paths).not.toContain("src/big.ts");
    });

    it("counts skip reasons", () => {
        expect(result.skipped.secret_file).toBe(2);
        expect(result.skipped.excluded_directory).toBe(1);
        expect(result.skipped.binary_or_asset).toBe(1);
        expect(result.skipped.lockfile).toBe(1);
        expect(result.skipped.too_large).toBe(1);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});