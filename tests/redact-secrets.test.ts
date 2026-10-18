import { describe, it, expect } from "vitest";
import { redactSecrets } from "@/lib/security/redact-secrets";

describe("redactSecrets", () => {
    it("redacts GitHub tokens once", () => {
        const token = "ghp_" + "a".repeat(36);
        const { text, count } = redactSecrets(`const token = "${token}";`);
        expect(text).not.toContain(token);
        expect(count).toBe(1);
    });

    it("redacts assigned secrets", () => {
        const { text } = redactSecrets(`const apiKey = "supersecretvalue123";`);
        expect(text).toContain(`apiKey = "[REDACTED]"`);
    });

    it("redacts dotenv values but keeps names and harmless values", () => {
        const { text } = redactSecrets("OPENAI_API_KEY=abcdefghijkl\nPORT=3000");
        expect(text).toContain("OPENAI_API_KEY=[REDACTED]");
        expect(text).toContain("PORT=3000");
    });

    it("redacts connection string passwords", () => {
        const { text } = redactSecrets(`DATABASE_URL="postgresql://user:hunter2pass@localhost:5432/db"`);
        expect(text).toContain("postgresql://user:[REDACTED]@localhost");
        expect(text).not.toContain("hunter2pass");
    });

    it("preserves line count when redacting private keys", () => {
        const input = "a\n-----BEGIN RSA PRIVATE KEY-----\nabc\ndef\n-----END RSA PRIVATE KEY-----\nb";
        const { text } = redactSecrets(input);
        expect(text.split("\n").length).toBe(input.split("\n").length);
        expect(text).not.toContain("abc");
    });
});