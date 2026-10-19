import type { RepositoryFacts } from "@/lib/validation/repository-schemas";

export function makeFacts(): RepositoryFacts {
    return {
        repository: {
            owner: "o",
            name: "r",
            url: "https://github.com/o/r",
            branch: "main",
            commitSha: "a".repeat(40),
            defaultBranch: "main",
        },
        stack: {
            technologies: ["Next.js"],
            frameworks: { nextjs: true, nextAppRouter: true, express: false },
            packageManager: "npm",
        },
        packages: [],
        environmentVariables: [],
        routes: [],
        importantFiles: [],
        middlewareFiles: [],
        existingDocs: { readmePath: null, apiDocPaths: [] },
        completeness: {
            treeTruncated: false,
            filesInTree: 1,
            filesRead: 1,
            filesFailed: 0,
            skipped: {},
            redactionsApplied: 0,
        },
        warnings: [],
    };
}