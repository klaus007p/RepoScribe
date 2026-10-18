import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RATE_LIMITS, RETENTION_MS } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { toJson } from "@/lib/db/json";
import { branchSchema } from "@/lib/github/validate-repository-url";
import { errorResponse } from "@/lib/http/error";
import { parseJsonBody } from "@/lib/http/parse-body";
import { inspectRepository } from "@/lib/repository/inspect-repository";
import { buildScanResponse } from "@/lib/repository/scan.response";
import { generateAccessToken } from "@/lib/security/capability-token";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";


export const maxDuration = 60;

const bodySchema = z.object({
    repositoryUrl: z.string().trim().min(1).max(300),
    branch: z.preprocess((v) => (v === "" || v === null ? undefined : v), branchSchema.optional()),
});

export async function POST(request: Request) {
    const requestId = randomUUID();
    try {
        rateLimit(`inspect:${clientKey(request)}`, RATE_LIMITS.inspect);
        const body = await parseJsonBody(request, bodySchema);

        const result = await inspectRepository(body.repositoryUrl, body.branch);
        const { token, hash } = generateAccessToken();

        const scan = await prisma.repositoryScan.create({
            data: {
                owner: result.parsed.owner,
                repository: result.parsed.repo,
                repositoryUrl: result.parsed.url,
                requestedRef: body.branch ?? null,
                resolvedRef: result.tree.resolvedRef,
                commitSha: result.tree.commitSha,
                defaultBranch: result.tree.defaultBranch,
                accessTokenHash: hash,
                status: "READY",
                repositoryFacts: toJson(result.facts),
                fileManifest: toJson(result.fileManifest),
                detectedStack: toJson(result.facts.stack),
                warnings: toJson(result.facts.warnings),
                filesScanned: result.filesScanned,
                filesSkipped: result.filesSkipped,
                expiresAt: new Date(Date.now() + RETENTION_MS),
            },
        });

        return NextResponse.json(
            { ...buildScanResponse(scan), sessionToken: token },
            { status: 201, headers: { "Cache-Control": "no-store" } },
        );
    } catch (err) {
        return errorResponse(err, requestId);
    }
}