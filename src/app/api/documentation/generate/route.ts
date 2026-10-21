import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { assertHostedConsent } from "@/lib/ai/consent";
import { RATE_LIMITS } from "@/lib/config";
import { toJson } from "@/lib/db/json";
import { prisma } from "@/lib/db/prisma";
import { buildDraftResponse } from "@/lib/documentation/draft-response";
import { generateApiDocs } from "@/lib/documentation/generate-api-docs";
import { generateReadme } from "@/lib/documentation/generate-readme";
import { AppError, errorResponse } from "@/lib/http/error";
import { parseJsonBody } from "@/lib/http/parse-body";
import { parseStoredFacts, parseStoredManifest } from "@/lib/repository/scan.response";
import { authorizeScan } from "@/lib/security/authorize-scan";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { generateBodySchema } from "@/lib/validation/api-schemas";

export const maxDuration = 300;

export async function POST(request: Request) {
    const requestId = randomUUID();
    try {
        rateLimit(`generate:${clientKey(request)}`, RATE_LIMITS.generate);
        const body = await parseJsonBody(request, generateBodySchema);
        const scan = await authorizeScan(request, body.scanId);
        if (scan.status !== "READY") {
            throw new AppError("UNPROCESSABLE_REPOSITORY", 422, "This scan is not ready for generation.");
        }
        assertHostedConsent(body.consentHostedInference);

        const ctx = {
            facts: parseStoredFacts(scan),
            manifest: parseStoredManifest(scan),
            instructions: body.instructions,
        };

        const results = [];
        for (const type of body.documents) {
            results.push(type === "README" ? await generateReadme(ctx) : await generateApiDocs(ctx));
        }

        const drafts = await prisma.$transaction(
            results.map((r) =>
                prisma.documentationDraft.create({
                    data: {
                        scanId: scan.id,
                        type: r.type,
                        contentMarkdown: r.markdown,
                        sourceReferences: toJson(r.sourceReferences),
                        warnings: toJson(r.warnings),
                        provider: r.meta?.provider,
                        modelId: r.meta?.modelId,
                        promptVersion: r.meta?.promptVersion,
                        durationMs: r.meta?.durationMs,
                        inputTokens: r.meta?.inputTokens,
                        outputTokens: r.meta?.outputTokens,
                        expiresAt: scan.expiresAt,
                    },
                }),
            ),
        );

        return NextResponse.json(
            { scanId: scan.id, drafts: drafts.map(buildDraftResponse) },
            { status: 201, headers: { "Cache-Control": "no-store" } },
        );
    } catch (err) {
        return errorResponse(err, requestId);
    }
}