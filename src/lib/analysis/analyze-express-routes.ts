import ts from "typescript";
import {
    analyzeHandlerNode,
    emptyInsights,
    finalizeInsights,
    looksLikeAuth,
    mergeInsights,
} from "./analyze-handler";
import { isExported, lineOf, parseSource, stringValue, walk } from "./ast-utils";
import type { DetectedRoute, HttpMethod, RouteParam, SourceFileInput } from "./route-types";

const HTTP = new Set(["get", "post", "put", "patch", "delete", "options", "head", "all"]);
const LOOSE_RECEIVER_RE = /^(app|router|routes)$|(router|routes)$/i;
const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const CALL_HINT_RE = /\.(get|post|put|patch|delete|all|use|route)\s*\(/;
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

interface RawRoute {
    receiver: string;
    method: HttpMethod;
    rawPath: string;
    path: string | null;
    line: number;
    handlers: ts.Expression[];
}
type Target = { kind: "local"; name: string } | { kind: "import"; local: string };
interface RawMount {
    receiver: string;
    rawPrefix: string;
    prefix: string | null;
    targets: Target[];
    hints: string[];
    candidates: Map<string, string>;
    line: number;
}
interface ImportInfo {
    source: string;
    imported: string;
}
interface FileInfo {
    path: string;
    sf: ts.SourceFile;
    apps: Set<string>;
    routers: Set<string>;
    imports: Map<string, ImportInfo>;
    defaultExport: string | null;
    namedExports: Map<string, string>;
    functions: Map<string, ts.Node>;
    routes: RawRoute[];
    mounts: RawMount[];
}
interface Edge {
    to: string;
    prefix: string | null;
    rawPrefix: string;
    hints: string[];
}
interface PrefixPart {
    prefix: string | null;
    raw: string;
}

function isRouterLike(info: FileInfo, name: string): boolean {
    if (info.apps.has(name) || info.routers.has(name)) return true;
    return !info.imports.has(name) && LOOSE_RECEIVER_RE.test(name);
}

function resolveRouteBase(
    expr: ts.Expression,
): { receiver: string; rawPath: string; path: string | null } | null {
    let cur: ts.Expression = expr;
    while (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
        const name = cur.expression.name.text;
        const inner = cur.expression.expression;
        if (name === "route") {
            if (!ts.isIdentifier(inner) || cur.arguments.length < 1) return null;
            return {
                receiver: inner.text,
                rawPath: cur.arguments[0].getText(),
                path: stringValue(cur.arguments[0]),
            };
        }
        if (!HTTP.has(name)) return null;
        cur = inner;
    }
    return null;
}

function isDynamicPrefix(a: ts.Expression, info: FileInfo, restLength: number): boolean {
    if (
        ts.isTemplateExpression(a) ||
        ts.isBinaryExpression(a) ||
        ts.isRegularExpressionLiteral(a) ||
        ts.isArrayLiteralExpression(a)
    ) {
        return true;
    }
    if (ts.isIdentifier(a)) {
        return (
            restLength >= 2 &&
            !info.routers.has(a.text) &&
            !info.apps.has(a.text) &&
            !info.imports.has(a.text) &&
            !info.functions.has(a.text)
        );
    }
    return false;
}

function collectFile(path: string, content: string): FileInfo {
    const sf = parseSource(path, content);
    const info: FileInfo = {
        path,
        sf,
        apps: new Set(),
        routers: new Set(),
        imports: new Map(),
        defaultExport: null,
        namedExports: new Map(),
        functions: new Map(),
        routes: [],
        mounts: [],
    };

    // Pass 1: declarations and imports
    walk(sf, (n) => {
        if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
            const source = n.moduleSpecifier.text;
            const clause = n.importClause;
            if (clause?.name) info.imports.set(clause.name.text, { source, imported: "default" });
            const nb = clause?.namedBindings;
            if (nb && ts.isNamedImports(nb)) {
                for (const el of nb.elements) {
                    info.imports.set(el.name.text, { source, imported: (el.propertyName ?? el.name).text });
                }
            }
        } else if (ts.isFunctionDeclaration(n) && n.name) {
            info.functions.set(n.name.text, n);
        } else if (ts.isVariableDeclaration(n) && n.initializer) {
            const init = n.initializer;
            if (ts.isIdentifier(n.name)) {
                const name = n.name.text;
                if (ts.isCallExpression(init)) {
                    const callee = init.expression.getText(sf);
                    if (callee === "express") info.apps.add(name);
                    else if (callee === "Router" || callee === "express.Router") info.routers.add(name);
                    else if (callee === "require") {
                        const s = stringValue(init.arguments[0]);
                        if (s) info.imports.set(name, { source: s, imported: "default" });
                    }
                } else if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
                    info.functions.set(name, init);
                }
            } else if (
                ts.isObjectBindingPattern(n.name) &&
                ts.isCallExpression(init) &&
                init.expression.getText(sf) === "require"
            ) {
                const s = stringValue(init.arguments[0]);
                if (s) {
                    for (const el of n.name.elements) {
                        if (!ts.isIdentifier(el.name)) continue;
                        const imported =
                            el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
                        info.imports.set(el.name.text, { source: s, imported });
                    }
                }
            }
        }
    });

    // Exports (top level)
    for (const st of sf.statements) {
        if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) {
            info.defaultExport = st.expression.text;
        } else if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
            for (const el of st.exportClause.elements) {
                const local = (el.propertyName ?? el.name).text;
                if (el.name.text === "default") info.defaultExport = local;
                else info.namedExports.set(el.name.text, local);
            }
        } else if (ts.isVariableStatement(st) && isExported(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name)) info.namedExports.set(d.name.text, d.name.text);
            }
        } else if (
            ts.isExpressionStatement(st) &&
            ts.isBinaryExpression(st.expression) &&
            st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            st.expression.left.getText(sf) === "module.exports" &&
            ts.isIdentifier(st.expression.right)
        ) {
            info.defaultExport = st.expression.right.text;
        }
    }

    // Pass 2: routes and mounts
    walk(sf, (n) => {
        if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
        const method = n.expression.name.text;
        const target = n.expression.expression;
        const args = [...n.arguments];
        const line = lineOf(sf, n.expression.name);

        if (HTTP.has(method)) {
            let route: RawRoute | null = null;
            if (ts.isIdentifier(target)) {
                if (args.length >= 2 && isRouterLike(info, target.text)) {
                    route = {
                        receiver: target.text,
                        method: method.toUpperCase() as HttpMethod,
                        rawPath: args[0].getText(sf),
                        path: stringValue(args[0]),
                        line,
                        handlers: args.slice(1),
                    };
                }
            } else {
                const base = resolveRouteBase(target);
                if (base && isRouterLike(info, base.receiver)) {
                    route = {
                        receiver: base.receiver,
                        method: method.toUpperCase() as HttpMethod,
                        rawPath: base.rawPath,
                        path: base.path,
                        line,
                        handlers: args,
                    };
                }
            }
            if (route) info.routes.push(route);
            return;
        }

        if (method === "use" && ts.isIdentifier(target) && isRouterLike(info, target.text)) {
            let rest = args;
            let prefix: string | null = "";
            let rawPrefix = "";

            if (rest.length > 0) {
                const first = rest[0];
                if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) {
                    prefix = first.text;
                    rawPrefix = first.getText(sf);
                    rest = rest.slice(1);
                } else if (isDynamicPrefix(first, info, rest.length)) {
                    prefix = null;
                    rawPrefix = first.getText(sf);
                    rest = rest.slice(1);
                }
            }

            const targets: Target[] = [];
            const hints: string[] = [];
            const candidates = new Map<string, string>();

            for (const a of rest) {
                if (ts.isIdentifier(a)) {
                    if (info.routers.has(a.text) || info.apps.has(a.text)) {
                        targets.push({ kind: "local", name: a.text });
                    } else if (info.imports.has(a.text)) {
                        targets.push({ kind: "import", local: a.text });
                        if (looksLikeAuth(a.text)) candidates.set(a.text, `middleware: ${a.text}`);
                    } else if (looksLikeAuth(a.text)) {
                        hints.push(`middleware: ${a.text}`);
                    }
                } else if (ts.isCallExpression(a)) {
                    const callee = a.expression.getText(sf);
                    if (callee === "require") {
                        const s = stringValue(a.arguments[0]);
                        if (s) {
                            const local = `__require:${s}`;
                            info.imports.set(local, { source: s, imported: "default" });
                            targets.push({ kind: "import", local });
                        }
                    } else if (looksLikeAuth(callee)) {
                        hints.push(`middleware: ${callee}()`);
                    }
                }
            }

            if (targets.length || hints.length) {
                info.mounts.push({ receiver: target.text, rawPrefix, prefix, targets, hints, candidates, line });
            }
        }
    });

    return info;
}

