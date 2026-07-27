import { existsSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Runs files under api/*.js directly inside the Vite dev server process, mimicking Vercel's
// Node.js Serverless Function signature (req.query, res.status().json(), res.setHeader()) closely
// enough for this project's two handlers (api/schedule.js, api/class-schedule.js). This exists
// because:
//   - Plain `npm run dev` doesn't execute api/*.js at all — Vite just serves the file's raw
//     source text, which breaks any frontend code calling fetch('/api/...').
//   - `vercel dev` does execute it, but has a known incompatibility with this project's SPA
//     catch-all rewrite in vercel.json: it also routes Vite's own internal dev requests (e.g.
//     /src/main.tsx) through the rewrite, which Vite then fails to parse as JS.
// This plugin sidesteps both — no Vercel CLI, no deployed instance, dependency-free.
export function localApiPlugin(): Plugin {
  return {
    name: "local-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();

        const [pathname, search] = req.url.split("?");
        const routeName = pathname.replace("/api/", "");
        const modulePath = path.resolve(process.cwd(), "api", `${routeName}.js`);

        if (!existsSync(modulePath)) return next();

        try {
          // ssrLoadModule (not a plain dynamic import) keeps this in Vite's module graph, so
          // editing an api/*.js file is picked up on the next request without restarting the
          // dev server.
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default as (req: unknown, res: unknown) => Promise<void> | void;

          const query = Object.fromEntries(new URLSearchParams(search ?? ""));
          const vercelReq = { query, method: req.method, headers: req.headers };

          let statusCode = 200;
          const vercelRes = {
            status(code: number) {
              statusCode = code;
              return this;
            },
            setHeader(key: string, value: string) {
              res.setHeader(key, value);
              return this;
            },
            json(body: unknown) {
              res.statusCode = statusCode;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(body));
            },
          };

          await handler(vercelReq, vercelRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}
