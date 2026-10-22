"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
    ApiError,
    clearScan,
    deleteScan,
    generateDocuments,
    getConfig,
    getScan,
    getToken,
    saveDrafts,
    type DocType,
    type ScanResponse,
} from "@/lib/client/api";
import { FileAnalysisSummary } from "./file-analysis-summary";
import { GenerationStatus, type GenerationState } from "./generation-status";
import { RepositorySummary } from "./repository-summary";

type LoadState =
    | { kind: "loading" }
    | { kind: "no-token" }
    | { kind: "error"; error: ApiError }
    | { kind: "ready"; scan: ScanResponse; hosted: boolean };

export function RepositoryView({ scanId }: { scanId: string }) {
    const router = useRouter();
    const [state, setState] = useState<LoadState>({ kind: "loading" });
    const [reloadKey, setReloadKey] = useState(0);

    const [docs, setDocs] = useState<Record<DocType, boolean>>({ README: true, API: true });
    const [instructions, setInstructions] = useState("");
    const [consent, setConsent] = useState(false);
    const [generation, setGeneration] = useState<GenerationState>({ kind: "idle" });
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const token = getToken(scanId);
            if (!token) {
                setState({ kind: "no-token" });
                return;
            }
            try {
                const [scan, config] = await Promise.all([getScan(scanId, token), getConfig()]);
                if (!cancelled) setState({ kind: "ready", scan, hosted: config.hostedInference });
            } catch (err) {
                if (cancelled) return;
                setState({
                    kind: "error",
                    error: err instanceof ApiError ? err : new ApiError("UNKNOWN", "Something went wrong.", 0, true),
                });
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [scanId, reloadKey]);

    if (state.kind === "loading") {
        return <p role="status" className="py-12 text-sm">Loading repository analysis…</p>;
    }

    if (state.kind === "no-token") {
        return (
            <div className="space-y-3 py-12">
                <h1 className="text-xl font-semibold">Access token not found</h1>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    This scan can only be opened in the browser tab that created it, because the access token is kept in
                    that tab&apos;s session storage. Scan the repository again to continue.
                </p>
                <Link href="/" className="inline-block underline underline-offset-4">
                    Back to the start
                </Link>
            </div>
        );
    }

    if (state.kind === "error") {
        const gone = state.error.status === 404 || state.error.status === 403 || state.error.status === 401;
        return (
            <div className="space-y-3 py-12" role="alert">
                <h1 className="text-xl font-semibold">{gone ? "This scan is not available" : "Could not load the analysis"}</h1>
                <p className="text-sm">{state.error.message}</p>
                {gone ? (
                    <Link href="/" className="inline-block underline underline-offset-4">
                        Scan again
                    </Link>
                ) : (
                    <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={() => {
                            setState({ kind: "loading" });
                            setReloadKey((k) => k + 1);
                        }}
                    >
                        Try again
                    </button>
                )}
            </div>
        );
    }

    const { scan, hosted } = state;
    const facts = scan.facts;
    const selected = (Object.keys(docs) as DocType[]).filter((d) => docs[d]);
    const running = generation.kind === "running";
    const canGenerate = selected.length > 0 && (!hosted || consent) && !running;

    async function runGeneration() {
        const token = getToken(scanId);
        if (!token) {
            setState({ kind: "no-token" });
            return;
        }
        setGeneration({ kind: "running" });
        try {
            const result = await generateDocuments(
                {
                    scanId,
                    documents: selected,
                    instructions: instructions.trim() || undefined,
                    consentHostedInference: hosted ? true : undefined,
                },
                token,
            );
            saveDrafts(scanId, result.drafts);
            const first = result.drafts.find((d) => d.type === "README") ?? result.drafts[0];
            router.push(`/documentation/${first.id}`);
        } catch (err) {
            setGeneration({
                kind: "error",
                message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
                retryable: err instanceof ApiError ? err.retryable : true,
            });
        }
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (canGenerate) void runGeneration();
    }

    async function onDelete() {
        const token = getToken(scanId);
        if (!token || !window.confirm("Delete this scan and all its drafts?")) return;
        setDeleting(true);
        try {
            await deleteScan(scanId, token);
            clearScan(scanId);
            router.push("/");
        } catch (err) {
            setDeleting(false);
            setGeneration({
                kind: "error",
                message: err instanceof ApiError ? err.message : "Could not delete the scan.",
                retryable: false,
            });
        }
    }

    return (
        <div className="space-y-6">
            <RepositorySummary scan={scan} />
            {facts && <FileAnalysisSummary completeness={facts.completeness} warnings={scan.warnings} />}

            <section aria-labelledby="routes-heading" className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
                <h2 id="routes-heading" className="text-lg font-medium">
                    API routes ({facts?.routes.length ?? 0})
                </h2>
                {!facts || facts.routes.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                        No supported routes were detected. If you generate API documentation, it will say so instead of
                        inventing endpoints.
                    </p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-neutral-500">
                                <tr>
                                    <th className="py-1 pr-4 font-medium">Method</th>
                                    <th className="py-1 pr-4 font-medium">Path</th>
                                    <th className="py-1 pr-4 font-medium">Source</th>
                                    <th className="py-1 font-medium">Confidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facts.routes.map((r) => (
                                    <tr key={`${r.method}-${r.path}-${r.filePath}-${r.line}`} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                                        <td className="py-1.5 pr-4 font-mono">{r.method}</td>
                                        <td className="py-1.5 pr-4 font-mono">{r.path}</td>
                                        <td className="py-1.5 pr-4 font-mono text-xs">
                                            <a
                                                href={`${scan.repository.url}/blob/${scan.repository.commitSha}/${r.filePath}#L${r.line}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline"
                                            >
                                                {r.filePath}:{r.line}
                                            </a>
                                        </td>
                                        <td className="py-1.5">
                                            {r.certainty === "detected" ? "Detected" : "Partial"}
                                            {r.notes.length > 0 && (
                                                <span className="block text-xs text-neutral-500">{r.notes[0]}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
                <fieldset>
                    <legend className="text-lg font-medium">Generate documentation</legend>
                    <div className="mt-2 flex flex-wrap gap-6 text-sm">
                        {(["README", "API"] as const).map((d) => (
                            <label key={d} className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={docs[d]}
                                    onChange={(e) => setDocs((prev) => ({ ...prev, [d]: e.target.checked }))}
                                />
                                {d === "README" ? "README.md" : "API.md"}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div>
                    <label htmlFor="instructions" className="mb-1 block text-sm font-medium">
                        Instructions <span className="font-normal text-neutral-500">(optional, max 1000 characters)</span>
                    </label>
                    <textarea
                        id="instructions"
                        rows={3}
                        maxLength={1000}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Keep the README concise and include real setup commands."
                        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                    />
                </div>

                {hosted ? (
                    <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                        <span>
                            This server uses a hosted AI provider. Selected source excerpts and the extracted repository
                            facts will be sent to that external service. I agree to this.
                        </span>
                    </label>
                ) : (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Generation runs on a local model. Source excerpts are not sent to a hosted AI service.
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        type="submit"
                        disabled={!canGenerate}
                        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                        {running ? "Generating…" : "Generate"}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting || running}
                        className="text-sm text-red-700 underline underline-offset-4 disabled:opacity-50 dark:text-red-400"
                    >
                        Delete this scan
                    </button>
                </div>

                <GenerationStatus state={generation} onRetry={() => void runGeneration()} />
            </form>
        </div>
    );
}