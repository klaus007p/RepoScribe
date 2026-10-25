import { RepositoryForm } from "@/components/repository-form";

const STEPS = [
  {
    n: "01",
    title: "Inspect",
    text: "Paste a public GitHub URL. RepoScribe pins a commit and reads manifests, routes and config. Nothing is executed.",
  },
  {
    n: "02",
    title: "Generate",
    text: "An open-weight model drafts a README and API reference from extracted facts, not guesses.",
  },
  {
    n: "03",
    title: "Verify and edit",
    text: "Scripts, routes and env vars are checked against the source. You review, edit and download.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-8 pt-14 sm:pt-20">
      <div className="text-center">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Open-weight AI · Evidence-based
        </p>
        <h1 className="mt-5 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
          Documentation that
          <br />
          matches your code
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-neutral-400 sm:text-lg">
          Generate a README and an API reference from a public GitHub repository. Every script, route and
          environment variable is checked against the source before you see it.
        </p>
      </div>

      <section className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <RepositoryForm />
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="How it works">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-mono text-xs text-emerald-400">{s.n}</p>
            <h2 className="mt-2 font-medium">{s.title}</h2>
            <p className="mt-1.5 text-sm text-neutral-400">{s.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-neutral-200">What is supported</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-400">
            <li>Public GitHub repositories only</li>
            <li>TypeScript and JavaScript projects with a package.json</li>
            <li>API routes in Next.js App Router and Express</li>
            <li>Other frameworks get a warning, and no routes are guessed</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-neutral-200">Limits and privacy</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-400">
            <li>Up to 200 files, 100 KB each and 2 MB in total</li>
            <li>.env and key files are skipped, and secret-like values are redacted</li>
            <li>Repository code is never executed or modified</li>
            <li>Scans and drafts are deleted after 7 days</li>
          </ul>
        </div>
      </section>
    </main>
  );
}