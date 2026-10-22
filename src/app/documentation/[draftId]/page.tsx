import { Suspense } from "react";
import { DocumentationView } from "@/components/documentation-view";

async function DraftContent({ params }: { params: Promise<{ draftId: string }> }) {
    const { draftId } = await params;
    return <DocumentationView draftId={draftId} />;
}

export default function DocumentationPage({ params }: { params: Promise<{ draftId: string }> }) {
    return (
        <main className="mx-auto max-w-6xl px-4 py-8">
            <Suspense fallback={<p role="status" className="py-12 text-sm">Loading…</p>}>
                <DraftContent params={params} />
            </Suspense>
        </main>
    );
}