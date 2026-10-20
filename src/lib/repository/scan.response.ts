import type { RepositoryScan } from "@prisma/client";
import { AppError } from "@/lib/http/error";
import {
    fileManifestSchema,
    repositoryFactsSchema,
    type FileManifest,
    type RepositoryFacts,
} from "@/lib/validation/repository-schemas";

export function parseStoredFacts(scan: RepositoryScan): RepositoryFacts {
    const r = repositoryFactsSchema.safeParse(scan.repositoryFacts);
    if (!r.success) throw new AppError("INTERNAL_ERROR", 500, "Stored scan data is invalid.");
    return r.data;
}

export function parseStoredManifest(scan: RepositoryScan): FileManifest {
    const r = fileManifestSchema.safeParse(scan.fileManifest);
    if(!r.success) throw new AppError("INTERNAL_ERROR", 500, "Stored scan data is invalid.");
    return r.data;
}

export function buildScanResponse(scan: RepositoryScan) {
    const facts = parseStoredFacts(scan);
    return {
        scanId: scan.id,
        repository: {
            owner: scan.owner,
            name: scan.repository,
            url: scan.repositoryUrl,
            branch: scan.resolvedRef,
            commitSha: scan.commitSha,
        },
        status: scan.status,
        summary: {
            detectedStack: facts.stack.technologies,
            filesScanned: scan.filesScanned,
            filesSkipped: scan.filesSkipped,
            readmeExists: facts.existingDocs.readmePath !== null,
            apiRoutesFound: facts.routes.length,
        },
        warnings: facts.warnings,
        expiresAt: scan.expiresAt.toISOString(),
    };
}