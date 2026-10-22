import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { RATE_LIMITS } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/http/error";
import { parseJsonBody } from "@/lib/http/parse-body";
import { authorizeDraft } from "@/lib/security/authorize-draft";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { feedbackBodySchema } from "@/lib/validation/api-schemas";

export async function POST(request: Request) {
    const requestId = randomUUID();
    try {
        rateLimit(`feedback:${clientKey(request)}`, RATE_LIMITS.feedback);
        const body = await parseJsonBody(request, feedbackBodySchema);
        await authorizeDraft(request, body.draftId);

        const data = {
            rating: body.rating,
            reason: body.reason ?? null,
            comment: body.comment || null,
            wouldUseAgain: body.wouldUseAgain ?? null,
        };
        const saved = await prisma.feedback.upsert({
            where: { draftId: body.draftId },
            create: { draftId: body.draftId, ...data },
            update: data,
        });
        return NextResponse.json({ id: saved.id, saved: true }, { status: 201 });
    } catch (err) {
        return errorResponse(err, requestId);
    }
}