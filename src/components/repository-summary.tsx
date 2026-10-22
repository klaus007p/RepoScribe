import type { ScanResponse } from "@/lib/client/api";

export function RepositorySummary({ scan }: { scan: ScanResponse }) {
    const { repository, summary, facts } = scan;
    const sha = repository.commitSha;

    return (
        <section aria-labelledby="repo-heading" className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <h1 id="repo-heading" className="text-2xl font-semibold tracking-tight">
                <a href={repository.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {repository.owner}/{repository.name}
                </a>
            </h1>

            <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                    <dt className="text-neutral-500">Branch</dt>
                    <dd>{repository.branch ?? "unknown"}</dd>
                </div>
                <div>
                    <dt className="text-neutral-500">Pinned commit</dt>
                    <dd className="font-mono">
                        {sha ? (
                            <a href={`${repository.url}/commit/${sha}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {sha.slice(0, 10)}
                            </a>
                        ) : (
                            "unknown"
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="text-neutral-500">Package manager</dt>
                    <dd>{facts?.stack.packageManager ?? "not detected"}</dd>
                </div>
                <div>
                    <dt className="text-neutral-500">Existing README</dt>
                    <dd>{summary.readmeExists ? "Yes" : "No"}</dd>
                </div>
            </dl>

            <div className="mt-4">
                <h2 className="text-sm text-neutral-500">Detected stack</h2>
                {summary.detectedStack.length ? (
                    <ul className="mt-1 flex flex-wrap gap-2">
                        {summary.detectedStack.map((t) => (
                            <li key={t} className="rounded-full border border-neutral-300 px-3 py-0.5 text-xs dark:border-neutral-700">
                                {t}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-1 text-sm">No known technologies detected.</p>
                )}
            </div>
        </section>
    );
}