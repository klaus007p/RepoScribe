import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: hashToken(token) };
}

export function extractBearerToken(request: Request): string | null {
    const header = request.headers.get("authorization") ?? "";
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(header);
    return m ? m[1] : null;
}

export function tokenMatchesHash(token: string, storedHash: string): boolean {
    const a = Buffer.from(hashToken(token), "hex");
    const b = Buffer.from(storedHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
}