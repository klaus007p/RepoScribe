import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { RATE_LIMITS } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { buildDraftResponse } from "@/lib/documentation/draft-response";
import { errorResponse } from "@/lib/http/error";
import { parseJsonBody } from "@/lib/http/parse-body";
import { authorizeDraft } from "@/lib/security/authorize-draft";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { MAX_MARKDOWN_BODY_BYTES, patchDraftBodySchema } from "@/lib/validation/api-schemas";

type Ctx = { params: Promise<{ draftId: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: Ctx) {
    const requestId = randomUUID();
    try {
        const { draftId } = await params;
        const { draft } = await authorizeDraft(request, draftId);
        return NextResponse.json(buildDraftResponse(draft), { headers: noStore });
    } catch (err) {
        return errorResponse(err, requestId);
    }
}

export async function PATCH(request: Request, { params }: Ctx) {
    const requestId = randomUUID();
    try {
        rateLimit(`edit:${clientKey(request)}`, RATE_LIMITS.edit);
        const { draftId } = await params;
        await authorizeDraft(request, draftId);
        const body = await parseJsonBody(request, patchDraftBodySchema, MAX_MARKDOWN_BODY_BYTES);

        const updated = await prisma.documentationDraft.update({
            where: { id: draftId },
            data: { contentMarkdown: body.contentMarkdown, status: "EDITED" },
        });
        return NextResponse.json(buildDraftResponse(updated), { headers: noStore });
    } catch (err) {
        return errorResponse(err, requestId);
    }
}