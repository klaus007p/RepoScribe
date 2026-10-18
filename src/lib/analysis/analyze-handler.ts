import ts from "typescript";
import { stringValue, walk } from "./ast-utils";

export interface HandlerInsights {
    statusCodes: Set<number>;
    queryParams: Set<string>;
    validationSchemas: Set<string>;
    authHints: Set<string>;
}

export function emptyInsights(): HandlerInsights {
    return {
        statusCodes: new Set(),
        queryParams: new Set(),
        validationSchemas: new Set(),
        authHints: new Set(),
    };
}

export function mergeInsights(target: HandlerInsights, source: HandlerInsights): void {
    source.statusCodes.forEach((v) => target.statusCodes.add(v));
    source.queryParams.forEach((v) => target.queryParams.add(v));
    source.validationSchemas.forEach((v) => target.validationSchemas.add(v));
    source.authHints.forEach((v) => target.authHints.add(v));
}

export function finalizeInsights(i: HandlerInsights) {
    return {
        statusCodes: [...i.statusCodes].sort((a, b) => a - b),
        queryParams: [...i.queryParams].sort(),
        validationSchemas: [...i.validationSchemas].sort(),
        authHints: [...i.authHints].sort(),
    };
}

const AUTH_FN_RE =
    /^(auth|getServerSession|getSession|getToken|currentUser|getAuth|requireAuth|requireUser|verifyToken|authenticate|withAuth|getUser)$/;
const AUTH_NAME_RE = /auth|protect|jwt|guard|passport|permission|session|token|login|verify/i;

export function looksLikeAuth(name: string): boolean {
    return AUTH_NAME_RE.test(name);
}

const SCHEMA_METHODS = new Set([
    "parse", "safeParse", "parseAsync", "safeParseAsync", "validate", "validateAsync", "validateSync",
]);
const IGNORED_RECEIVERS = new Set([
    "JSON", "Date", "Number", "Math", "Object", "URL", "Array", "String", "path", "querystring", "qs",
]);
const INPUT_ARG_RE = /json\(|body|formData|searchParams|params|query/i;
const QUERY_RECEIVER_RE = /(^|\.)(req|request)\.query$/;
const RESPONSE_CALLEE_RE = /^(Next)?Response(\.json)?$/;

function addStatus(set: Set<number>, value: number) {
    if (value >= 100 && value <= 599) set.add(value);
}

export function analyzeHandlerNode(node: ts.Node): HandlerInsights {
    const out = emptyInsights();

    walk(node, (n) => {
        // Response constructors: NextResponse.json(...), Response.json(...), new Response(...)
        if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
            const callee = n.expression.getText();
            const args = n.arguments ? [...n.arguments] : [];

            if (RESPONSE_CALLEE_RE.test(callee)) {
                let hasStatusProp = false;
                for (const a of args) {
                    if (!ts.isObjectLiteralExpression(a)) continue;
                    for (const p of a.properties) {
                        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "status") {
                            hasStatusProp = true;
                            if (ts.isNumericLiteral(p.initializer)) addStatus(out.statusCodes, Number(p.initializer.text));
                        }
                    }
                }
                if (!hasStatusProp) out.statusCodes.add(200);
            }

            if (ts.isCallExpression(n)) {
                const fname = ts.isIdentifier(n.expression)
                    ? n.expression.text
                    : ts.isPropertyAccessExpression(n.expression)
                        ? n.expression.name.text
                        : null;
                if (fname && AUTH_FN_RE.test(fname)) out.authHints.add(`calls ${fname}()`);

                if (ts.isPropertyAccessExpression(n.expression)) {
                    const name = n.expression.name.text;
                    const recv = n.expression.expression;
                    const recvText = recv.getText();

                    if ((name === "status" || name === "sendStatus") && args[0] && ts.isNumericLiteral(args[0])) {
                        addStatus(out.statusCodes, Number(args[0].text));
                    } else if (/^(res|response)$/.test(recvText) && (name === "json" || name === "send" || name === "end")) {
                        out.statusCodes.add(200);
                    }

                    if (name === "verify" && /jwt/i.test(recvText)) out.authHints.add("verifies a JWT");

                    if ((name === "get" || name === "getAll" || name === "has") && /searchParams$/.test(recvText)) {
                        const s = stringValue(args[0]);
                        if (s) out.queryParams.add(s);
                    }

                    if (
                        SCHEMA_METHODS.has(name) &&
                        args[0] &&
                        (ts.isIdentifier(recv) || ts.isPropertyAccessExpression(recv)) &&
                        !IGNORED_RECEIVERS.has(recvText) &&
                        INPUT_ARG_RE.test(args[0].getText())
                    ) {
                        out.validationSchemas.add(recvText);
                    }
                }
            }
        }

        // req.query.page, req.query["page"]
        if (ts.isPropertyAccessExpression(n) && QUERY_RECEIVER_RE.test(n.expression.getText())) {
            out.queryParams.add(n.name.text);
        }
        if (ts.isElementAccessExpression(n) && QUERY_RECEIVER_RE.test(n.expression.getText())) {
            const s = stringValue(n.argumentExpression);
            if (s) out.queryParams.add(s);
        }
        // const { page, limit } = req.query
        if (
            ts.isVariableDeclaration(n) &&
            ts.isObjectBindingPattern(n.name) &&
            n.initializer &&
            QUERY_RECEIVER_RE.test(n.initializer.getText())
        ) {
            for (const el of n.name.elements) out.queryParams.add((el.propertyName ?? el.name).getText());
        }

        if (ts.isStringLiteral(n) && n.text.toLowerCase() === "authorization") {
            out.authHints.add("reads the Authorization header");
        }
    });

    return out;
}