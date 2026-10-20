import { z } from "zod";

export const sourceReferenceSchema = z.object({
    filePath: z.string(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    claim: z.string(),
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const detectedRouteSchema = z.object({
    framework: z.enum(["nextjs-app-router", "express"]),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "ALL"]),
    path: z.string(),
    pathParams: z.array(
        z.object({ name: z.string(), catchAll: z.boolean(), optional: z.boolean() }),
    ),
    queryParams: z.array(z.string()),
    validationSchemas: z.array(z.string()),
    statusCodes: z.array(z.number().int()),
    authHints: z.array(z.string()),
    filePath: z.string(),
    line: z.number().int(),
    certainty: z.enum(["detected", "partial"]),
    notes: z.array(z.string()),
});

export const packageFactsSchema = z.object({
    filePath: z.string(),
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    scripts: z.array(
        z.object({ name: z.string(), command: z.string(), line: z.number().int().optional() }),
    ),
    dependencies: z.array(z.string()),
    devDependencies: z.array(z.string()),
    engines: z.record(z.string(), z.string()),
    packageManagerField: z.string().optional(),
    workspaces: z.array(z.string()),
});

const locationSchema = z.object({ filePath: z.string(), line: z.number().int() });

export const envVarSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    documentedIn: locationSchema.optional(),
    usedIn: z.array(locationSchema),
});

export const repositoryFactsSchema = z.object({
    repository: z.object({
        owner: z.string(),
        name: z.string(),
        url: z.string(),
        branch: z.string(),
        commitSha: z.string(),
        defaultBranch: z.string(),
    }),
    stack: z.object({
        technologies: z.array(z.string()),
        frameworks: z.object({
            nextjs: z.boolean(),
            nextAppRouter: z.boolean(),
            express: z.boolean(),
        }),
        packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).nullable(),
    }),
    packages: z.array(packageFactsSchema),
    environmentVariables: z.array(envVarSchema),
    routes: z.array(detectedRouteSchema),
    importantFiles: z.array(z.object({ path: z.string(), purpose: z.string() })),
    middlewareFiles: z.array(z.string()),
    existingDocs: z.object({
        readmePath: z.string().nullable(),
        apiDocPaths: z.array(z.string()),
    }),
    completeness: z.object({
        treeTruncated: z.boolean(),
        filesInTree: z.number().int(),
        filesRead: z.number().int(),
        filesFailed: z.number().int(),
        skipped: z.record(z.string(), z.number()),
        redactionsApplied: z.number().int(),
    }),
    warnings: z.array(z.string()),
});

export const fileManifestSchema = z.object({
    selected: z.array(z.object({ path: z.string(), sha: z.string(), size: z.number().int() })),
    treePaths: z.array(z.string()),
});

export type FileManifest = z.infer<typeof fileManifestSchema>;

export type RepositoryFacts = z.infer<typeof repositoryFactsSchema>;