function normalizePosix(p: string): string {
    const out: string[] = [];
    for (const part of p.split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") out.pop();
        else out.push(part);
    }
    return out.join("/");
}

function resolveImportPath(from: string, spec: string, fileSet: Set<string>): string | null {
    if (!spec.startsWith(".")) return null;
    const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    const joined = normalizePosix(`${dir}/${spec}`);
    const base = joined.replace(/\.(m|c)?js$/, "");
    const candidates = [
        joined,
        ...EXTS.map((e) => base + e),
        ...EXTS.map((e) => `${joined}/index${e}`),
    ];
    return candidates.find((c) => fileSet.has(c)) ?? null;
}

function resolveTarget(
    info: FileInfo,
    t: Target,
    infos: Map<string, FileInfo>,
    fileSet: Set<string>,
): string | null {
    if (t.kind === "local") return `${info.path}::${t.name}`;
    const imp = info.imports.get(t.local);
    if (!imp) return null;
    const resolved = resolveImportPath(info.path, imp.source, fileSet);
    if (!resolved) return null;
    const target = infos.get(resolved);
    if (!target) return null;
    const local = imp.imported === "default" ? target.defaultExport : target.namedExports.get(imp.imported);
    if (!local) return null;
    if (!target.routers.has(local) && !target.apps.has(local)) return null;
    return `${resolved}::${local}`;
}

