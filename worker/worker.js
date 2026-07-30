/**
 * p2irl — API + admin console (v4).
 * The app lives on Cloudflare Pages (p2irl.pages.dev); this worker is the
 * API, the moderation console at /admin, and a redirect.
 *
 * Requires:
 *   - D1 binding: DB -> p2irl
 *   - Secret: ADMIN_TOKEN (set in dashboard: Settings -> Variables & Secrets,
 *     or via: wrangler secret put ADMIN_TOKEN)
 */

const APP_URL = "https://p2irl.pages.dev/";

const HANDLE = /^[a-z0-9._-]{2,32}$/;
const RELATIONS = new Set(["irl", "posting2-irl", "online-first", "posting2"]);
const norm = (h) => String(h || "").trim().replace(/^@+/, "").toLowerCase();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>p2irl admin</title><meta name="robots" content="noindex">
<style>
  body { font-family: system-ui, sans-serif; background: #0d0d0d; color: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 18px; } h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #898781; margin: 22px 0 8px; }
  input { font: inherit; font-size: 16px; padding: 8px 11px; border-radius: 8px; border: 1px solid #383835; background: #1a1a19; color: #fff; }
  button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px; border: 1px solid #383835; background: #1a1a19; color: #fff; cursor: pointer; }
  button:hover { border-color: #898781; } button.del { color: #e66767; }
  .row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #262624; font-size: 14px; flex-wrap: wrap; }
  .muted { color: #898781; font-size: 12px; } .grow { flex: 1; }
  #status { margin: 10px 0; font-size: 13px; color: #facc15; min-height: 18px; }
  .top { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
</style></head><body>
<h1>p2irl admin</h1>
<div class="top">
  <input id="token" type="password" placeholder="admin token" size="30">
  <button id="load">load data</button>
</div>
<div id="status"></div>
<div id="content" style="display:none">
  <h2>people (<span id="pcount"></span>)</h2><div id="people"></div>
  <h2>connections (<span id="lcount"></span>)</h2><div id="linksList"></div>
</div>
<script>
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data = null;
async function api(body) {
  const res = await fetch("/admin/api", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ token: $("token").value.trim() }, body)) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || ("HTTP " + res.status));
  return out;
}
async function load() {
  $("status").textContent = "loading\\u2026";
  try {
    const res = await fetch("/graph");
    data = await res.json();
    render();
    $("status").textContent = "";
    $("content").style.display = "";
  } catch (e) { $("status").textContent = "load failed: " + e.message; }
}
function render() {
  const deg = {};
  for (const l of data.links) { deg[l.a] = (deg[l.a]||0)+1; deg[l.b] = (deg[l.b]||0)+1; }
  $("pcount").textContent = data.people.length;
  $("lcount").textContent = data.links.length;
  $("people").innerHTML = data.people.map(p =>
    '<div class="row"><span class="grow">@' + esc(p.handle) + (p.claimed ? '' : ' <span class="muted">unclaimed</span>') +
    ' <span class="muted">' + (deg[p.handle]||0) + ' link rows</span></span>' +
    '<button class="del" data-person="' + esc(p.handle) + '">delete person + their links</button></div>').join("");
  $("linksList").innerHTML = data.links.map(l =>
    '<div class="row"><span class="grow">@' + esc(l.a) + ' \\u2194 @' + esc(l.b) +
    ' <span class="muted">' + esc(l.relation) + ' \\u00b7 reported by @' + esc(l.added_by) + '</span></span>' +
    '<button class="del" data-a="' + esc(l.a) + '" data-b="' + esc(l.b) + '" data-by="' + esc(l.added_by) + '">delete this report</button></div>').join("");
}
document.addEventListener("click", async (ev) => {
  const t = ev.target;
  if (t.id === "load") return load();
  try {
    if (t.dataset.person) {
      if (!confirm("Delete @" + t.dataset.person + " and every connection touching them?")) return;
      await api({ action: "delete-person", handle: t.dataset.person });
      $("status").textContent = "deleted @" + t.dataset.person; load();
    } else if (t.dataset.a) {
      if (!confirm("Delete the " + t.dataset.a + " \\u2194 " + t.dataset.b + " report by @" + t.dataset.by + "?")) return;
      await api({ action: "delete-report", a: t.dataset.a, b: t.dataset.b, added_by: t.dataset.by });
      $("status").textContent = "report deleted"; load();
    }
  } catch (e) { $("status").textContent = "error: " + e.message; }
});
</script></body></html>`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const { pathname } = new URL(request.url);

    try {
      // the app moved to Pages — send visitors there
      if ((pathname === "/" || pathname === "/index.html") && request.method === "GET") {
        return Response.redirect(APP_URL, 302);
      }

      if (pathname === "/admin" && request.method === "GET") {
        return new Response(ADMIN_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }

      if (pathname === "/admin/api" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!env.ADMIN_TOKEN || body.token !== env.ADMIN_TOKEN) return json({ error: "bad token" }, 403);
        if (body.action === "delete-person") {
          const handle = norm(body.handle);
          if (!HANDLE.test(handle)) return json({ error: "invalid handle" }, 400);
          await env.DB.batch([
            env.DB.prepare("DELETE FROM links WHERE a = ?1 OR b = ?1").bind(handle),
            env.DB.prepare("DELETE FROM people WHERE handle = ?1").bind(handle),
          ]);
          return json({ ok: true });
        }
        if (body.action === "delete-report") {
          const a = norm(body.a), b = norm(body.b), added_by = norm(body.added_by);
          const pair_key = [a, b].sort().join("||");
          await env.DB.prepare("DELETE FROM links WHERE pair_key = ?1 AND added_by = ?2")
            .bind(pair_key, added_by).run();
          return json({ ok: true });
        }
        return json({ error: "unknown action" }, 400);
      }

      if (pathname === "/graph" && request.method === "GET") {
        const [people, links] = await Promise.all([
          env.DB.prepare("SELECT handle, claimed FROM people").all(),
          env.DB.prepare("SELECT a, b, relation, added_by FROM links").all(),
        ]);
        return json({ people: people.results, links: links.results });
      }

      if (pathname === "/people" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const handle = norm(body.handle);
        if (!HANDLE.test(handle)) return json({ error: "invalid handle" }, 400);
        await env.DB.prepare(
          `INSERT INTO people (handle, claimed) VALUES (?1, ?2)
           ON CONFLICT(handle) DO UPDATE SET claimed = MAX(people.claimed, excluded.claimed)`
        ).bind(handle, body.claimed ? 1 : 0).run();
        return json({ ok: true });
      }

      if (pathname === "/links" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const a = norm(body.a), b = norm(body.b), added_by = norm(body.added_by);
        const relation = String(body.relation || "");
        if (!HANDLE.test(a) || !HANDLE.test(b) || a === b) return json({ error: "invalid handles" }, 400);
        if (!RELATIONS.has(relation)) return json({ error: "invalid relation" }, 400);
        if (added_by !== a && added_by !== b) return json({ error: "you can only report connections that include you" }, 400);
        const pair_key = [a, b].sort().join("||");
        const ensure = env.DB.prepare(
          "INSERT INTO people (handle, claimed) VALUES (?1, 0) ON CONFLICT(handle) DO NOTHING"
        );
        await env.DB.batch([
          ensure.bind(a),
          ensure.bind(b),
          env.DB.prepare(
            `INSERT INTO links (a, b, relation, added_by, pair_key) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(pair_key, added_by) DO UPDATE SET relation = excluded.relation`
          ).bind(a, b, relation, added_by, pair_key),
        ]);
        return json({ ok: true });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server error" }, 500);
    }
  },
};
