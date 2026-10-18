import ts from "typescript";
import { lineOf, parseSource, stringValue, walk } from "./ast-utils";
import type { SourceFileInput } from "./route-types";

export interface EnvVarFact {
    name: string;
    description?: string;
    documentedIn?: { filePath: string; line: number };
    usedIn: { filePath: string; line: number }[];
}

const IGNORED = new Set(["NODE_ENV", "NEXT_RUNTIME", "CI"]);
const NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const EXAMPLE_FILE_RE = /(^|\/)\.env(\.[a-z]+)?\.(example|sample|template|dist)$/i;
const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const MAX_USES = 5;

export function analyzeEnvironment(files: SourceFileInput[]): EnvVarFact[] {
    const vars = new Map<string, EnvVarFact>();
    const get = (name: string): EnvVarFact => {
        let v = vars.get(name);
        if (!v) {
            v = { name, usedIn: [] };
            vars.set(name, v);
        }
        return v;
    };

    for (const f of files) {
        if (EXAMPLE_FILE_RE.test(f.path)) {
            parseExample(f, get);
        } else if (CODE_RE.test(f.path) && f.content.includes("env")) {
            scanSource(f, get);
        }
    }

    return [...vars.values()]
        .filter((v) => !IGNORED.has(v.name))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function parseExample(f: SourceFileInput, get: (n: string) => EnvVarFact) {
    let pending: string[] = [];
    f.content.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.trim();
        if (line.startsWith("#")) {
            pending.push(line.replace(/^#+\s*/, ""));
            return;
        }
        const m = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!m) {
            pending = [];
            return;
        }
        const trailing = /\s#\s*(.+)$/.exec(m[2])?.[1];
        const text = trailing ?? (pending.length ? pending.join(" ") : undefined);
        const v = get(m[1]);
        v.documentedIn = { filePath: f.path, line: i + 1 };
        if (text) v.description = text.slice(0, 200);
        pending = [];
    });
}

function scanSource(f: SourceFileInput, get: (n: string) => EnvVarFact) {
    const sf = parseSource(f.path, f.content);
    const isEnv = (e: ts.Expression) => {
        const t = e.getText(sf);
        return t === "process.env" || t === "import.meta.env";
    };
    const add = (name: string | null, node: ts.Node) => {
        if (!name || !NAME_RE.test(name)) return;
        const v = get(name);
        if (v.usedIn.length < MAX_USES) v.usedIn.push({ filePath: f.path, line: lineOf(sf, node) });
    };

    walk(sf, (n) => {
        if (ts.isPropertyAccessExpression(n) && isEnv(n.expression)) {
            add(n.name.text, n);
        } else if (ts.isElementAccessExpression(n) && isEnv(n.expression)) {
            add(stringValue(n.argumentExpression), n);
        } else if (
            ts.isVariableDeclaration(n) &&
            ts.isObjectBindingPattern(n.name) &&
            n.initializer &&
            isEnv(n.initializer)
        ) {
            for (const el of n.name.elements) {
                const key = el.propertyName ?? el.name;
                add(ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : null, el);
            }
        }
    });
}