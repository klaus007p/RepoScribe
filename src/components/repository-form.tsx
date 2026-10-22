"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, inspectRepository, saveToken } from "@/lib/client/api";

const EXAMPLE_URL = "https://github.com/SandeepVashishtha/Eventra";

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
                <label htmlFor="repo-url" className="mb-1 block text-sm font-medium">
                    Public GitHub repository URL
                </label>
                <input
                    id="repo-url"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                    aria-describedby={error ? "form-error" : undefined}
                />
            </div>

            <div>
                <label htmlFor="repo-branch" className="mb-1 block text-sm font-medium">
                    Branch or tag <span className="font-normal text-neutral-500">(optional, defaults to the default branch)</span>
                </label>
                <input
                    id="repo-branch"
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
            </div>

            {error && (
                <p id="form-error" role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={busy || url.trim().length === 0}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                    {busy ? "Inspecting…" : "Inspect repository"}
                </button>
                <button
                    type="button"
                    onClick={() => setUrl(EXAMPLE_URL)}
                    disabled={busy}
                    className="text-sm underline underline-offset-4 disabled:opacity-50"
                >
                    Use an example repository
                </button>
            </div>

            {busy && (
                <p role="status" className="text-sm text-neutral-600 dark:text-neutral-400">
                    Reading the repository from GitHub. This can take up to 30 seconds.
                </p>
            )}
        </form>
    );
}