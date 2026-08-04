/**
 * p2irl — retired.
 *
 * The visualizer and this API were taken down on 2026-08-04. Every route now
 * returns 410 Gone. Notable properties of this file, kept deliberately:
 *
 *   - It never reads `env`. The D1 binding is not used here and is commented
 *     out in wrangler.toml, so this worker cannot reach the database at all.
 *   - There are no CORS headers, so no other origin's JavaScript can read a
 *     response from it either.
 *   - There is no route table. Every path, every method, one answer.
 *
 * The previous version (API + admin console) is in git history at a1c6b78.
 */

const NOTICE = "p2irl has been taken down.";

const PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>p2irl</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #0d0d0d;
         color: #c3c2b7; margin: 0; min-height: 100vh; display: flex;
         align-items: center; justify-content: center; padding: 28px; line-height: 1.55; }
  h1 { color: #fff; font-size: 19px; font-weight: 600; margin: 0 0 12px; }
  p { font-size: 15px; margin: 0; max-width: 26rem; }
</style></head><body><main>
<h1>${NOTICE}</h1>
<p>the map is offline, and so is the API behind it.</p>
</main></body></html>`;

export default {
  async fetch(request) {
    const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");
    return new Response(wantsHtml ? PAGE : JSON.stringify({ error: "gone", message: NOTICE }), {
      status: 410,
      headers: {
        "Content-Type": wantsHtml ? "text/html; charset=utf-8" : "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
};
