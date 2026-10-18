import "dotenv/config";
import { getRepositoryTree } from "@/lib/github/get-repository-tree";
import { filterFiles } from "@/lib/analysis/filter-files";
import { fetchFiles } from "@/lib/github/get-file-content";
import { analyzePackage, type PackageFacts } from "@/lib/analysis/analyze-package";
import { detectStack } from "@/lib/analysis/detect-stack";
import { analyzeNextjsRoutes, nextPackageDirs, detectPagesRouterApi } from "@/lib/analysis/analyze-nextjs-routes";
import { analyzeExpressRoutes } from "@/lib/analysis/analyze-express-routes";

async function main() {
    const [owner, repo] = process.argv.slice(2);
    if (!owner || !repo) throw new Error("usage: npx tsx scratch.ts <owner> <repo>");

    const tree = await getRepositoryTree(owner, repo);
    const filtered = filterFiles(tree.entries);
    const fetched = await fetchFiles(owner, repo, filtered.selected);

    const pkgs = fetched.files
        .filter((f) => f.path.endsWith("package.json"))
        .map((f) => analyzePackage(f.path, f.content).facts)
        .filter((p): p is PackageFacts => p !== null);
    const paths = tree.entries.map((e) => e.path);
    const stack = detectStack(pkgs, paths);

    const next = analyzeNextjsRoutes(fetched.files, nextPackageDirs(pkgs));
    const express = analyzeExpressRoutes(fetched.files);

    console.log("stack:", stack.technologies);
    console.log("pages router:", detectPagesRouterApi(paths));
    console.log("warnings:", [...next.warnings, ...express.warnings]);
    console.table(
        [...next.routes, ...express.routes].map((r) => ({
            method: r.method,
            path: r.path,
            file: `${r.filePath}:${r.line}`,
            status: r.statusCodes.join(","),
            auth: r.authHints.length,
            certainty: r.certainty,
        })),
    );
}

main().catch(console.error);