import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/http/error";
import { buildScanResponse, parseStoredFacts } from "@/lib/repository/scan.response";
import { authorizeScan } from "@/lib/security/authorize-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ scanId: string }> };

export async function GET(request: Request, { params }: Ctx) {
    const requestId = randomUUID();
    try {
        const { scanId } = await params;
        const scan = await authorizeScan(request, scanId);
        return NextResponse.json(
            { ...buildScanResponse(scan), facts: parseStoredFacts(scan) },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (err) {
        return errorResponse(err, requestId);
    }
}

export async function DELETE(request: Request, { params }: Ctx) {
    const requestId = randomUUID();
    try {
        const { scanId } = await params;
        await authorizeScan(request, scanId);
        await prisma.repositoryScan.delete({ where: { id: scanId } }); // drafts + feedback cascade
        return NextResponse.json({ deleted: true });
    } catch (err) {
        return errorResponse(err, requestId);
    }
}