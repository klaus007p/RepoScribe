
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RepoScribe",
  description: "Evidence-based README and API documentation for public GitHub repositories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen antialiased">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">RepoScribe</Link>
            <span className="text-xs text-neutral-500">Open-weight documentation drafts</span>
          </nav>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-500">
          Drafts are AI-generated from repository facts. Review before publishing. Scans are deleted after 7 days.
        </footer>
      </body>
    </html>
  );
}
