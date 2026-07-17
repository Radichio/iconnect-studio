// beacon.js — first-party visit logger for the Aspen demo.
// Writes one record per visit to Netlify Blob storage (free tier).
// Fire-and-forget: the demo pages ping this on load; it never blocks them.
import { getStore } from "@netlify/blobs";

// Basic guard so this can't be spammed into a huge bill of writes.
const rate = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30; // per warm instance, per IP

function ok(ip) {
  const now = Date.now();
  const rec = rate.get(ip);
  if (!rec || now > rec.reset) {
    rate.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (rec.count >= MAX_PER_WINDOW) return false;
  rec.count++;
  return true;
}

export default async (request, context) => {
  // Always answer fast with a transparent 1x1 — even on error — so the
  // page load is never affected and nothing shows in the visitor's UI.
  const pixel = Uint8Array.from([
    0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
    0xff,0xff,0xff,0x00,0x00,0x00,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,
    0x00,0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
    0x44,0x01,0x00,0x3b
  ]);
  const respond = () =>
    new Response(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

  try {
    const url = new URL(request.url);
    const page = (url.searchParams.get("p") || "unknown").slice(0, 40);

    const ip =
      context?.ip ||
      request.headers.get("x-nf-client-connection-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";

    if (!ok(ip)) return respond();

    const geo = context?.geo || {};
    const record = {
      t: new Date().toISOString(),
      page,                                   // "intake" | "shortlist"
      city: geo.city || "",
      region: geo.subdivision?.code || geo.subdivision?.name || "",
      country: geo.country?.code || "",
      ref: (request.headers.get("referer") || "").slice(0, 120),
      ua: (request.headers.get("user-agent") || "").slice(0, 160),
      // Coarse IP hash for distinguishing repeat visitors without storing the IP.
      v: hash(ip),
    };

    const store = getStore("aspen-visits");
    // Key sorts chronologically and is unique per write.
    const key = `${record.t}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(key, record);
  } catch (_) {
    // Swallow everything — a logging failure must never surface to the visitor.
  }
  return respond();
};

// Tiny non-cryptographic hash → short string, just to group repeat visits.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const config = { path: "/b" };
