import { AppError } from "@/lib/http/error";

interface Bucket {
    count: number;
    resetAt: number;
}
export interface RateLimitRule {
    limit: number;
    windowMs: number;
}

const buckets = new Map<string, Bucket>();

export function clientKey(request: Request): string {
    const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, rule: RateLimitRule, now = Date.now()): void {
    if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
        return;
    }
    if (bucket.count >= rule.limit) {
        const secs = Math.ceil((bucket.resetAt - now) / 1000);
        throw new AppError("RATE_LIMITED", 429, `Too many requests. Try again in ${secs} second(s).`, true);
    }
    bucket.count++;
}