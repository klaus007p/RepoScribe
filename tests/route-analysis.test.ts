import { describe, it, expect } from "vitest";
import { analyzeNextjsRoutes } from "@/lib/analysis/analyze-nextjs-routes";
import { analyzeExpressRoutes } from "@/lib/analysis/analyze-express-routes";
import type { DetectedRoute } from "@/lib/analysis/route-types";

const find = (routes: DetectedRoute[], method: string, path: string) =>
    routes.find((r) => r.method === method && r.path === path);

const usersRoute = `import { NextResponse } from "next/server";
import { z } from "zod";

const createUserSchema = z.object({ name: z.string() });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  return NextResponse.json({ users: [], page });
}

export async function POST(request: Request) {
  const body = createUserSchema.parse(await request.json());
  return NextResponse.json(body, { status: 201 });
}
`;

describe("analyzeNextjsRoutes", () => {
    const { routes } = analyzeNextjsRoutes(
        [
            { path: "src/app/api/users/route.ts", content: usersRoute },
            {
                path: "src/app/api/posts/[id]/route.ts",
                content: `export const DELETE = withAuth(async () => new Response(null, { status: 204 }));`,
            },
            {
                path: "src/app/(shop)/products/[...slug]/route.ts",
                content: `export function GET() { return Response.json({}); }`,
            },
            {
                path: "src/app/api/auth/[...nextauth]/route.ts",
                content: `export const { GET, POST } = handlers;`,
            },
            { path: "src/app/_private/route.ts", content: `export function GET() { return Response.json({}); }` },
            { path: "src/lib/app/route.ts", content: `export function GET() { return Response.json({}); }` },
            { path: "src/app/health/route.ts", content: `export function GET() {\n  return Response.json({ ok: true });\n}` },
        ],
        [""],
    );

    it("extracts methods, query params, schemas and status codes", () => {
        const get = find(routes, "GET", "/api/users");
        expect(get?.queryParams).toEqual(["page"]);
        expect(get?.statusCodes).toEqual([200]);
        expect(get?.line).toBe(6);
        expect(get?.certainty).toBe("detected");

        const post = find(routes, "POST", "/api/users");
        expect(post?.validationSchemas).toEqual(["createUserSchema"]);
        expect(post?.statusCodes).toEqual([201]);
    });

    it("normalizes dynamic segments, route groups and catch-all", () => {
        const del = find(routes, "DELETE", "/api/posts/{id}");
        expect(del?.pathParams).toEqual([{ name: "id", catchAll: false, optional: false }]);
        expect(del?.statusCodes).toEqual([204]);
        expect(del?.authHints).toContain("wrapped by withAuth()");
        expect(find(routes, "GET", "/products/{...slug}")).toBeDefined();
    });

    it("marks library-delegated handlers as partial", () => {
        expect(find(routes, "GET", "/api/auth/{...nextauth}")?.certainty).toBe("partial");
        expect(find(routes, "POST", "/api/auth/{...nextauth}")?.certainty).toBe("partial");
    });

    it("ignores private folders and files outside the app directory", () => {
        expect(routes.find((r) => r.filePath.includes("_private"))).toBeUndefined();
        expect(routes.find((r) => r.filePath === "src/lib/app/route.ts")).toBeUndefined();
    });

    it("reports line numbers", () => {
        expect(find(routes, "GET", "/health")?.line).toBe(1);
    });
});

const server = `import express from "express";
import userRouter from "./routes/users";

const app = express();
app.use("/api/users", userRouter);
app.get("/health", (req, res) => {
  res.json({ ok: true });
});
`;

const usersRouter = `import { Router } from "express";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", (req, res) => {
  const { page } = req.query;
  res.json([]);
});
router.post("/", authenticate, (req, res) => {
  res.status(201).json({});
});
router.get("/:id", (req, res) => {
  res.status(404).json({ error: "not found" });
});
router.route("/:id/posts").get(listPosts).post(createPost);

export default router;
`;

describe("analyzeExpressRoutes", () => {
    const { routes } = analyzeExpressRoutes([
        { path: "src/server.ts", content: server },
        { path: "src/routes/users.ts", content: usersRouter },
    ]);

    it("finds app-level routes", () => {
        expect(find(routes, "GET", "/health")?.statusCodes).toEqual([200]);
    });

    it("applies mount prefixes across files", () => {
        const list = find(routes, "GET", "/api/users");
        expect(list?.queryParams).toEqual(["page"]);
        expect(list?.certainty).toBe("detected");
        expect(find(routes, "POST", "/api/users")?.statusCodes).toEqual([201]);
    });

    it("normalizes params and records auth middleware hints", () => {
        expect(find(routes, "GET", "/api/users/{id}")?.statusCodes).toEqual([404]);
        expect(find(routes, "POST", "/api/users")?.authHints).toContain("middleware: authenticate");
    });

    it("supports router.route() chains and notes external handlers", () => {
        const get = find(routes, "GET", "/api/users/{id}/posts");
        expect(get).toBeDefined();
        expect(get?.notes.join(" ")).toContain("listPosts");
        expect(find(routes, "POST", "/api/users/{id}/posts")).toBeDefined();
    });

    it("flags unmounted routers as partial", () => {
        const res = analyzeExpressRoutes([
            {
                path: "src/orphan.ts",
                content: `import { Router } from "express";\nconst router = Router();\nrouter.get("/x", (req, res) => res.json({}));\nexport default router;`,
            },
        ]);
        expect(res.routes).toHaveLength(1);
        expect(res.routes[0].certainty).toBe("partial");
    });

    it("flags non-literal paths instead of guessing", () => {
        const res = analyzeExpressRoutes([
            {
                path: "src/a.ts",
                content: `import express from "express";\nconst app = express();\napp.get(BASE_PATH, (req, res) => res.json({}));`,
            },
        ]);
        expect(res.routes[0].path).toBe("/{dynamic}");
        expect(res.routes[0].certainty).toBe("partial");
    });
});