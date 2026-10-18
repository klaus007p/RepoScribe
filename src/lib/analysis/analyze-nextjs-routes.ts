import ts from "typescript";
import { analyzeHandlerNode, finalizeInsights, looksLikeAuth } from "./analyze-handler";
import { isExported, lineOf, parseSource } from "./ast-utils";
import type { PackageFacts } from "./analyze-package";
import type { DetectedRoute, HttpMethod, RouteParam, SourceFileInput } from "./route-types";

const METHODS = new Set<string>(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const ROUTE_FILE_RE = /(^|\/)route\.(ts|tsx|js|jsx|mjs)$/;

/** Directories of package.json files that depend on Next.js ("" = repository root). */
export function nextPackageDirs(packages: PackageFacts[]): string[] {
    return packages
        .filter((p) => p.dependencies.includes("next") || p.devDependencies.includes("next"))
        .map((p) => (p.filePath.includes("/") ? p.filePath.slice(0, p.filePath.lastIndexOf("/")) : ""));
}

export function detectPagesRouterApi(paths: string[]): string | null {
    const n = paths.filter((p) => /(^|\/)pages\/api\/.+\.(ts|tsx|js|jsx|mjs)$/.test(p)).length;
    return n
        ? `${n} Pages Router API file(s) (pages/api) were found and not analyzed. Only App Router route handlers are supported.`
        : null;
}

function appRelativePath(filePath: string, dirs: string[]): string | null {
    for (const dir of dirs) {
        const base = dir ? `${dir}/` : "";
        for (const root of [`${base}src/app/`, `${base}app/`]) {
            if (filePath.startsWith(root)) return filePath.slice(root.length);
        }
    }
    return null;
}

function toRoutePath(rel: string): { path: string; params: RouteParam[] } | null {
    const segs = rel.split("/").slice(0, -1); // drop route.ts
    const params: RouteParam[] = [];
    const out: string[] = [];

    for (const seg of segs) {
        if (seg.startsWith("_")) return null; // private folder, not routable
        if (/^\([^)]*\)$/.test(seg) || seg.startsWith("@")) continue; // route group / parallel slot

        let m = /^\[\[\.\.\.([^\]]+)\]\]$/.exec(seg);
        if (m) {
            params.push({ name: m[1], catchAll: true, optional: true });
            out.push(`{...${m[1]}?}`);
            continue;
        }
        m = /^\[\.\.\.([^\]]+)\]$/.exec(seg);
        if (m) {
            params.push({ name: m[1], catchAll: true, optional: false });
            out.push(`{...${m[1]}}`);
            continue;
        }
        m = /^\[([^\]]+)\]$/.exec(seg);
        if (m) {
            params.push({ name: m[1], catchAll: false, optional: false });
            out.push(`{${m[1]}}`);
            continue;
        }
        out.push(seg);
    }
    return { path: "/" + out.join("/"), params };
}

interface MethodExport {
    method: HttpMethod;
    node: ts.Node;
    line: number;
    notes: string[];
    partial: boolean;
    wrapper?: string;
}

function collectMethodExports(sf: ts.SourceFile): MethodExport[] {
    const found: MethodExport[] = [];
    const locals = new Map<string, ts.Node>();

    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.name) locals.set(st.name.text, st);
        if (ts.isVariableStatement(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && d.initializer) locals.set(d.name.text, d.initializer);
            }
        }
    }

    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.name && isExported(st) && METHODS.has(st.name.text)) {
            found.push({
                method: st.name.text as HttpMethod,
                node: st,
                line: lineOf(sf, st),
                notes: [],
                partial: false,
            });
        } else if (ts.isVariableStatement(st) && isExported(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && METHODS.has(d.name.text)) {
                    const init = d.initializer;
                    const notes: string[] = [];
                    let wrapper: string | undefined;
                    if (init && ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
                        wrapper = init.expression.text;
                        notes.push(`Handler is wrapped by \`${wrapper}()\`.`);
                    }
                    found.push({
                        method: d.name.text as HttpMethod,
                        node: init ?? d,
                        line: lineOf(sf, d),
                        notes,
                        partial: !init,
                        wrapper,
                    });
                } else if (ts.isObjectBindingPattern(d.name)) {
                    for (const el of d.name.elements) {
                        if (ts.isIdentifier(el.name) && METHODS.has(el.name.text)) {
                            found.push({
                                method: el.name.text as HttpMethod,
                                node: el,
                                line: lineOf(sf, el),
                                notes: [
                                    "Handler is destructured from another object (for example an auth library). Its behavior was not analyzed.",
                                ],
                                partial: true,
                            });
                        }
                    }
                }
            }
        } else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
            for (const el of st.exportClause.elements) {
                if (!METHODS.has(el.name.text)) continue;
                const local = (el.propertyName ?? el.name).text;
                if (st.moduleSpecifier) {
                    found.push({
                        method: el.name.text as HttpMethod,
                        node: el,
                        line: lineOf(sf, el),
                        notes: ["Re-exported from another module. The implementation was not analyzed."],
                        partial: true,
                    });
                } else {
                    const node = locals.get(local);
                    found.push({
                        method: el.name.text as HttpMethod,
                        node: node ?? el,
                        line: lineOf(sf, el),
                        notes: [],
                        partial: !node,
                    });
                }
            }
        }
    }
    return found;
}

export function analyzeNextjsRoutes(
    files: SourceFileInput[],
    packageDirs: string[],
): { routes: DetectedRoute[]; warnings: string[] } {
    const routes: DetectedRoute[] = [];
    const warnings: string[] = [];
    const dirs = [...new Set(packageDirs)];

    for (const f of files) {
        if (!ROUTE_FILE_RE.test(f.path)) continue;
        const rel = appRelativePath(f.path, dirs);
        if (rel === null) continue;
        const mapped = toRoutePath(rel);
        if (!mapped) continue;

        const sf = parseSource(f.path, f.content);
        const exports = collectMethodExports(sf);
        if (exports.length === 0) {
            warnings.push(`${f.path} has no recognized HTTP method exports.`);
            continue;
        }

        for (const e of exports) {
            const insights = analyzeHandlerNode(e.node);
            if (e.wrapper && looksLikeAuth(e.wrapper)) insights.authHints.add(`wrapped by ${e.wrapper}()`);
            routes.push({
                framework: "nextjs-app-router",
                method: e.method,
                path: mapped.path,
                pathParams: mapped.params,
                ...finalizeInsights(insights),
                filePath: f.path,
                line: e.line,
                certainty: e.partial ? "partial" : "detected",
                notes: e.notes,
            });
        }
    }

    routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    return { routes, warnings };
}