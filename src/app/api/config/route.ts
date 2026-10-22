import { randomUUID } from "crypto";
import { connection, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http/error";

export async function GET() {
    const requestId = randomUUID();
    try {
        await connection();
        return NextResponse.json({ hostedInference: getEnv().AI_PROVIDER === "openrouter" });
    } catch (err) {
        return errorResponse(err, requestId);
    }
}