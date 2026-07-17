// beacon.js — first-party visit logger for the Aspen demo.
// Classic Netlify Functions handler (CommonJS), matching chat.js style.
// Reached at /api/beacon via the /api/* redirect in netlify.toml.
// Writes one record per visit to Netlify Blob storage. Fire-and-forget.
const { getStore, connectLambda } = require('@netlify/blobs');

// Transparent 1x1 GIF — always returned, so the demo is never affected.
const PIXEL_B64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

// Basic per-instance guard against write spam.
const rate = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;

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

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

exports.handler = async (event, context) => {
  try { connectLambda(event); } catch (e) {}
  const pixelResponse = {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
    body: PIXEL_B64,
    isBase64Encoded: true,
  };

  try {
    const q = event.queryStringParameters || {};
    const page = (q.p || 'unknown').slice(0, 40);

    const forwarded =
      (event.headers && (event.headers['x-forwarded-for'] || event.headers['client-ip'])) ||
      'unknown';
    const ip = forwarded.split(',')[0].trim() || 'unknown';

    if (!ok(ip)) return pixelResponse;

    const record = {
      t: new Date().toISOString(),
      page,
      ref: ((event.headers && event.headers['referer']) || '').slice(0, 120),
      ua: ((event.headers && event.headers['user-agent']) || '').slice(0, 160),
      v: hash(ip),
    };

    const store = getStore('aspen-visits');
    const key = record.t + '-' + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, record);
  } catch (e) {
    // Never surface a logging failure to the visitor.
  }
  return pixelResponse;
};
