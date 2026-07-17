// visits.js — private read-back of the Aspen visit log.
// Classic Netlify Functions handler (CommonJS), matching chat.js style.
// Reached at /api/visits via the /api/* redirect in netlify.toml.
//   Log:       /api/visits?key=SECRET
//   Self-test: /api/visits?key=SECRET&test=1
const { getStore } = require('@netlify/blobs');

const VIEW_SECRET = 'angel-grove-dauphin-1997-aspen';

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};

  if (q.key !== VIEW_SECRET) {
    return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
  }

  // Self-test: prove the storage path works before trusting "no visits".
  if (q.test === '1') {
    try {
      const store = getStore('aspen-visits');
      const probeKey = 'selftest-' + Date.now();
      await store.setJSON(probeKey, { t: new Date().toISOString(), probe: true });
      const back = await store.get(probeKey, { type: 'json' });
      await store.delete(probeKey);
      const okRead = back && back.probe === true;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body:
          'BEACON SELF-TEST: ' +
          (okRead
            ? '\u2705 PASS \u2014 Blob storage wrote and read back correctly. The beacon is recording.'
            : '\u274c FAIL \u2014 wrote but could not read back. Storage not working.'),
      };
    } catch (e) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: 'BEACON SELF-TEST: \u274c FAIL \u2014 ' + e.message,
      };
    }
  }

  try {
    const store = getStore('aspen-visits');
    const listed = await store.list();
    const blobs = (listed && listed.blobs) || [];

    const rows = [];
    for (const b of blobs) {
      try {
        const rec = await store.get(b.key, { type: 'json' });
        if (rec && !rec.probe) rows.push(rec);
      } catch (e) { /* skip unreadable */ }
    }
    rows.sort((a, z) => (a.t < z.t ? 1 : -1));

    const visitors = new Set(rows.map((r) => r.v)).size;
    const intake = rows.filter((r) => r.page === 'intake').length;
    const shortlist = rows.filter((r) => r.page === 'shortlist').length;

    const esc = (s) =>
      String(s == null ? '' : s).replace(/[<>&"]/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])
      );

    const trs = rows
      .map((r) => {
        let when = r.t;
        try {
          when = new Date(r.t).toLocaleString('en-CA', { timeZone: 'America/Winnipeg' });
        } catch (e) {}
        const mobile = /Mobile|iPhone|Android/i.test(r.ua || '') ? '\uD83D\uDCF1' : '\uD83D\uDCBB';
        return (
          '<tr><td>' + esc(when) + '</td><td><b>' + esc(r.page) + '</b></td><td>' +
          mobile + '</td><td class="v">' + esc(r.v) + '</td><td class="ref">' +
          esc(r.ref) + '</td></tr>'
        );
      })
      .join('');

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
        ? '<table><tr><th>When (CT)</th><th>Page</th><th>Device</th><th>Visitor</th><th>Referrer</th></tr>' +
          trs + '</table>'
        : '<div class="empty">No visits recorded yet.</div>');

    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: html };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Error reading log: ' + e.message,
    };
  }
};
