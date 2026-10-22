"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, regenerateSection, saveDraft, type DraftResponse } from "@/lib/client/api";
import { downloadMarkdown, listHeadingPaths } from "@/lib/client/markdown";
import { MarkdownPreview } from "./markdown-preview";

const backupKey = (id: string) => `reposcribe:edit:${id}`;

export function DocumentationEditor({
    draft,
    token,
    hosted,
    onChange,
}: {
    draft: DraftResponse;
    token: string;
    hosted: boolean;
    onChange: (d: DraftResponse) => void;
}) {
    const [text, setText] = useState(() => {
        try {
            return sessionStorage.getItem(backupKey(draft.id)) ?? draft.contentMarkdown;
        } catch {
            return draft.contentMarkdown;
        }
    });
    const [saved, setSaved] = useState(draft.contentMarkdown);
    const [tab, setTab] = useState<"edit" | "preview">("preview");
    const [busy, setBusy] = useState<"save" | "regen" | null>(null);
    const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
    const [section, setSection] = useState("");
    const [instructions, setInstructions] = useState("");
    const [consent, setConsent] = useState(false);
    const [copied, setCopied] = useState(false);

    const dirty = text !== saved;
    const headings = useMemo(() => listHeadingPaths(text), [text]);
    const filename = draft.type === "README" ? "README.md" : "API.md";

    useEffect(() => {
        try {
            if (text === saved) sessionStorage.removeItem(backupKey(draft.id));
            else sessionStorage.setItem(backupKey(draft.id), text);
        } catch {
            /* ignore */
        }
    }, [text, saved, draft.id]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    async function onSave() {
        setBusy("save");
        setMessage(null);
        try {
            const updated = await saveDraft(draft.id, text, token);
            setSaved(updated.contentMarkdown);
            onChange(updated);
            setMessage({ kind: "ok", text: "Saved." });
        } catch (err) {
            setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Could not save. Your edits are kept in this tab." });
        } finally {
            setBusy(null);
        }
    }

    async function onRegenerate() {
        if (!section) return;
        if (dirty && !window.confirm("Unsaved edits will be saved before regenerating. Continue?")) return;
        setBusy("regen");
        setMessage(null);
        try {
            if (dirty) {
                const s = await saveDraft(draft.id, text, token);
                setSaved(s.contentMarkdown);
            }
            const updated = await regenerateSection(
                draft.id,
                { headingPath: section, instructions: instructions.trim() || undefined, consentHostedInference: hosted ? true : undefined },
                token,
            );
            setText(updated.contentMarkdown);
            setSaved(updated.contentMarkdown);
            onChange(updated);
            setMessage({ kind: "ok", text: `Section "${section}" regenerated.` });
        } catch (err) {
            setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Could not regenerate the section." });
        } finally {
            setBusy(null);
        }
    }

    async function onCopy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setMessage({ kind: "error", text: "Copy failed. Select the text in the editor and copy it manually." });
        }
    }

    const btn = "rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700";

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="View" className="flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
                    {(["preview", "edit"] as const).map((t) => (
                        <button
                            key={t}
                            role="tab"
                            aria-selected={tab === t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1.5 text-sm ${tab === t ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : ""}`}
                        >
                            {t === "preview" ? "Preview" : "Edit"}
                        </button>
                    ))}
                </div>
                <button onClick={onSave} disabled={!dirty || busy !== null} className={btn}>
                    {busy === "save" ? "Saving…" : "Save edits"}
                </button>
                <button onClick={onCopy} className={btn}>{copied ? "Copied" : "Copy Markdown"}</button>
                <button onClick={() => downloadMarkdown(filename, text)} className={btn}>Download {filename}</button>
                {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>}
            </div>

            {message && (
                <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                    {message.text}
                </p>
            )}

            {tab === "edit" ? (
                <textarea
                    aria-label={`${filename} Markdown`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    spellCheck={false}
                    className="h-[60vh] w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm dark:border-neutral-700"
                />
            ) : (
                <div className="min-h-[40vh] rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
                    <MarkdownPreview markdown={text} />
                </div>
            )}

            <section aria-labelledby="regen-h" className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <h2 id="regen-h" className="font-medium">Regenerate one section</h2>
                {headings.length === 0 ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">This document has no headings to regenerate.</p>
                ) : (
                    <>
                        <div>
                            <label htmlFor="regen-section" className="block text-sm">Section</label>
                            <select id="regen-section" value={section} onChange={(e) => setSection(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700">
                                <option value="">Choose a section</option>
                                {headings.map((h, i) => (
                                    <option key={i} value={h} className="text-black">{h}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="regen-instr" className="block text-sm">Instructions (optional)</label>
                            <input id="regen-instr" maxLength={1000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Explain the steps more clearly." className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700" />
                        </div>
                        {hosted && (
                            <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                                I agree that source excerpts are sent to the hosted AI provider.
                            </label>
                        )}
                        <button onClick={onRegenerate} disabled={!section || busy !== null || (hosted && !consent)} className={btn}>
                            {busy === "regen" ? "Regenerating…" : "Regenerate section"}
                        </button>
                    </>
                )}
            </section>
        </div>
    );
}