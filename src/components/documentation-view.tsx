"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    ApiError,
    findScanIdForDraft,
    findTokenForScan,
    getConfig,
    getDraft,
    getDrafts,
    getScan,
    type DraftResponse,
    type ScanResponse,
} from "@/lib/client/api";
import { DocumentationEditor } from "./documentation-editor";
import { FeedbackControls } from "./feedback-controls";
import { SourceReferences } from "./source-references";

type State =
    | { kind: "loading" }
    | { kind: "no-token" }
    | { kind: "error"; error: ApiError }
    | { kind: "ready"; draft: DraftResponse; scan: ScanResponse; token: string; hosted: boolean };

export function DocumentationView({ draftId }: { draftId: string }) {
    const [state, setState] = useState<State>({ kind: "loading" });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const scanId = findScanIdForDraft(draftId);
            const token = scanId ? findTokenForScan(scanId) : null;
            if (!scanId || !token) {
                setState({ kind: "no-token" });
                return;
            }
            try {
                const [draft, scan, config] = await Promise.all([getDraft(draftId, token), getScan(scanId, token), getConfig()]);
                if (!cancelled) setState({ kind: "ready", draft, scan, token, hosted: config.hostedInference });
            } catch (err) {
                if (!cancelled) setState({ kind: "error", error: err instanceof ApiError ? err : new ApiError("UNKNOWN", "Something went wrong.", 0, true) });
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [draftId, reloadKey]);

    if (state.kind === "loading") return <p role="status" className="py-12 text-sm">Loading document…</p>;

    if (state.kind === "no-token") {
        return (
            <div className="space-y-3 py-12">
                <h1 className="text-xl font-semibold">Access token not found</h1>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    Drafts can only be opened in the browser tab that created them. Scan the repository again to generate new ones.
                </p>
                <Link href="/" className="underline underline-offset-4">Back to the start</Link>
            </div>
        );
    }

    if (state.kind === "error") {
        const gone = [401, 403, 404].includes(state.error.status);
        return (
            <div className="space-y-3 py-12" role="alert">
                <h1 className="text-xl font-semibold">{gone ? "This document is not available" : "Could not load the document"}</h1>
                <p className="text-sm">{state.error.message}</p>
                {gone ? (
                    <Link href="/" className="underline underline-offset-4">Scan again</Link>
                ) : (
                    <button className="underline underline-offset-4" onClick={() => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); }}>
                        Try again
                    </button>
                )}
            </div>
        );
    }

    const { draft, scan, token, hosted } = state;
    const siblings = getDrafts(draft.scanId);
    const other = draft.type === "README" ? "API" : "README";

    return (
        <div className="space-y-6">
            <header className="space-y-2">
                <Link href={`/repository/${draft.scanId}`} className="text-sm underline underline-offset-4">
                    ← {scan.repository.owner}/{scan.repository.name}
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight">{draft.type === "README" ? "README.md" : "API.md"}</h1>
                    <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs dark:border-neutral-700">
                        {draft.status === "EDITED" ? "Edited" : "Generated"}
                    </span>
                    {siblings[other] && (
                        <Link href={`/documentation/${siblings[other]}`} className="text-sm underline underline-offset-4">
                            Open {other === "README" ? "README.md" : "API.md"}
                        </Link>
                    )}
                </div>
                {draft.model && (
                    <p className="text-xs text-neutral-500">
                        Drafted by {draft.model.modelId} ({draft.model.provider.toLowerCase()}) from commit{" "}
                        <span className="font-mono">{scan.repository.commitSha?.slice(0, 10)}</span>. AI output can be wrong. Review it before publishing.
                    </p>
                )}
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <DocumentationEditor
                    key={draft.id}
                    draft={draft}
                    token={token}
                    hosted={hosted}
                    onChange={(d) => setState({ ...state, draft: d })}
                />
                <aside className="space-y-6">
                    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                        <SourceReferences
                            refs={draft.sourceReferences}
                            warnings={draft.warnings}
                            repoUrl={scan.repository.url}
                            commitSha={scan.repository.commitSha}
                            edited={draft.status === "EDITED"}
                        />
                    </div>
                    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                        <FeedbackControls draftId={draft.id} token={token} />
                    </div>
                </aside>
            </div>
        </div>
    );
}