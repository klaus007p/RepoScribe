import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/http/error";
import { extractBearerToken, tokenMatchesHash } from "./capability-token";

export async function authorizeDraft(request: Request, draftId: string) {
    const token = extractBearerToken(request);
    if (!token) throw new AppError("UNAUTHORIZED", 401, "Missing or malformed access token.");

    const found = await prisma.documentationDraft.findUnique({
        where: { id: draftId },
        include: { scan: true },
    });
    const now = new Date();
    if (!found || found.expiresAt <= now || found.scan.expiresAt <= now) {
        throw new AppError("NOT_FOUND", 404, "Draft not found or expired.");
    }
    if (!tokenMatchesHash(token, found.scan.accessTokenHash)) {
        throw new AppError("FORBIDDEN", 403, "Invalid access token.");
    }

    const { scan, ...draft } = found;
    return { draft, scan };
}