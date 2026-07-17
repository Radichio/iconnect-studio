// visits.js — private read-back of the Aspen visit log.
// Open in a browser:  https://iconnect.studio/visits?key=YOUR_SECRET
// Returns a simple newest-first HTML table. Guarded by a secret in the URL.
import { getStore } from "@netlify/blobs";

// CHANGE THIS before deploying. Anyone with this string can read the log,
// so make it long and unguessable. Nothing else uses it.
const VIEW_SECRET = "angel-grove-dauphin-1997-aspen";

export default async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== VIEW_SECRET) {
    return new Response("Not found", { status: 404 });
  }

  // Self-test mode: ?key=...&test=1 writes then reads a probe record,
  // proving the whole storage path works before you trust "no visits".
  if (url.searchParams.get("test") === "1") {
    try {
      const store = getStore("aspen-visits");
      const probeKey = "selftest-" + Date.now();
      await store.setJSON(probeKey, { t: new Date().toISOString(), probe: true });
      const back = await store.get(probeKey, { type: "json" });
      await store.delete(probeKey);
      const okRead = back && back.probe === true;
      return new Response(
        "BEACON SELF-TEST: " +
          (okRead
            ? "✅ PASS — Blob storage wrote and read back correctly. The beacon is recording."
            : "❌ FAIL — wrote but could not read back. Storage not working."),
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (e) {
      return new Response(
        "BEACON SELF-TEST: ❌ FAIL — " +
          e.message +
          "\n\nLikely cause: @netlify/blobs not resolving. See deploy directive step 1.",
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
  }

  try {
    const store = getStore("aspen-visits");
    const { blobs } = await store.list();

    const rows = [];
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: "json" });
      if (rec) rows.push(rec);
    }
    rows.sort((a, z) => (a.t < z.t ? 1 : -1)); // newest first

    const visitors = new Set(rows.map((r) => r.v)).size;
    const intake = rows.filter((r) => r.page === "intake").length;
    const shortlist = rows.filter((r) => r.page === "shortlist").length;

    const esc = (s) =>
      String(s || "").replace(/[<>&"]/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
      );

    const trs = rows
      .map((r) => {
        const when = new Date(r.t).toLocaleString("en-CA", {
          timeZone: "America/Winnipeg",
        });
        const where = [r.city, r.region, r.country].filter(Boolean).join(", ");
        const mobile = /Mobile|iPhone|Android/i.test(r.ua) ? "📱" : "💻";
        return `<tr>
          <td>${esc(when)}</td>
          <td><b>${esc(r.page)}</b></td>
          <td>${esc(where)}</td>
          <td>${mobile}</td>
          <td class="v">${esc(r.v)}</td>
          <td class="ref">${esc(r.ref)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html><meta charset="utf-8">
<title>Aspen — visit log</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#17153A;background:#FAFAFC}
  h1{font-size:18px;margin:0 0 4px}
  .sum{color:#6B6A80;margin-bottom:18px}
  .sum b{color:#5333ED}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #E7E6F0;border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #EFEEF6;font-size:13px}
  th{background:#F4F3FA;color:#6B6A80;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em}
  tr:last-child td{border-bottom:none}
  .v{font-family:ui-monospace,monospace;color:#9A99AD}
  .ref{color:#9A99AD;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .empty{color:#9A99AD;padding:40px;text-align:center}
</style>
<h1>Aspen — visit log</h1>
<div class="sum"><b>${rows.length}</b> pageviews ·
  <b>${visitors}</b> distinct visitors ·
  <b>${intake}</b> intake · <b>${shortlist}</b> shortlist
  ${shortlist > 0 ? "· 🔥 someone went deep" : ""}</div>
${
  rows.length
    ? `<table><tr><th>When (CT)</th><th>Page</th><th>Where</th><th>Device</th><th>Visitor</th><th>Referrer</th></tr>${trs}</table>`
    : `<div class="empty">No visits recorded yet.</div>`
}`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Error reading log: " + e.message, { status: 500 });
  }
};

export const config = { path: "/visits" };
