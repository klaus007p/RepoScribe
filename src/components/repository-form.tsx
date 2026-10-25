"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, inspectRepository, saveToken } from "@/lib/client/api";

const EXAMPLE_URL = "https://github.com/klaus007p/TouchQuestAI";
const input =
    "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm placeholder:text-neutral-500";

export function RepositoryForm() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [branch, setBranch] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const scan = await inspectRepository(url.trim(), branch.trim() || undefined);
            if (!scan.sessionToken) throw new Error("missing token");
            saveToken(scan.scanId, scan.sessionToken);
            router.push(`/repository/${scan.scanId}`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
            setBusy(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
                <label htmlFor="repo-url" className="mb-1.5 block text-sm font-medium">
                    Public GitHub repository URL
                </label>
                <input
                    id="repo-url"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className={input}
                    aria-describedby={error ? "form-error" : undefined}
                />
            </div>

            <div>
                <label htmlFor="repo-branch" className="mb-1.5 block text-sm font-medium">
                    Branch or tag <span className="font-normal text-neutral-500">(optional)</span>
                </label>
                <input
                    id="repo-branch"
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Default branch"
                    className={input}
                />
            </div>

            {error && (
                <p id="form-error" role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={busy || url.trim().length === 0}
                className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
            >
                {busy && <span className="spinner" aria-hidden="true" />}
                {busy ? "Inspecting…" : "Inspect repository"}
            </button>

            <div className="flex items-center justify-between text-sm">
                <button
                    type="button"
                    onClick={() => setUrl(EXAMPLE_URL)}
                    disabled={busy}
                    className="text-neutral-400 underline underline-offset-4 hover:text-neutral-200 disabled:opacity-50"
                >
                    Use an example repository
                </button>
                {busy && (
                    <span role="status" className="text-neutral-400">
                        Reading from GitHub, up to 30 seconds
                    </span>
                )}
            </div>
        </form>
    );
}