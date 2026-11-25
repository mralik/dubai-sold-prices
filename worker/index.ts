// The Cloudflare Worker: serves the API. Static files (the web app) are served
// by Workers Static Assets before this code runs, with headers from dist/_headers.

import "./setup";
import app from "../server/app";
import { useDatabase } from "../server/database";
import { d1Backend, rowsRead, type D1Database } from "./d1";
import { hasHumanPass, verifyHuman } from "./human";
import build from "./generated/build.json";
import meta from "./generated/meta.json";
import snapshot from "./generated/snapshot.json";

interface Env {
  DB: D1Database;
  /** Cloudflare Turnstile keys. Without both, there's no human check (local runs). */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const humanCheckOn = (env: Env) => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);

interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

declare const caches: { default: { match(key: Request): Promise<Response | undefined>; put(key: Request, response: Response): Promise<void> } };

const DAY = 86_400;

// Hono's own ExecutionContext type is wider than the parts used here.
type HonoContext = Parameters<typeof app.fetch>[2];

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

function withHeaders(response: Response, extra: Record<string, string> = {}): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(name, value);
  return out;
}

function json(body: unknown, maxAge: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` },
  });
}

/**
 * Answers are cached for a day, keyed by the exact question and the build,
 * so a repeated question costs no database reads.
 */
async function cachedAsk(request: Request, env: Env, ctx: Context): Promise<Response> {
  const body = await request.text();
  let question = "";
  try {
    question = String((JSON.parse(body) as { question?: unknown }).question ?? "").trim().replace(/\s+/g, " ");
  } catch {
    // Invalid JSON: the app returns the error.
  }
  const forward = () => app.fetch(new Request(request.url, { method: "POST", headers: request.headers, body }), env, ctx as unknown as HonoContext);
  if (question.length < 3 || question.length > 300) return forward();

  const key = new Request(`https://cache.dubai-sold-prices/ask?v=${encodeURIComponent(build.id)}&q=${encodeURIComponent(question)}`);
  const hit = await caches.default.match(key);
  if (hit) return withHeaders(hit, { "x-answer-cache": "hit" });

  const response = await forward();
  if (response.status === 200) {
    const copy = new Response(response.clone().body, response);
    copy.headers.set("cache-control", `public, max-age=${DAY}`);
    ctx.waitUntil(caches.default.put(key, copy));
  }
  console.log(JSON.stringify({ question, rowsRead }));
  return withHeaders(response, { "x-answer-cache": "miss" });
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    useDatabase(d1Backend(env.DB));
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/api/meta") {
      return withHeaders(json({ ...meta, turnstileSiteKey: humanCheckOn(env) ? env.TURNSTILE_SITE_KEY : null }, 300));
    }
    if (request.method === "GET" && pathname === "/api/snapshot") return withHeaders(json(snapshot, 3600));
    if (request.method === "POST" && pathname === "/api/human") {
      if (!humanCheckOn(env)) return withHeaders(new Response(null, { status: 204 }));
      const cookie = await verifyHuman(request, env.TURNSTILE_SECRET_KEY!);
      if (!cookie) return withHeaders(Response.json({ error: "The human check didn't pass. Please try again." }, { status: 403 }));
      return withHeaders(new Response(null, { status: 204 }), { "set-cookie": cookie, "cache-control": "no-store" });
    }
    if (request.method === "POST" && pathname === "/api/ask") {
      // Every question, cached or not, needs a passed human check, so bots can't use the API.
      if (humanCheckOn(env) && !(await hasHumanPass(request, env.TURNSTILE_SECRET_KEY!))) {
        return withHeaders(Response.json({ error: "Please confirm you're human first.", needsHumanCheck: true }, { status: 401 }), { "cache-control": "no-store" });
      }
      return cachedAsk(request, env, ctx);
    }
    return withHeaders(await app.fetch(request, env, ctx as unknown as HonoContext));
  },
};
