// Cloudflare Turnstile "are you human" check for the public demo.
// A visitor solves it once; the Worker verifies the answer with Cloudflare and
// sets a signed cookie, so questions for the next 12 hours need no new check.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const COOKIE = "dsp_human";
const PASS_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(`${secret}|human-pass`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return btoa(String.fromCharCode(...signature)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Constant-time comparison, so the signature can't be guessed byte by byte. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the request carries an unexpired, correctly signed pass. */
export async function hasHumanPass(request: Request, secret: string): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`).exec(cookie);
  if (!match) return false;
  const expires = Number(match[1]);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return same(match[2]!, await sign(match[1]!, secret));
}

/** Checks a Turnstile answer with Cloudflare and, if it passes, returns the cookie to set. */
export async function verifyHuman(request: Request, secret: string): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 2048) return null;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.append("remoteip", ip);
  const result = (await fetch(VERIFY_URL, { method: "POST", body: form }).then((r) => r.json()).catch(() => null)) as { success?: boolean } | null;
  if (!result?.success) return null;
  const expires = String(Math.floor(Date.now() / 1000) + PASS_SECONDS);
  return `${COOKIE}=${expires}.${await sign(expires, secret)}; Max-Age=${PASS_SECONDS}; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}
