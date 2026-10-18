import type { z } from "zod";
import { AppError } from "./error";

export async function parseJsonBody<T>(
    request: Request,
    schema: z.ZodType<T>,
    maxBytes = 20_000,
): Promise<T> {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
        throw new AppError("PAYLOAD_TOO_LARGE", 413, "Request body is too large.");
    }
    const text = await request.text();
    if (text.length > maxBytes) {
        throw new AppError("PAYLOAD_TOO_LARGE", 413, "Request body is too large.");
    }

    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new AppError("INVALID_INPUT", 400, "Request body must be valid JSON.");
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const where = issue?.path.map(String).join(".");
        throw new AppError(
            "INVALID_INPUT",
            400,
            where ? `Invalid "${where}": ${issue.message}` : "Invalid request body.",
        );
    }
    return parsed.data;
}