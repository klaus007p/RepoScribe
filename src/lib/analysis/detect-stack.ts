import type { PackageFacts } from "./analyze-package";

export interface StackDetection {
    technologies: string[];
    frameworks: { nextjs: boolean; nextAppRouter: boolean; express: boolean };
    warnings: string[];
}

export function detectStack(packages: PackageFacts[], treePaths: string[]): StackDetection {
    const deps = new Set(packages.flatMap((p) => [...p.dependencies, ...p.devDependencies]));
    const has = (name: string) => deps.has(name);

    const nextjs = has("next");
    const express = has("express");
    const nextAppRouter =
        nextjs &&
        treePaths.some(
            (p) =>
                /(^|\/)app\/.*route\.(ts|js|tsx|jsx|mjs)$/.test(p) ||
                /^(src\/)?app\/(layout|page)\.(tsx|jsx|ts|js)$/.test(p),
        );

    const technologies: string[] = [];
    if (nextjs) technologies.push("Next.js");
    if (express) technologies.push("Express");
    if (has("react")) technologies.push("React");
    if (has("typescript") || treePaths.includes("tsconfig.json")) technologies.push("TypeScript");
    if (treePaths.some((p) => /\.(js|jsx|mjs|cjs)$/.test(p))) technologies.push("JavaScript");
    if (has("prisma") || has("@prisma/client")) technologies.push("Prisma");
    if (has("tailwindcss")) technologies.push("Tailwind CSS");
    if (has("zod")) technologies.push("Zod");
    if (has("vitest")) technologies.push("Vitest");
    if (has("jest")) technologies.push("Jest");

    const warnings: string[] = [];
    if (packages.length === 0) {
        warnings.push("No package.json was found. This tool supports Node.js projects only.");
    } else if (!nextjs && !express) {
        warnings.push(
            "No supported framework detected. API route detection supports Next.js App Router and Express only.",
        );
    }

    return { technologies, frameworks: { nextjs, nextAppRouter, express }, warnings };
}