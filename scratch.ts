import "dotenv/config";
import { getRepositoryTree } from "@/lib/github/get-repository-tree";
import { filterFiles } from "@/lib/analysis/filter-files";
import { fetchFiles } from "@/lib/github/get-file-content";
import { analyzePackage, detectPackageManager, type PackageFacts } from "@/lib/analysis/analyze-package";
import { detectStack } from "@/lib/analysis/detect-stack";

async function main() {
    const [owner, repo] = ["vercel", "next-learn"];
    const tree = await getRepositoryTree(owner, repo);
    const filtered = filterFiles(tree.entries);
    console.log("selected:", filtered.selected.length, filtered.skipped, filtered.warnings);

    const fetched = await fetchFiles(owner, repo, filtered.selected.filter((f) => f.score >= 60));
    const pkgs = fetched.files
        .filter((f) => f.path.endsWith("package.json"))
        .map((f) => analyzePackage(f.path, f.content).facts)
        .filter((p): p is PackageFacts => p !== null);

    const paths = tree.entries.map((e) => e.path);
    console.log("package manager:", detectPackageManager(paths, pkgs[0]?.packageManagerField));
    console.log("stack:", detectStack(pkgs, paths));
    console.log("scripts:", pkgs[0]?.scripts);
}

main().catch(console.error);