import type { SourceRef } from "@/lib/client/api";

export function SourceReferences({
    refs,
    warnings,
    repoUrl,
    commitSha,
    edited,
}: {
    refs: SourceRef[];
    warnings: string[];
    repoUrl: string | null;
    commitSha: string | null;
    edited: boolean;
}) {
    const link = (r: SourceRef) =>
        repoUrl && commitSha
            ? `${repoUrl}/blob/${commitSha}/${r.filePath}${r.startLine ? `#L${r.startLine}${r.endLine && r.endLine !== r.startLine ? `-L${r.endLine}` : ""}` : ""}`
            : null;

    return (
        <div className="space-y-5 text-sm">
            {edited && (
                <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    Warnings and references were produced at generation time. Manual edits are not re-verified.
                </p>
            )}

            <section aria-labelledby="warn-h">
                <h2 id="warn-h" className="font-medium">Needs review ({warnings.length})</h2>
                {warnings.length === 0 ? (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">No warnings.</p>
                ) : (
                    <ul className="mt-2 space-y-2">
                        {warnings.map((w, i) => (
                            <li key={i} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                {w}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="ref-h">
                <h2 id="ref-h" className="font-medium">Source references ({refs.length})</h2>
                {refs.length === 0 ? (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">No references.</p>
                ) : (
                    <ul className="mt-2 space-y-2">
                        {refs.map((r, i) => {
                            const href = link(r);
                            const label = `${r.filePath}${r.startLine ? `:${r.startLine}` : ""}`;
                            return (
                                <li key={i}>
                                    <p>{r.claim}</p>
                                    {href ? (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-neutral-600 hover:underline dark:text-neutral-400">
                                            {label}
                                        </a>
                                    ) : (
                                        <span className="break-all font-mono text-xs text-neutral-600 dark:text-neutral-400">{label}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}