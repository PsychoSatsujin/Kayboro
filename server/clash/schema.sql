-- Fandom Clash D1 schema. Apply with:
--   npx wrangler d1 execute kayboro-clash --remote --file server/clash/schema.sql
-- Idempotent (IF NOT EXISTS everywhere), so it is safe to re-run after adding tables.

-- Anonymous device id + display name for now; kaybo_user_id is filled once Kaybo accounts exist.
CREATE TABLE IF NOT EXISTS players (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  kaybo_user_id  TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_kaybo ON players (kaybo_user_id);

-- Seeds handed out by GET /match. A seed can be submitted once (ranked / local / percentage).
CREATE TABLE IF NOT EXISTS matches (
  seed         INTEGER PRIMARY KEY,
  snapshot_id  TEXT NOT NULL,
  mode         TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  issued_at    INTEGER NOT NULL,
  used_at      INTEGER
);
CREATE INDEX IF NOT EXISTS matches_issued ON matches (issued_at);

-- Every submitted run, with the derived rounds so a ghost can be replayed even after the
-- snapshot it was played on has been replaced.
CREATE TABLE IF NOT EXISTS runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id    TEXT NOT NULL REFERENCES players (id),
  mode         TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  group_code   TEXT NOT NULL DEFAULT '',
  seed         INTEGER NOT NULL,
  snapshot_id  TEXT NOT NULL,
  answers      TEXT NOT NULL,   -- JSON [{ round, pick, ms }]
  rounds       TEXT NOT NULL,   -- JSON, matchmaking.buildMatch(...).rounds
  score        INTEGER NOT NULL,
  correct      INTEGER NOT NULL,
  duration_ms  INTEGER NOT NULL,
  ghost_of     INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_player ON runs (player_id, mode, difficulty, created_at);
CREATE INDEX IF NOT EXISTS runs_board ON runs (mode, difficulty, group_code, score);

-- Best score per player per board. group_code '' is the global board.
CREATE TABLE IF NOT EXISTS best (
  player_id    TEXT NOT NULL REFERENCES players (id),
  mode         TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  group_code   TEXT NOT NULL DEFAULT '',
  score        INTEGER NOT NULL,
  run_id       INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (player_id, mode, difficulty, group_code)
);
CREATE INDEX IF NOT EXISTS best_board ON best (mode, difficulty, group_code, score DESC, updated_at);

-- Local Ranking groups (short human codes like KITE-42).
CREATE TABLE IF NOT EXISTS groups (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_by  TEXT,
  created_at  INTEGER NOT NULL
);

-- Light fixed-window rate limiting per hashed IP and bucket.
CREATE TABLE IF NOT EXISTS rate (
  key     TEXT PRIMARY KEY,   -- "<bucket>:<ip hash>"
  win     INTEGER NOT NULL,
  count   INTEGER NOT NULL
);

-- Idempotency records for POST /runs and POST /groups: "<route>:<player id or ip hash>:<client key>" ->
-- the first answer (status + JSON body), replayed for a retry with the same key. Removed after 48 h.
CREATE TABLE IF NOT EXISTS idem (
  key          TEXT PRIMARY KEY,
  fingerprint  TEXT NOT NULL,   -- SHA-256 of the request body, so a reused key with another body is refused
  status       INTEGER NOT NULL,
  body         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idem_created ON idem (created_at);
