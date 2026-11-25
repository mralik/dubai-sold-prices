// Writes dist/_headers: security headers for the web app on Cloudflare.
// The Content Security Policy allows the page's one inline script (the
// theme script in index.html) by its hash, so run this after every build.
//
//   tsx data/cfHeaders.ts

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
const hashes = inlineScripts.map((script) => `'sha256-${createHash("sha256").update(script).digest("base64")}'`);

const csp = [
  "default-src 'self'",
  // Cloudflare Turnstile, the human check, loads its script and frame from challenges.cloudflare.com.
  `script-src 'self' ${hashes.join(" ")} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  // React sets some inline styles, and the share card is drawn with them.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Share-card images are made in the browser as data: and blob: URLs.
  "img-src 'self' data: blob:",
  // html-to-image reads the font files to embed them in the card.
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const headers = `/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${csp}

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync(new URL("../dist/_headers", import.meta.url), headers);
console.log(`Wrote dist/_headers (${hashes.length} inline script hash${hashes.length === 1 ? "" : "es"}).`);
