import type { RepositoryFacts } from "@/lib/validation/repository-schemas";

export class ApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public status: number,
        public retryable: boolean,
    ) {
        super(message);
    }
}

export interface ScanResponse {
    scanId: string;
    repository: { owner: string; name: string; url: string; branch: string | null; commitSha: string | null };
    status: string;
    summary: {
        detectedStack: string[];
        filesScanned: number;
        filesSkipped: number;
        readmeExists: boolean;
        apiRoutesFound: number;
    };
    warnings: string[];
    expiresAt: string;
    facts?: RepositoryFacts;
    sessionToken?: string;
}

export type DocType = "README" | "API";
export interface DraftSummary {
    id: string;
    type: DocType;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (init.body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
        res = await fetch(path, { ...init, headers, cache: "no-store" });
    } catch {
        throw new ApiError("NETWORK", "Could not reach the server. Check your connection.", 0, true);
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const e = data?.error;
        throw new ApiError(e?.code ?? "UNKNOWN", e?.message ?? "Request failed.", res.status, e?.retryable ?? false);
    }
    return data as T;
}

export const inspectRepository = (repositoryUrl: string, branch?: string) =>
    request<ScanResponse>("/api/repositories/inspect", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl, branch }),
    });

export const getScan = (scanId: string, token: string) =>
    request<ScanResponse>(`/api/repositories/${encodeURIComponent(scanId)}`, {}, token);

export const deleteScan = (scanId: string, token: string) =>
    request<{ deleted: boolean }>(`/api/repositories/${encodeURIComponent(scanId)}`, { method: "DELETE" }, token);

export const getConfig = () => request<{ hostedInference: boolean }>("/api/config");

export const generateDocuments = (
    body: { scanId: string; documents: DocType[]; instructions?: string; consentHostedInference?: boolean },
    token: string,
) =>
    request<{ scanId: string; drafts: DraftSummary[] }>(
        "/api/documentation/generate",
        { method: "POST", body: JSON.stringify(body) },
        token,
    );

// sessionStorage can throw (private mode, blocked storage), so every access is guarded.
const tokenKey = (scanId: string) => `reposcribe:token:${scanId}`;
const draftsKey = (scanId: string) => `reposcribe:drafts:${scanId}`;

export function saveToken(scanId: string, token: string): void {
    try {
        sessionStorage.setItem(tokenKey(scanId), token);
    } catch {
        /* ignore */
    }
}
export function getToken(scanId: string): string | null {
    try {
        return sessionStorage.getItem(tokenKey(scanId));
    } catch {
        return null;
    }
}
export function clearScan(scanId: string): void {
    try {
        sessionStorage.removeItem(tokenKey(scanId));
        sessionStorage.removeItem(draftsKey(scanId));
    } catch {
        /* ignore */
    }
}
export function saveDrafts(scanId: string, drafts: DraftSummary[]): void {
    try {
        sessionStorage.setItem(draftsKey(scanId), JSON.stringify(Object.fromEntries(drafts.map((d) => [d.type, d.id]))));
    } catch {
        /* ignore */
    }
}
export function getDrafts(scanId: string): Partial<Record<DocType, string>> {
    try {
        return JSON.parse(sessionStorage.getItem(draftsKey(scanId)) ?? "{}");
    } catch {
        return {};
    }
}