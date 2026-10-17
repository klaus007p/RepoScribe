import "dotenv/config";
import { getRepositoryTree } from "@/lib/github/get-repository-tree";

getRepositoryTree("vercel", "next-learn").then((t) =>
    console.log(t.resolvedRef, t.commitSha, t.entries.length, t.warnings),
);