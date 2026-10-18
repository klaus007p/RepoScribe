import { describe, it, expect } from "vitest";
import {
    extractBearerToken,
    generateAccessToken,
    hashToken,
    tokenMatchesHash,
} from "@/lib/security/capability-token";
import { rateLimit } from "@/lib/security/rate-limit";

describe("capability tokens", () => {
    it("generates a token whose hash is 64 hex chars and never equals the token", () => {
        const { token, hash } = generateAccessToken();
        expect(token.length).toBeGreaterThanOrEqual(40);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toBe(token);
    });

    it("matches only the right token", () => {
        const { token, hash } = generateAccessToken();
        expect(tokenMatchesHash(token, hash)).toBe(true);
        expect(tokenMatchesHash(generateAccessToken().token, hash)).toBe(false);
        expect(tokenMatchesHash(token, "not-hex")).toBe(false);
        expect(hashToken(token)).toBe(hash);
    });

    it("extracts bearer tokens strictly", () => {
        const { token } = generateAccessToken();
        const ok = new Request("http://x", { headers: { authorization: `Bearer ${token}` } });
        expect(extractBearerToken(ok)).toBe(token);
        expect(extractBearerToken(new Request("http://x"))).toBeNull();
        expect(
            extractBearerToken(new Request("http://x", { headers: { authorization: "Basic abc" } })),
        ).toBeNull();
    });
});

describe("rateLimit", () => {
    const rule = { limit: 2, windowMs: 1000 };

    it("blocks after the limit and resets after the window", () => {
        rateLimit("t1", rule, 0);
        rateLimit("t1", rule, 10);
        expect(() => rateLimit("t1", rule, 20)).toThrow(/Too many requests/);
        expect(() => rateLimit("t1", rule, 1001)).not.toThrow();
    });

    it("keeps keys independent", () => {
        rateLimit("a", rule, 0);
        rateLimit("a", rule, 0);
        expect(() => rateLimit("b", rule, 0)).not.toThrow();
    });
});