import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/http/error";

export function assertHostedConsent(consent: boolean | undefined): void {
    if (getEnv().AI_PROVIDER === "openrouter" && consent !== true) {
        throw new AppError(
            "INVALID_INPUT",
            400,
            "This server uses a hosted AI provider, so selected source excerpts are sent to an external service. Confirm consent to continue.",
        );
    }
}