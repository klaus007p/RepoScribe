import { z } from "zod";

const envSchema = z
    .object({
        DATABASE_URL: z.string().min(1),
        GITHUB_TOKEN: z.string().optional(),
        AI_PROVIDER: z.enum(["ollama", "openrouter"]).default("ollama"),
        OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
        OLLAMA_MODEL: z.string().default("qwen2.5-coder:7b"),
        OPENROUTER_API_KEY: z.string().optional(),
        OPENROUTER_MODEL: z.string().optional(),
        APP_URL: z.string().url().default("http://localhost:3000"),
        UPSTASH_REDIS_REST_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
        UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
        CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
    })
    .superRefine((v, ctx) => {
        if (v.AI_PROVIDER === "openrouter") {
            if (!v.OPENROUTER_API_KEY)
                ctx.addIssue({ code: "custom", path: ["OPENROUTER_API_KEY"], message: "Required for openrouter" });
            if (!v.OPENROUTER_MODEL)
                ctx.addIssue({ code: "custom", path: ["OPENROUTER_MODEL"], message: "Required for openrouter" });
        }
    });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
    if (cached) return cached;
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
        throw new Error(`Invalid environment configuration: ${fields}`);
    }
    cached = parsed.data;
    return cached;
}