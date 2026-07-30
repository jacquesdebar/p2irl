# p2irl

**who do u know here** — a crowdsourced map of how posting2 users know each
other, IRL and online.

Live at **[p2irl.pages.dev](https://p2irl.pages.dev)**.

## How it works

People add themselves by their exact posting2 handle and list who they know.
Every connection is labeled by how it formed:

- **IRL** — know each other from real life
- **online then posting2** — knew each other online before posting2
- **posting2 then IRL** — met on the app, then met in person
- **posting2 only** — know each other just on posting2 (so far)

Trust model:

- A person only counts as **claimed** once they add themselves; handles that
  others mention render as dashed "unconfirmed" nodes until claimed.
- A connection renders dashed until **both** people report it.
- You can only report connections that include yourself — enforced server-side.
- The public API is insert-only: nothing can be edited or deleted without the
  admin token.

## Architecture

Three pieces, all on Cloudflare's free tier:

| Piece | What | Where |
|---|---|---|
| `site/` | The whole app — a single self-contained `index.html` (D3 force graph, submission flows) plus link-preview images | Cloudflare Pages, project `p2irl` |
| `worker/` | The API (`/graph`, `/people`, `/links`), the moderation console (`/admin`), and a redirect to the Pages site | Cloudflare Worker `p2irl` |
| `schema.sql` | Two tables: `people` and `links` (one row per pair per reporter) | Cloudflare D1, database `p2irl` |

The site's `CONFIG` block (top of the inline script in `index.html`) points
`API_URL` at the worker. With no API configured, the app runs in demo mode
with sample data — handy for local preview: just open `index.html` in a
browser.

## Deploying

**Automatic (recommended):** every push to `main` deploys both the site and
the worker via `.github/workflows/deploy.yml`. One-time setup: create a
Cloudflare API token (Workers + Pages edit permissions) and save it as the
`CLOUDFLARE_API_TOKEN` secret in this repo's Actions settings.

**Manual:** drag the `site/` folder into a new deployment on the Pages
project, and paste `worker/worker.js` into the worker's editor. Or with
[wrangler](https://developers.cloudflare.com/workers/wrangler/): `wrangler
pages deploy site --project-name=p2irl` and `wrangler deploy` from `worker/`.

## Moderation

The console at `<worker-url>/admin` can delete any person (plus every
connection touching them) or any single connection report. It's protected by
the `ADMIN_TOKEN` secret on the worker — set it with `wrangler secret put
ADMIN_TOKEN` or in the dashboard under the worker's Variables & Secrets. The
token is never committed to this repo.

Bulk operations go straight to D1 (dashboard console or `wrangler d1 execute`);
example queries live at the bottom of `schema.sql`.

## Getting off the map

Contact **@dang** on posting2 and your node will be removed, no questions
asked.
