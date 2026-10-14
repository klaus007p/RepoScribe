-- CreateEnum
CREATE TYPE "RepositoryScanStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('README', 'API');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('GENERATED', 'EDITED');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('OLLAMA', 'OPENROUTER');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('USEFUL', 'PARTIALLY_USEFUL', 'NOT_USEFUL');

-- CreateEnum
CREATE TYPE "FeedbackReason" AS ENUM ('FACTUALLY_INCORRECT', 'MISSING_INFORMATION', 'WRONG_API_ROUTE', 'POOR_FORMATTING', 'OTHER');

-- CreateTable
CREATE TABLE "RepositoryScan" (
    "id" TEXT NOT NULL,
    "owner" VARCHAR(100) NOT NULL,
    "repository" VARCHAR(100) NOT NULL,
    "repositoryUrl" VARCHAR(500) NOT NULL,
    "requestedRef" VARCHAR(255),
    "resolvedRef" VARCHAR(255),
    "commitSha" VARCHAR(64),
    "defaultBranch" VARCHAR(255),
    "accessTokenHash" VARCHAR(64) NOT NULL,
    "status" "RepositoryScanStatus" NOT NULL DEFAULT 'PENDING',
    "repositoryFacts" JSONB,
    "fileManifest" JSONB,
    "detectedStack" JSONB,
    "warnings" JSONB,
    "filesScanned" INTEGER NOT NULL DEFAULT 0,
    "filesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationDraft" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'GENERATED',
    "contentMarkdown" TEXT NOT NULL,
    "sourceReferences" JSONB,
    "warnings" JSONB,
    "provider" "AIProvider",
    "modelId" VARCHAR(200),
    "promptVersion" VARCHAR(50),
    "durationMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "reason" "FeedbackReason",
    "comment" VARCHAR(500),
    "wouldUseAgain" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryScan_accessTokenHash_key" ON "RepositoryScan"("accessTokenHash");

-- CreateIndex
CREATE INDEX "RepositoryScan_owner_repository_createdAt_idx" ON "RepositoryScan"("owner", "repository", "createdAt");

-- CreateIndex
CREATE INDEX "RepositoryScan_expiresAt_idx" ON "RepositoryScan"("expiresAt");

-- CreateIndex
CREATE INDEX "DocumentationDraft_scanId_type_createdAt_idx" ON "DocumentationDraft"("scanId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentationDraft_expiresAt_idx" ON "DocumentationDraft"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_draftId_key" ON "Feedback"("draftId");

-- AddForeignKey
ALTER TABLE "DocumentationDraft" ADD CONSTRAINT "DocumentationDraft_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "RepositoryScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DocumentationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
