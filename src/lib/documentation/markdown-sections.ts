import { AppError } from "@/lib/http/error";

export interface Heading {
    level: number;
    title: string;
    line: number;
    path: string[];
}
export interface SectionRange {
    heading: Heading;
    start: number; // line index of the heading
    end: number; // exclusive
}

const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

function normalizeTitle(t: string): string {
    return t.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function parseHeadings(markdown: string): Heading[] {
    const headings: Heading[] = [];
    const stack: Heading[] = [];
    let fence: string | null = null;

    markdown.split(/\r?\n/).forEach((line, i) => {
        const f = FENCE_RE.exec(line);
        if (f) {
            if (!fence) fence = f[1];
            else if (f[1] === fence) fence = null;
            return;
        }
        if (fence) return;
        const m = HEADING_RE.exec(line);
        if (!m) return;

        const level = m[1].length;
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        const title = m[2].trim();
        const heading: Heading = { level, title, line: i, path: [...stack.map((s) => s.title), title] };
        stack.push(heading);
        headings.push(heading);
    });
    return headings;
}

export function findSection(markdown: string, headingPath: string): SectionRange {
    const wanted = headingPath.split(">").map(normalizeTitle).filter(Boolean);
    if (wanted.length === 0) {
        throw new AppError("INVALID_INPUT", 400, 'Provide a heading path such as "Installation > Environment Variables".');
    }

    const headings = parseHeadings(markdown);
    const matches = headings.filter((h) => {
        const chain = h.path.map(normalizeTitle);
        if (chain.length < wanted.length) return false;
        return wanted.every((w, i) => chain[chain.length - wanted.length + i] === w);
    });

    if (matches.length === 0) {
        throw new AppError("NOT_FOUND", 404, `Section "${headingPath}" was not found in this document.`);
    }
    if (matches.length > 1) {
        throw new AppError(
            "INVALID_INPUT",
            400,
            `Section "${headingPath}" matches ${matches.length} headings. Use a longer path such as "Parent > Child".`,
        );
    }

    const heading = matches[0];
    const next = headings.find((h) => h.line > heading.line && h.level <= heading.level);
    const total = markdown.split(/\r?\n/).length;
    return { heading, start: heading.line, end: next ? next.line : total };
}

export function replaceSection(markdown: string, range: SectionRange, replacement: string): string {
    const lines = markdown.split(/\r?\n/);
    const before = lines.slice(0, range.start);
    const after = lines.slice(range.end);
    const body = replacement.replace(/\s+$/, "").split("\n");
    const separator = after.length ? [""] : [];
    return [...before, ...body, ...separator, ...after].join("\n").replace(/\s*$/, "\n");
}

export function closeOpenFence(text: string): string {
    let fence: string | null = null;
    for (const line of text.split("\n")) {
        const f = FENCE_RE.exec(line);
        if (!f) continue;
        if (!fence) fence = f[1];
        else if (f[1] === fence) fence = null;
    }
    return fence ? `${text}\n${fence}` : text;
}

/** Keeps the model from touching anything outside the requested section. */
export function normalizeSectionReplacement(
    replacement: string,
    heading: Heading,
    originalHeadingLine: string,
): { text: string; notes: string[] } {
    const notes: string[] = [];
    let lines = replacement.trim().split(/\r?\n/);

    const first = HEADING_RE.exec(lines[0] ?? "");
    if (!first) {
        lines = [originalHeadingLine, "", ...lines];
    } else if (first[1].length !== heading.level) {
        lines[0] = originalHeadingLine;
        notes.push("The regenerated heading had the wrong level and was reset.");
    }

    const stop = parseHeadings(lines.join("\n")).find((h) => h.line > 0 && h.level <= heading.level);
    if (stop) {
        lines = lines.slice(0, stop.line);
        notes.push("The model returned content outside the requested section. That content was discarded.");
    }

    return { text: closeOpenFence(lines.join("\n").trim()), notes };
}