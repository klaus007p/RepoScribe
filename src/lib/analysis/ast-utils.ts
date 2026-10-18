import ts from "typescript";

export function parseSource(filePath: string, content: string): ts.SourceFile {
    const p = filePath.toLowerCase();
    const kind = p.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : p.endsWith(".jsx")
            ? ts.ScriptKind.JSX
            : /\.(ts|mts|cts)$/.test(p)
                ? ts.ScriptKind.TS
                : ts.ScriptKind.JS;
    return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

export function stringValue(node: ts.Node | undefined): string | null {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
}

export function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
    visit(node);
    ts.forEachChild(node, (child) => walk(child, visit));
}

export function isExported(node: ts.Node): boolean {
    return (
        ts.canHaveModifiers(node) &&
        (ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
    );
}