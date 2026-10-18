import { z } from "zod";

const packageSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    scripts: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    engines: z.record(z.string(), z.string()).optional(),
    packageManager: z.string().optional(),
    workspaces: z
        .union([z.array(z.string()), z.object({ packages: z.array(z.string()).optional() })])
        .optional(),
});

export interface PackageScript {
    name: string;
    command: string;
    line?: number;
}

export interface PackageFacts {
    filePath: string;
    name?: string;
    version?: string;
    description?: string;
    scripts: PackageScript[];
    dependencies: string[];
    devDependencies: string[];
    engines: Record<string, string>;
    packageManagerField?: string;
    workspaces: string[];
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

function lineOf(raw: string, needle: string, from = 0): number | undefined {
    const idx = raw.indexOf(needle, from);
    return idx === -1 ? undefined : raw.slice(0, idx).split("\n").length;
}

export function analyzePackage(
    filePath: string,
    raw: string,
): { facts: PackageFacts | null; warnings: string[] } {
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        return { facts: null, warnings: [`${filePath} is not valid JSON and was skipped.`] };
    }

    const parsed = packageSchema.safeParse(json);
    if (!parsed.success) {
        return { facts: null, warnings: [`${filePath} has an unexpected structure and was skipped.`] };
    }
    const p = parsed.data;

    const scriptsStart = Math.max(raw.indexOf('"scripts"'), 0);
    const scripts: PackageScript[] = Object.entries(p.scripts ?? {}).map(([name, command]) => ({
        name,
        command,
        line: lineOf(raw, JSON.stringify(name), scriptsStart),
    }));

    const workspaces = Array.isArray(p.workspaces) ? p.workspaces : (p.workspaces?.packages ?? []);

    return {
        facts: {
            filePath,
            name: p.name,
            version: p.version,
            description: p.description,
            scripts,
            dependencies: Object.keys(p.dependencies ?? {}),
            devDependencies: Object.keys(p.devDependencies ?? {}),
            engines: p.engines ?? {},
            packageManagerField: p.packageManager,
            workspaces,
        },
        warnings: [],
    };
}

export function detectPackageManager(
    treePaths: string[],
    packageManagerField?: string,
): PackageManager | null {
    const fromField = packageManagerField?.split("@")[0];
    if (fromField === "npm" || fromField === "pnpm" || fromField === "yarn" || fromField === "bun") {
        return fromField;
    }
    const root = new Set(treePaths.filter((p) => !p.includes("/")));
    if (root.has("pnpm-lock.yaml")) return "pnpm";
    if (root.has("yarn.lock")) return "yarn";
    if (root.has("bun.lockb") || root.has("bun.lock")) return "bun";
    if (root.has("package-lock.json") || root.has("npm-shrinkwrap.json")) return "npm";
    return null;
}