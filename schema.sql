-- ============================================================
-- p2irl — Cloudflare D1 schema
-- Run once against your D1 database (dashboard console or:
--   wrangler d1 execute p2irl --remote --file=d1-schema.sql)
-- Handle format & relation rules are also enforced in the Worker;
-- the CHECKs here are a backstop.
-- ============================================================

CREATE TABLE IF NOT EXISTS people (
  handle     TEXT PRIMARY KEY
             CHECK (length(handle) BETWEEN 2 AND 32),
  claimed    INTEGER NOT NULL DEFAULT 0,         -- 1 = added themselves
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per (pair, reporter). A connection is "confirmed" when both
-- endpoints have a row for the same pair — the app computes that client-side.
CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  a          TEXT NOT NULL CHECK (length(a) BETWEEN 2 AND 32),
  b          TEXT NOT NULL CHECK (length(b) BETWEEN 2 AND 32),
  relation   TEXT NOT NULL DEFAULT 'posting2'
             CHECK (relation IN ('irl','posting2-irl','posting2')),
  added_by   TEXT NOT NULL,
  pair_key   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (a <> b),
  CHECK (added_by = a OR added_by = b),          -- only report edges that include you
  UNIQUE (pair_key, added_by)                    -- one report per person per pair
);

CREATE INDEX IF NOT EXISTS idx_links_pair ON links (pair_key);

-- ---------- Moderation (run manually as needed) ----------
-- Remove a person entirely (node + every edge touching them):
--   DELETE FROM links  WHERE a = 'somehandle' OR b = 'somehandle';
--   DELETE FROM people WHERE handle = 'somehandle';
--
-- Remove a single reported edge:
--   DELETE FROM links WHERE pair_key = 'handle1||handle2' AND added_by = 'handle1';
--
-- The 'online-first' category is retired. The app folds old rows into
-- 'posting2' at render time, so this is optional — but an existing DB
-- (whose table still carries the old CHECK) can be cleaned up with:
--   UPDATE links SET relation = 'posting2' WHERE relation = 'online-first';
