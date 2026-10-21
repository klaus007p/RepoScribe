import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { assertHostedConsent } from "@/lib/ai/consent";
import { RATE_LIMITS } from "@/lib/config";
import { toJson } from "@/lib/db/json";
import { prisma } from "@/lib/db/prisma";
import { buildDraftResponse, readReferences } from "@/lib/documentation/draft-response";
import { regenerateSection } from "@/lib/documentation/regenerate-sections";
import { errorResponse } from "@/lib/http/error";
import { parseJsonBody } from "@/lib/http/parse-body";
import { parseStoredFacts, parseStoredManifest } from "@/lib/repository/scan.response";
import { authorizeDraft } from "@/lib/security/authorize-draft";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { regenerateBodySchema } from "@/lib/validation/api-schemas";

export const maxDuration = 300;

type Ctx = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, { params }: Ctx) {
    const requestId = randomUUID();
    try {
        rateLimit(`regenerate:${clientKey(request)}`, RATE_LIMITS.regenerate);
        const { draftId } = await params;
        const { draft, scan } = await authorizeDraft(request, draftId);
        const body = await parseJsonBody(request, regenerateBodySchema);
        assertHostedConsent(body.consentHostedInference);

        const result = await regenerateSection({
            type: draft.type,
            markdown: draft.contentMarkdown,
            headingPath: body.headingPath,
            instructions: body.instructions,
            existingReferences: readReferences(draft.sourceReferences),
            ctx: { facts: parseStoredFacts(scan), manifest: parseStoredManifest(scan) },
        });

        const updated = await prisma.documentationDraft.update({
            where: { id: draftId },
            data: {
                contentMarkdown: result.markdown,
                sourceReferences: toJson(result.sourceReferences),
                warnings: toJson(result.warnings),
                status: "EDITED",
            },
        });

        return NextResponse.json(
            { ...buildDraftResponse(updated), regeneratedSection: body.headingPath },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (err) {
        return errorResponse(err, requestId);
    }
}