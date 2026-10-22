export function listHeadingPaths(markdown: string): string[] {
    const out: string[] = [];
    const stack: { level: number; title: string }[] = [];
    let fence: string | null = null;
    for (const line of markdown.split(/\r?\n/)) {
        const f = /^\s{0,3}(```|~~~)/.exec(line);
        if (f) {
            fence = !fence ? f[1] : f[1] === fence ? null : fence;
            continue;
        }
        if (fence) continue;
        const m = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
        if (!m) continue;
        const level = m[1].length;
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        stack.push({ level, title: m[2].trim() });
        out.push(stack.map((s) => s.title).join(" > "));
    }
    return out;
}

export function downloadMarkdown(filename: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}