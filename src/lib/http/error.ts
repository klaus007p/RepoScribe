import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export type ErrorCode =
    | "INVALID_INPUT" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"
    | "PAYLOAD_TOO_LARGE" | "UNPROCESSABLE_REPOSITORY" | "RATE_LIMITED"
    | "AI_BAD_RESPONSE" | "PROVIDER_UNAVAILABLE" | "INTERNAL_ERROR";

export class AppError extends Error {
    constructor(
        public code: ErrorCode,
        public status: number,
        message: string,
        public retryable = false,
    ) {
        super(message);
    }
}

export function errorResponse(err: unknown, requestId = randomUUID()) {
    if (err instanceof AppError) {
        return NextResponse.json(
            { error: { code: err.code, message: err.message, retryable: err.retryable, requestId } },
            { status: err.status },
        );
    }
    console.error(`[${requestId}] unexpected error`,
        process.env.NODE_ENV === "production" ? (err instanceof Error ? err.name : "unknown") : err,);
    return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong.", retryable: true, requestId } },
        { status: 500 },
    );
}