// beacon.js — first-party visit logger, ZERO npm dependencies.
// Uses only Node built-ins (Buffer, fetch) — works on a no-build site.
// Decodes Netlify's injected event.blobs to reach Blob storage over HTTPS.
// Reached at /api/beacon via the /api/* redirect. Fire-and-forget.

const PIXEL_B64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

// --- per-instance spam guard ---
const rate = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
function ok(ip) {
  const now = Date.now();
  const r = rate.get(ip);
  if (!r || now > r.reset) { rate.set(ip, { count: 1, reset: now + WINDOW_MS }); return true; }
  if (r.count >= MAX_PER_WINDOW) return false;
  r.count++; return true;
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Decode the Blobs credentials Netlify injects into every function.
function blobCreds(event) {
  const raw = event.blobs;
  if (!raw) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    // data has { url (edge endpoint), token, ... }
    return { url: data.url, token: data.token };
  } catch (e) { return null; }
}

const STORE = 'aspen-visits';

exports.handler = async (event) => {
  const pixel = {
    statusCode: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    body: PIXEL_B64,
    isBase64Encoded: true,
  };

  try {
    const q = event.queryStringParameters || {};
    const page = (q.p || 'unknown').slice(0, 40);

    const fwd = (event.headers &&
      (event.headers['x-forwarded-for'] || event.headers['client-ip'])) || 'unknown';
    const ip = fwd.split(',')[0].trim() || 'unknown';
    if (!ok(ip)) return pixel;

    const creds = blobCreds(event);
    if (!creds) return pixel; // no creds → still serve pixel, never error

    const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '';
    const record = {
      t: new Date().toISOString(),
      page,
      ref: ((event.headers && event.headers['referer']) || '').slice(0, 120),
      ua: ((event.headers && event.headers['user-agent']) || '').slice(0, 160),
      v: hash(ip),
    };
    const key = record.t + '-' + Math.random().toString(36).slice(2, 8);

    // Write to the Blobs edge endpoint over HTTPS.
    // Endpoint shape: {edgeURL}/{siteID}/{store}/{key}
    const url = creds.url + '/' + siteID + '/' + encodeURIComponent(STORE) +
                '/' + encodeURIComponent(key);
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch (e) {
    // never surface a logging failure
  }
  return pixel;
};
