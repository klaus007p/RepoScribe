import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
            <p className="font-mono text-sm text-emerald-400">404</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
            <p className="mt-3 text-neutral-400">This page doesn&apos;t exist, or the scan it belonged to has expired.</p>
            <Link href="/" className="mt-6 inline-block rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300">
                Back to RepoScribe
            </Link>
        </main>
    );
}