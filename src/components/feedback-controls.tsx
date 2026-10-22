"use client";

import { useState, type FormEvent } from "react";
import { ApiError, sendFeedback } from "@/lib/client/api";

type Rating = "USEFUL" | "PARTIALLY_USEFUL" | "NOT_USEFUL";
const RATINGS: { value: Rating; label: string }[] = [
    { value: "USEFUL", label: "Useful" },
    { value: "PARTIALLY_USEFUL", label: "Partly useful" },
    { value: "NOT_USEFUL", label: "Not useful" },
];
const REASONS = [
    ["FACTUALLY_INCORRECT", "Factually incorrect"],
    ["MISSING_INFORMATION", "Missing information"],
    ["WRONG_API_ROUTE", "Wrong API route"],
    ["POOR_FORMATTING", "Poor formatting"],
    ["OTHER", "Other"],
] as const;

export function FeedbackControls({ draftId, token }: { draftId: string; token: string }) {
    const [rating, setRating] = useState<Rating | null>(null);
    const [reason, setReason] = useState("");
    const [comment, setComment] = useState("");
    const [again, setAgain] = useState(false);
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState("");

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!rating) return;
        setStatus("saving");
        try {
            await sendFeedback(
                { draftId, rating, reason: reason || undefined, comment: comment.trim() || undefined, wouldUseAgain: again },
                token,
            );
            setStatus("saved");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not send feedback.");
            setStatus("error");
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-3 text-sm">
            <fieldset>
                <legend className="font-medium">Was this useful?</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    {RATINGS.map((r) => (
                        <label key={r.value} className="flex items-center gap-1.5">
                            <input type="radio" name="rating" checked={rating === r.value} onChange={() => setRating(r.value)} />
                            {r.label}
                        </label>
                    ))}
                </div>
            </fieldset>

            {rating && rating !== "USEFUL" && (
                <div>
                    <label htmlFor="fb-reason" className="block">What was wrong?</label>
                    <select id="fb-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700">
                        <option value="">Select a reason</option>
                        {REASONS.map(([v, l]) => (
                            <option key={v} value={v} className="text-black">{l}</option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <label htmlFor="fb-comment" className="block">Comment (optional)</label>
                <textarea id="fb-comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700" />
            </div>

            <label className="flex items-center gap-2">
                <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />
                I would use RepoScribe again
            </label>

            <button type="submit" disabled={!rating || status === "saving"} className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700">
                {status === "saving" ? "Sending…" : status === "saved" ? "Update feedback" : "Send feedback"}
            </button>
            {status === "saved" && <p role="status">Thanks, your feedback was saved.</p>}
            {status === "error" && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
        </form>
    );
}