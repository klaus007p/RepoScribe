import { AppError } from "@/lib/http/error";
import type { FetchFilesResult } from "@/lib/github/get-file-content";
import type { RepositoryTree } from "@/lib/github/get-repository-tree";
import type { ParsedRepository } from "@/lib/github/validate-repository-url";
import { repositoryFactsSchema, type RepositoryFacts } from "@/lib/validation/repository-schemas";
import { analyzeEnvironment } from "./analyze-environment";
import { analyzeExpressRoutes } from "./analyze-express-routes";
import { analyzeNextjsRoutes, detectPagesRouterApi, nextPackageDirs } from "./analyze-nextjs-routes";
import { analyzePackage, detectPackageManager, type PackageFacts } from "./analyze-package";
import { detectStack } from "./detect-stack";
import type { FilterResult } from "./filter-files";
import type { DetectedRoute, SourceFileInput } from "./route-types";

function purposeOf(path: string): string | null {
    const name = path.split("/").pop() ?? "";
    if (name === "package.json") return "Package manifest";
    if (/^readme/i.test(name)) return "Existing README";
    if (/^\.env/i.test(name)) return "Environment variable template";
    if (/^next\.config\./.test(name)) return "Next.js configuration";
    if (/^middleware\.(ts|js)$/.test(name)) return "Middleware";
    if (name === "tsconfig.json") return "TypeScript configuration";
    if (path.endsWith("prisma/schema.prisma")) return "Prisma schema";
    return null;
}

export function buildRepositoryFacts(input: {
    parsed: ParsedRepository;
    tree: RepositoryTree;
    filter: FilterResult;
    fetched: FetchFilesResult;
}): { facts: RepositoryFacts; filesScanned: number; filesSkipped: number } {
    const { parsed, tree, filter, fetched } = input;
    const warnings = [...tree.warnings, ...filter.warnings, ...fetched.warnings];
    const treePaths = tree.entries.map((e) => e.path);
    const sources: SourceFileInput[] = fetched.files.map((f) => ({ path: f.path, content: f.content }));

    const packages: PackageFacts[] = [];
    for (const f of fetched.files) {
        if (!/(^|\/)package\.json$/.test(f.path)) continue;
        const r = analyzePackage(f.path, f.content);
        if (r.facts) packages.push(r.facts);
        warnings.push(...r.warnings);
    }
    if (packages.length === 0) {
        throw new AppError(
            "UNPROCESSABLE_REPOSITORY",
            422,
            "No readable package.json was found. Version 1 supports Node.js (TypeScript/JavaScript) projects only.",
        );
    }

    const rootPackage = packages.find((p) => p.filePath === "package.json") ?? packages[0];
    const stack = detectStack(packages, treePaths);
    warnings.push(...stack.warnings);

    const routes: DetectedRoute[] = [];
    if (stack.frameworks.nextjs) {
        const r = analyzeNextjsRoutes(sources, nextPackageDirs(packages));
        routes.push(...r.routes);
        warnings.push(...r.warnings);
        const pages = detectPagesRouterApi(treePaths);
        if (pages) warnings.push(pages);
    }
    if (stack.frameworks.express) {
        const r = analyzeExpressRoutes(sources);
        routes.push(...r.routes);
        warnings.push(...r.warnings);
    }

    const importantFiles = fetched.files
        .map((f) => ({ path: f.path, purpose: purposeOf(f.path) }))
        .filter((f): f is { path: string; purpose: string } => f.purpose !== null)
        .slice(0, 40);

    const filesScanned = fetched.files.length;
    const filesSkipped =
        filter.skipped.secret_file +
        filter.skipped.too_large +
        filter.skipped.over_file_limit +
        filter.skipped.over_byte_limit +
        fetched.failed.length;

    const facts = repositoryFactsSchema.parse({
        repository: {
            owner: parsed.owner,
            name: parsed.repo,
            url: parsed.url,
            branch: tree.resolvedRef,
            commitSha: tree.commitSha,
            defaultBranch: tree.defaultBranch,
        },
        stack: {
            technologies: stack.technologies,
            frameworks: stack.frameworks,
            packageManager: detectPackageManager(treePaths, rootPackage.packageManagerField),
        },
        packages,
        environmentVariables: analyzeEnvironment(sources),
        routes,
        importantFiles,
        middlewareFiles: treePaths.filter((p) => /^(src\/)?middleware\.(ts|js)$/.test(p)),
        existingDocs: {
            readmePath: treePaths.find((p) => /^readme(\.(md|markdown|txt))?$/i.test(p)) ?? null,
            apiDocPaths: treePaths
                .filter((p) => /(^|\/)api\.md$/i.test(p) || /(^|\/)docs?\/.*api.*\.md$/i.test(p))
                .slice(0, 10),
        },
        completeness: {
            treeTruncated: tree.truncated,
            filesInTree: treePaths.length,
            filesRead: filesScanned,
            filesFailed: fetched.failed.length,
            skipped: filter.skipped,
            redactionsApplied: fetched.files.reduce((n, f) => n + f.redactions, 0),
        },
        warnings,
    });

    return { facts, filesScanned, filesSkipped };
}