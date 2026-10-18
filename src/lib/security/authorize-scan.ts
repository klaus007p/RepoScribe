import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/error";
import { extractBearerToken, tokenMatchesHash } from "./capability-token";

export async function authorizeScan(request: Request, scanId: string) {
    const token = extractBearerToken(request);
    if (!token) throw new AppError("UNAUTHORIZED", 401, "Missing or malformed access token.");

    const scan = await prisma.repositoryScan.findUnique({ where: { id: scanId } });
    if (!scan || scan.expiresAt <= new Date()) {
        throw new AppError("NOT_FOUND", 404, "Scan not found or expired.");
    }
    if (!tokenMatchesHash(token, scan.accessTokenHash)) {
        throw new AppError("FORBIDDEN", 403, "Invalid access token.");
    }
    return scan;
}