import { RepositoryForm } from "@/components/repository-form";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">RepoScribe</h1>
      <p className="mt-3 text-neutral-700 dark:text-neutral-300">
        Generate a README and API reference from the code in a public GitHub repository. RepoScribe reads
        your project files, extracts verifiable facts (scripts, routes, environment variables), and drafts
        documentation from them with an open-weight model. You review and edit everything before using it.
      </p>

      <section className="mt-8 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <RepositoryForm />
      </section>

      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium">What is supported</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>Public GitHub repositories only</li>
            <li>TypeScript and JavaScript projects with a package.json</li>
            <li>API routes in Next.js App Router and Express</li>
            <li>Other frameworks are listed with a warning, and no routes are guessed</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-medium">Limits and privacy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>Up to 200 files, 100 KB per file and 2 MB in total are read</li>
            <li>Secret files such as .env are skipped, and secret-like values are redacted</li>
            <li>Repository code is never executed, and nothing is pushed to your repository</li>
            <li>Scans and drafts are deleted after 7 days</li>
          </ul>
        </div>
      </section>
    </main>
  );
}