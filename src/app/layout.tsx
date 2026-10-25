import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoScribe",
  description: "Evidence-based README and API documentation for public GitHub repositories.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-400 font-mono text-sm font-bold text-neutral-950">
                R
              </span>
              RepoScribe
            </Link>
            <span className="hidden text-xs text-neutral-400 sm:block">Open-weight documentation drafts</span>
          </nav>
        </header>

        {children}

        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-neutral-500">
          Drafts are AI-generated from repository facts. Review before publishing. Scans are deleted after 7 days.
        </footer>
      </body>
    </html>
  );
}