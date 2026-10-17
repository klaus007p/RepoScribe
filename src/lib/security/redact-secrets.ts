const PLACEHOLDER = "[REDACTED]";

interface Rule {
    pattern: RegExp;
    replace: (match: string, groups: string[]) => string;
}

const whole = () => PLACEHOLDER;

const RULES: Rule[] = [
    {
        // Private key blocks. Keep the newline count so line numbers don't shift.
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
        replace: (m) => PLACEHOLDER + "\n".repeat((m.match(/\n/g) ?? []).length),
    },
    { pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g, replace: whole },
    { pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g, replace: whole },
    { pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, replace: whole },
    { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replace: whole },
    { pattern: /\bsk-(?:or-v1-|proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g, replace: whole },
    { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: whole },
    { pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: whole },
    { pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replace: whole },
    {
        // scheme://user:password@host
        pattern: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@\/'"]+:)([^\s@\/'"]+)(@)/gi,
        replace: (m, g) => (g[1] === PLACEHOLDER ? m : `${g[0]}${PLACEHOLDER}${g[2]}`),
    },
    {
        // apiKey = "value", { token: "value" }
        pattern:
            /\b([A-Za-z0-9_.-]*(?:secret|token|password|passwd|api[_-]?key|private[_-]?key|access[_-]?key)[A-Za-z0-9_.-]*)(\s*[:=]\s*)(["'`])([^"'`\n]{8,})\3/gi,
        replace: (m, g) =>
            g[3] === PLACEHOLDER ? m : `${g[0]}${g[1]}${g[2]}${PLACEHOLDER}${g[2]}`,
    },
    {
        // dotenv style: OPENAI_API_KEY=value
        pattern: /^([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|CREDENTIAL)[A-Z0-9_]*=)([^\r\n]{8,})/gm,
        replace: (m, g) => (g[1].includes(PLACEHOLDER) ? m : `${g[0]}${PLACEHOLDER}`),
    },
];

export function redactSecrets(input: string): { text: string; count: number } {
    let count = 0;
    let text = input;
    for (const rule of RULES) {
        text = text.replace(rule.pattern, (match, ...groups) => {
            const out = rule.replace(match, groups as string[]);
            if (out !== match) count++;
            return out;
        });
    }
    return { text, count };
}