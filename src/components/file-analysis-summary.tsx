import type { RepositoryFacts } from "@/lib/validation/repository-schemas";

const SKIP_LABELS: Record<string, string> = {
    excluded_directory: "In excluded folders (node_modules, build output)",
    secret_file: "Possible secret files",
    binary_or_asset: "Binary files and assets",
    lockfile: "Lockfiles",
    not_relevant: "Not relevant to documentation",
    too_large: "Over the size limit",
    over_file_limit: "Over the file-count limit",
    over_byte_limit: "Over the total-size limit",
};

export function FileAnalysisSummary({
    completeness,
    warnings,
}: {
    completeness: RepositoryFacts["completeness"];
    warnings: string[];
}) {
    const skipped = Object.entries(completeness.skipped).filter(([, n]) => n > 0);

    return (
        <section aria-labelledby="files-heading" className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 id="files-heading" className="text-lg font-medium">
                File analysis
            </h2>

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                    <dt className="text-neutral-500">Files in repository</dt>
                    <dd>{completeness.filesInTree}</dd>
                </div>
                <div>
                    <dt className="text-neutral-500">Files analyzed</dt>
                    <dd>{completeness.filesRead}</dd>
                </div>
                <div>
                    <dt className="text-neutral-500">Secret-like values redacted</dt>
                    <dd>{completeness.redactionsApplied}</dd>
                </div>
            </dl>

            {skipped.length > 0 && (
                <details className="mt-3 text-sm">
                    <summary className="cursor-pointer">Why some files were skipped</summary>
                    <ul className="mt-2 list-disc pl-5">
                        {skipped.map(([reason, n]) => (
                            <li key={reason}>
                                {SKIP_LABELS[reason] ?? reason}: {n}
                            </li>
                        ))}
                        {completeness.filesFailed > 0 && <li>Could not be read from GitHub: {completeness.filesFailed}</li>}
                    </ul>
                </details>
            )}

            {completeness.treeTruncated && (
                <p role="alert" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    This repository is too large for GitHub to list completely, so the analysis is incomplete.
                </p>
            )}

            {warnings.length > 0 && (
                <div className="mt-3">
                    <h3 className="text-sm font-medium">Warnings</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
                        {warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}