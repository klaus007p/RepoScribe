"use client";

import { useEffect, useState } from "react";

export type GenerationState =
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "error"; message: string; retryable: boolean };

function Elapsed() {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, []);
    return <>{seconds}s</>;
}

export function GenerationStatus({ state, onRetry }: { state: GenerationState; onRetry: () => void }) {
    if (state.kind === "idle") return null;

    if (state.kind === "running") {
        return (
            <p role="status" aria-live="polite" className="text-sm text-neutral-700 dark:text-neutral-300">
                Generating documentation (<Elapsed />). Local models can take several minutes. Keep this tab open.
            </p>
        );
    }

    return (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p>{state.message}</p>
            {state.retryable && (
                <button type="button" onClick={onRetry} className="mt-2 underline underline-offset-4">
                    Try again
                </button>
            )}
        </div>
    );
}