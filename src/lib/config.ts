


export const LIMITS = {
    maxTreeEntries: 10_000,
    maxFilesSelected: 200,
    maxFileBytes: 100 * 1024,
    maxTotalSourceBytes: 2 * 1024 * 1024,
    githubTimeoutMs: 10_000,
} as const;

export const AI = {
    maxPromptChars: 40_000,
    maxOutputTokens: 4096,
    ollamaNumCtx: 16384,
    ollamaTimeoutMs: 180_000,
    openrouterTimeoutMs: 90_000,
    temperature: 0.2,
} as const;



export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const isProd = process.env.NODE_ENV === "production";

export const RATE_LIMITS = {
    inspect: { limit: isProd ? 5 : 100, windowMs: 10 * 60_000 },
    generate: { limit: isProd ? 10 : 100, windowMs: 10 * 60_000 },
    regenerate: { limit: isProd ? 30 : 200, windowMs: 10 * 60_000 },
    edit: { limit: isProd ? 120 : 1000, windowMs: 10 * 60_000 },
      feedback: { limit: isProd ? 30 : 200, windowMs: 10 * 60_000 },
} as const;