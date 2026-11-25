// Runs before the app's modules load (it's the Worker's first import).
// Workers have no file system, so the data metadata is bundled and handed over here.

import communityAreas from "./generated/communityAreas.json";
import metadata from "./generated/metadata.json";

(globalThis as { __DLD_METADATA__?: unknown }).__DLD_METADATA__ = metadata;
(globalThis as { __COMMUNITY_AREAS__?: unknown }).__COMMUNITY_AREAS__ = communityAreas;
process.env.DATA_MODE = "dld";
// Keep within Cloudflare's free plan (see server/ask.ts).
process.env.FREE_PLAN_LIMITS = "1";
// The public demo always uses the free built-in reader.
delete process.env.ANTHROPIC_API_KEY;
