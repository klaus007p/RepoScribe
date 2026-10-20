import "dotenv/config";
import { inspectRepository } from "@/lib/repository/inspect-repository";
import { generateApiDocs } from "@/lib/documentation/generate-api-docs";
import { generateReadme } from "@/lib/documentation/generate-readme";
import { fileManifestSchema } from "@/lib/validation/repository-schemas";

async function main() {
    const url = process.argv[3] ?? "https://github.com/klaus007p/TouchQuestAI";
    const { facts, fileManifest } = await inspectRepository(url);
    const ctx = { facts, manifest: fileManifestSchema.parse(fileManifest) };

    const draft = process.argv[2] === "README" ? await generateReadme(ctx) : await generateApiDocs(ctx);
    console.log("META:", draft.meta);
    console.log("\nWARNINGS:");
    draft.warnings.forEach((w) => console.log(" -", w));
    console.log("\nREFERENCES:", draft.sourceReferences.length);
    console.log("\n" + draft.markdown);
}

main().catch((e) => console.error(e.code ?? "", e.message));