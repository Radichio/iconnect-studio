// visits.js — private visit-log viewer, ZERO npm dependencies.
// Reads Blob storage over HTTPS using Netlify's injected event.blobs.
// Reached at /api/visits via the /api/* redirect.
//   Log:       /api/visits?key=SECRET
//   Self-test: /api/visits?key=SECRET&test=1   (writes+reads a probe)

const VIEW_SECRET = 'angel-grove-dauphin-1997-aspen';
const STORE = 'aspen-visits';

function blobCreds(event) {
  const raw = event.blobs;
  if (!raw) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return { url: data.url, token: data.token };
  } catch (e) { return null; }
}

function siteId() {
  return process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '';
}

async function putBlob(creds, key, obj) {
  const url = creds.url + '/' + siteId() + '/' + encodeURIComponent(STORE) + '/' + encodeURIComponent(key);
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  });
  return r.status;
}

async function getBlob(creds, key) {
  const url = creds.url + '/' + siteId() + '/' + encodeURIComponent(STORE) + '/' + encodeURIComponent(key);
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + creds.token } });
  if (!r.ok) return null;
  try { return await r.json(); } catch (e) { return null; }
}

async function listKeys(creds) {
  // List endpoint: {edgeURL}/{siteID}/{store}?prefix=  (returns { blobs:[{key}], ... })
  const url = creds.url + '/' + siteId() + '/' + encodeURIComponent(STORE);
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + creds.token } });
  if (!r.ok) return { ok: false, status: r.status, keys: [] };
  try {
    const data = await r.json();
    const arr = (data && (data.blobs || data.keys)) || [];
    const keys = arr.map((b) => (typeof b === 'string' ? b : b.key)).filter(Boolean);
    return { ok: true, status: r.status, keys };
  } catch (e) {
    return { ok: false, status: r.status, keys: [] };
  }
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (q.key !== VIEW_SECRET) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
  }

  const creds = blobCreds(event);
  if (!creds) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'DIAGNOSTIC: event.blobs credentials not present. Blob storage unreachable from this function.',
    };
  }

  // Self-test: write a probe, read it back, report.
  if (q.test === '1') {
    const probeKey = 'selftest-' + Date.now();
    let out = 'BEACON SELF-TEST\n';
    try {
      const ps = await putBlob(creds, probeKey, { probe: true, t: new Date().toISOString() });
      out += 'write status: ' + ps + '\n';
      const back = await getBlob(creds, probeKey);
      out += 'read back: ' + (back && back.probe === true ? 'OK' : 'FAILED') + '\n';
      const lk = await listKeys(creds);
      out += 'list status: ' + lk.status + ', keys found: ' + lk.keys.length + '\n';
      out += (ps >= 200 && ps < 300 && back && back.probe)
        ? '\n\u2705 PASS \u2014 storage works. The beacon is recording.'
        : '\n\u274c Something failed above \u2014 send this text to Lisa.';
    } catch (e) {
      out += '\n\u274c ERROR: ' + e.message;
    }
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: out };
  }

  // Normal view.
  try {
    const lk = await listKeys(creds);
    const rows = [];
    for (const k of lk.keys) {
      if (k.indexOf('selftest-') === 0) continue;
      const rec = await getBlob(creds, k);
      if (rec) rows.push(rec);
    }
    rows.sort((a, z) => (a.t < z.t ? 1 : -1));

    const visitors = new Set(rows.map((r) => r.v)).size;
    const intake = rows.filter((r) => r.page === 'intake').length;
    const shortlist = rows.filter((r) => r.page === 'shortlist').length;
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));

    const trs = rows.map((r) => {
      let when = r.t;
      try { when = new Date(r.t).toLocaleString('en-CA', { timeZone: 'America/Winnipeg' }); } catch (e) {}
      const dev = /Mobile|iPhone|Android/i.test(r.ua || '') ? '\uD83D\uDCF1' : '\uD83D\uDCBB';
      return '<tr><td>' + esc(when) + '</td><td><b>' + esc(r.page) + '</b></td><td>' + dev +
             '</td><td class="v">' + esc(r.v) + '</td><td class="ref">' + esc(r.ref) + '</td></tr>';
    }).join('');

    const html =
      '<!doctype html><meta charset="utf-8"><title>Aspen \u2014 visit log</title>' +
      '<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#17153A;background:#FAFAFC}' +
      'h1{font-size:18px;margin:0 0 4px}.sum{color:#6B6A80;margin-bottom:18px}.sum b{color:#5333ED}' +
      'table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #E7E6F0;border-radius:10px;overflow:hidden}' +
      'th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #EFEEF6;font-size:13px}' +
      'th{background:#F4F3FA;color:#6B6A80;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em}' +
      'tr:last-child td{border-bottom:none}.v{font-family:ui-monospace,monospace;color:#9A99AD}' +
      '.ref{color:#9A99AD;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.empty{color:#9A99AD;padding:40px;text-align:center}</style>' +
      '<h1>Aspen \u2014 visit log</h1><div class="sum"><b>' + rows.length + '</b> pageviews \u00b7 <b>' +
      visitors + '</b> distinct visitors \u00b7 <b>' + intake + '</b> intake \u00b7 <b>' + shortlist +
      '</b> shortlist ' + (shortlist > 0 ? '\u00b7 \uD83D\uDD25 someone went deep' : '') + '</div>' +
      (rows.length
        ? '<table><tr><th>When (CT)</th><th>Page</th><th>Device</th><th>Visitor</th><th>Referrer</th></tr>' + trs + '</table>'
        : '<div class="empty">No visits recorded yet. (List status: ' + lk.status + ')</div>');

    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: html };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Error: ' + e.message };
  }
};
