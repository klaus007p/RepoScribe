import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        repositoryScan: { findUnique: vi.fn() },
        documentationDraft: { findUnique: vi.fn() },
    },
}));

import { prisma } from "@/lib/db/prisma";
import { generateAccessToken } from "@/lib/security/capability-token";
import { authorizeDraft } from "@/lib/security/authorize-draft";
import { authorizeScan } from "@/lib/security/authorize-scan";

const { token, hash } = generateAccessToken();
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 1000);
const req = (t?: string) => new Request("http://x", { headers: t ? { authorization: `Bearer ${t}` } : {} });
const scan = (over = {}) => ({ id: "s1", accessTokenHash: hash, expiresAt: future, ...over });
const draft = (over = {}) => ({ id: "d1", scanId: "s1", expiresAt: future, scan: scan(), ...over });

beforeEach(() => vi.resetAllMocks());

describe("authorizeScan", () => {
    it("rejects missing and malformed tokens with 401", async () => {
        await expect(authorizeScan(req(), "s1")).rejects.toMatchObject({ status: 401 });
        await expect(authorizeScan(req("short"), "s1")).rejects.toMatchObject({ status: 401 });
    });

    it("returns 404 for unknown or expired scans", async () => {
        vi.mocked(prisma.repositoryScan.findUnique).mockResolvedValue(null);
        await expect(authorizeScan(req(token), "s1")).rejects.toMatchObject({ status: 404 });
        vi.mocked(prisma.repositoryScan.findUnique).mockResolvedValue(scan({ expiresAt: past }) as never);
        await expect(authorizeScan(req(token), "s1")).rejects.toMatchObject({ status: 404 });
    });

    it("rejects a wrong token with 403 and accepts the right one", async () => {
        vi.mocked(prisma.repositoryScan.findUnique).mockResolvedValue(scan() as never);
        await expect(authorizeScan(req(generateAccessToken().token), "s1")).rejects.toMatchObject({ status: 403 });
        await expect(authorizeScan(req(token), "s1")).resolves.toMatchObject({ id: "s1" });
    });
});

describe("authorizeDraft", () => {
    it("requires a token", async () => {
        await expect(authorizeDraft(req(), "d1")).rejects.toMatchObject({ status: 401 });
    });

    it("returns 404 for unknown, expired or orphaned-by-expiry drafts", async () => {
        vi.mocked(prisma.documentationDraft.findUnique).mockResolvedValue(null);
        await expect(authorizeDraft(req(token), "d1")).rejects.toMatchObject({ status: 404 });
        vi.mocked(prisma.documentationDraft.findUnique).mockResolvedValue(draft({ expiresAt: past }) as never);
        await expect(authorizeDraft(req(token), "d1")).rejects.toMatchObject({ status: 404 });
        vi.mocked(prisma.documentationDraft.findUnique).mockResolvedValue(draft({ scan: scan({ expiresAt: past }) }) as never);
        await expect(authorizeDraft(req(token), "d1")).rejects.toMatchObject({ status: 404 });
    });

    it("checks the token against the owning scan", async () => {
        vi.mocked(prisma.documentationDraft.findUnique).mockResolvedValue(draft() as never);
        await expect(authorizeDraft(req(generateAccessToken().token), "d1")).rejects.toMatchObject({ status: 403 });

        const ok = await authorizeDraft(req(token), "d1");
        expect(ok.draft.id).toBe("d1");
        expect(ok.scan.id).toBe("s1");
        expect("scan" in ok.draft).toBe(false);
    });
});