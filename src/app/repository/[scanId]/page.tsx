import { Suspense } from "react";
import { RepositoryView } from "@/components/repository-view";

async function ScanContent({ params }: { params: Promise<{ scanId: string }> }) {
    const { scanId } = await params;
    return <RepositoryView scanId={scanId} />;
}

export default function RepositoryPage({ params }: { params: Promise<{ scanId: string }> }) {
    return (
        <main className="mx-auto max-w-4xl px-4 py-8">
            <Suspense fallback={<p role="status" className="py-12 text-sm">Loading…</p>}>
                <ScanContent params={params} />
            </Suspense>
        </main>
    );
}