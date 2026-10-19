import "dotenv/config";
import { inspectRepository } from "@/lib/repository/inspect-repository";
import { getProvider } from "@/lib/ai/provider";

async function main() {
    const { facts } = await inspectRepository("https://github.com/klaus007p/TouchQuestAI");
    const provider = getProvider();
    const type = process.argv[2] === "README" ? "README" : "API";
    const out = await provider.generateDocumentation({
        documentType: type,
        repositoryFacts: facts,
        sourceExcerpts: [],
    });
    console.log(out.meta);
    console.log(out.warnings);
    console.log(out.markdown);
}

main().catch((e) => console.error(e.code, e.message));