function joinPaths(a: string, b: string): string {
    return "/" + `${a}/${b}`.split("/").filter(Boolean).join("/");
}

function normalizeExpressPath(full: string): { path: string; params: RouteParam[] } {
    const params: RouteParam[] = [];
    const path = full.replace(/:([A-Za-z_][A-Za-z0-9_]*)(\?)?/g, (_m, name: string, opt?: string) => {
        params.push({ name, catchAll: false, optional: Boolean(opt) });
        return `{${name}}`;
    });
    return { path, params };
}

export function analyzeExpressRoutes(files: SourceFileInput[]): {
    routes: DetectedRoute[];
    warnings: string[];
} {
    const fileSet = new Set(files.map((f) => f.path));
    const infos = new Map<string, FileInfo>();
    for (const f of files) {
        if (!CODE_RE.test(f.path) || !CALL_HINT_RE.test(f.content)) continue;
        infos.set(f.path, collectFile(f.path, f.content));
    }

    const warnings: string[] = [];
    const edges = new Map<string, Edge[]>();
    const nodeHints = new Map<string, string[]>();
    const byNode = new Map<string, { raw: RawRoute; info: FileInfo }[]>();
    const roots: string[] = [];

    for (const info of infos.values()) {
        for (const a of info.apps) roots.push(`${info.path}::${a}`);

        for (const r of info.routes) {
            const k = `${info.path}::${r.receiver}`;
            const list = byNode.get(k) ?? [];
            list.push({ raw: r, info });
            byNode.set(k, list);
        }

        for (const m of info.mounts) {
            const from = `${info.path}::${m.receiver}`;
            const children: string[] = [];
            const hints = [...m.hints];

            for (const t of m.targets) {
                const k = resolveTarget(info, t, infos, fileSet);
                if (k) {
                    children.push(k);
                    continue;
                }
                if (t.kind === "import") {
                    const cand = m.candidates.get(t.local);
                    if (cand) {
                        hints.push(cand);
                    } else {
                        const src = info.imports.get(t.local)?.source ?? "";
                        if (/^(\.|@\/|~\/)/.test(src)) {
                            warnings.push(
                                `Could not resolve router "${t.local}" mounted in ${info.path}:${m.line}. Its routes may be missing.`,
                            );
                        }
                    }
                }
            }

            if (children.length) {
                const list = edges.get(from) ?? [];
                for (const c of children) list.push({ to: c, prefix: m.prefix, rawPrefix: m.rawPrefix, hints });
                edges.set(from, list);
            } else if (hints.length) {
                nodeHints.set(from, [...(nodeHints.get(from) ?? []), ...hints]);
            }
        }
    }

    const out: DetectedRoute[] = [];
    const seen = new Set<string>();
    const reached = new Set<string>();

    function emitRoute(
        raw: RawRoute,
        info: FileInfo,
        chain: PrefixPart[],
        inheritedHints: string[],
        mounted: boolean,
    ) {
        const notes: string[] = [];
        let partial = !mounted;
        if (!mounted) {
            notes.push("Router is not mounted in any analyzed file, so the real path may have an extra prefix.");
        }

        let full = "";
        for (const part of chain) {
            if (part.prefix === null) {
                full = joinPaths(full, "{dynamic}");
                notes.push(`Mount prefix \`${part.raw}\` is not a string literal.`);
                partial = true;
            } else {
                full = joinPaths(full, part.prefix);
            }
        }
        if (raw.path === null) {
            full = joinPaths(full, "{dynamic}");
            notes.push(`Route path \`${raw.rawPath}\` is not a string literal.`);
            partial = true;
        } else {
            full = joinPaths(full, raw.path);
        }

        const insights = emptyInsights();
        raw.handlers.forEach((h, i) => {
            const isLast = i === raw.handlers.length - 1;
            if (ts.isArrowFunction(h) || ts.isFunctionExpression(h)) {
                mergeInsights(insights, analyzeHandlerNode(h));
            } else if (ts.isIdentifier(h)) {
                const fn = info.functions.get(h.text);
                if (fn) mergeInsights(insights, analyzeHandlerNode(fn));
                else if (isLast) notes.push(`Handler \`${h.text}\` is defined elsewhere. Response details were not analyzed.`);
                if (!isLast && looksLikeAuth(h.text)) insights.authHints.add(`middleware: ${h.text}`);
            } else if (ts.isCallExpression(h) && !isLast) {
                const t = h.expression.getText();
                if (looksLikeAuth(t)) insights.authHints.add(`middleware: ${t}()`);
            } else if (isLast) {
                notes.push(`Handler \`${h.getText().slice(0, 60)}\` is defined elsewhere. Response details were not analyzed.`);
            }
        });

        if (inheritedHints.length) {
            inheritedHints.forEach((h) => insights.authHints.add(h));
            notes.push("Auth middleware is attached at router or mount level. Its order relative to this route was not verified.");
        }

        const { path, params } = normalizeExpressPath(full);
        const key = `${raw.method} ${path} ${info.path}:${raw.line}`;
        if (seen.has(key)) return;
        seen.add(key);

        out.push({
            framework: "express",
            method: raw.method,
            path,
            pathParams: params,
            ...finalizeInsights(insights),
            filePath: info.path,
            line: raw.line,
            certainty: partial ? "partial" : "detected",
            notes,
        });
    }

    function visit(key: string, chain: PrefixPart[], hints: string[], stack: string[]) {
        if (stack.includes(key)) return;
        reached.add(key);
        const here = [...hints, ...(nodeHints.get(key) ?? [])];
        for (const { raw, info } of byNode.get(key) ?? []) emitRoute(raw, info, chain, here, true);
        for (const e of edges.get(key) ?? []) {
            visit(e.to, [...chain, { prefix: e.prefix, raw: e.rawPrefix }], [...here, ...e.hints], [...stack, key]);
        }
    }

    for (const root of roots) visit(root, [], [], []);

    for (const [key, list] of byNode) {
        if (reached.has(key)) continue;
        for (const { raw, info } of list) emitRoute(raw, info, [], nodeHints.get(key) ?? [], false);
    }

    out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    return { routes: out, warnings };
}