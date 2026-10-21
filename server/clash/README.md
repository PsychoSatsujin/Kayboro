# Fandom Clash: data pipeline and API

"Which character has more posts across the booru sites?" Higher/lower style, with four modes:
Ranked Vs (global board), Local Ranking (board scoped to a group code), Percentage Vs (bet on
which group of contestants is bigger and guess the split), and Ghost battles (replay another
player's recorded run). Only all-ages images are ever shown; the counts cover every rating.

| Piece | Path |
| --- | --- |
| Snapshot builder | `tools/clash/build-snapshot.mjs` |
| Snapshot uploader (KV) | `tools/clash/upload-snapshot.mjs` |
| Matchmaking (pure, CommonJS, shared by app, Worker and tests) | `tools/clash/matchmaking.js` |
| Committable sample snapshot (150 characters, real data) | `tools/clash/sample-snapshot.json` |
| Worker | `server/clash/src/index.mjs`, `server/clash/src/logic.js` |
| D1 schema | `server/clash/schema.sql` |
| Tests | `test/clash-matchmaking.test.js`, `test/clash-server.test.js`, `test/clash-server-hardening.test.js`, `test/clash-numbers.test.js`, `test/clash-client-resilience.test.js` (CI: `.github/workflows/test.yml`) |
| Node server (what runs in production) | `server/clash/node/server.mjs`, `setup.sh`, `deploy.sh` |

## Production: Linode

The API runs on its own Linode, separate from the Kaybo site, with the same handler as the Worker code
(`src/index.mjs`) wrapped in a plain Node server (`node/server.mjs`): SQLite (`node:sqlite`) instead of D1,
snapshot files instead of KV.

| | |
| --- | --- |
| Linode | `kaybo-clash` (id 108794078), Nanode 1 GB, us-east, Debian 12 |
| Address | `https://45-33-87-79.ip.linodeusercontent.com` (Caddy, Let's Encrypt); the app's default (`src/main/clash.js`) |
| Service | systemd `kayboro-clash` (user `clash`), code `/opt/kayboro-clash`, data `/var/lib/kayboro-clash` |
| Firewall | ufw: SSH (key only), 80, 443 |
| Deploy key | `.cache/clash-deploy/id_ed25519` (git-ignored; keep a backup somewhere safe) |

Ship code, or code plus a new snapshot:

```sh
bash server/clash/node/deploy.sh
node tools/clash/build-snapshot.mjs --limit 2000 --sample 150
bash server/clash/node/deploy.sh --snapshot .cache/clash/snapshot.json
```

A fresh server is prepared once with `HOST=<rDNS name> bash setup.sh` (as root, from a copy of `node/`). The Cloudflare
Worker files (`wrangler.toml`, `upload-snapshot.mjs`) remain as an alternative host, and `server/clash/Dockerfile`
packages the same server as a container (`docker build -f server/clash/Dockerfile -t kayboro-clash .` from the repo root).

`deploy.sh` also installs `node/kayboro-clash.service` and `node/Caddyfile` (validated before Caddy reloads), then
waits for `GET /v1/health` to answer 200. Monitoring: point an uptime check at `/v1/health` (200 with
`{ ok, db, snapshot }`, 503 when the database or the snapshot is missing).

Hardening (what holds at this scale: one Nanode, one Node process, SQLite):

| Layer | What |
| --- | --- |
| Caddy (`node/Caddyfile`) | HTTPS; request bodies over 64 KB refused; header read 10 s, body read 15 s, write 30 s, idle 2 min; security headers (HSTS, nosniff, DENY framing, no referrer, `default-src 'none'` CSP); `X-Real-IP` set to the real client address (whatever the client sent is overwritten); retries the upstream for up to 8 s while Node restarts, so a deploy does not answer 502. |
| Node (`node/server.mjs`) | 413 above 64 KB (checked before reading the body); headers within 10 s, whole request within 15 s; keep-alive 65 s (longer than Caddy's 30 s upstream keep-alive); the client IP from `X-Real-IP` (`TRUST_PROXY=0` uses the socket address when Node faces clients directly); SIGTERM/SIGINT drain in-flight requests (10 s max), checkpoint and close SQLite; cleanup runs a minute after start and every 6 h. |
| Handler (`src/index.mjs`) | Per-IP fixed-window rate limits with `Retry-After`; idempotency keys on `POST /v1/runs` and `POST /v1/groups`; `no-store` on dynamic answers, short caching on the snapshot (ETag) and boards. |
| App (`src/main/clash.js`) | 6 s timeouts; one jittered retry for repeatable calls that fail fast; a circuit breaker (15 s open, doubling to 5 min, half-open probe); a durable upload queue with exponential back-off and jitter; conditional snapshot refresh (ETag). |

## 1. Snapshot

### Contract (version 1)

```json
{ "version": 1, "generatedAt": "ISO", "sites": ["danbooru", "..."],
  "characters": [{ "id": "<danbooru tag>", "name": "Display Name", "franchise": "<copyright tag>",
                   "counts": { "<site>": 123 }, "total": 123,
                   "image": { "site": "danbooru", "postId": "123", "url": "https://...", "w": 850, "h": 1200 } }],
  "franchises": [{ "id": "<copyright tag>", "name": "Display", "total": 456, "counts": { "<site>": 400 },
                   "fallback": ["<site>"], "characters": ["<tag>"] }] }
```

A franchise's `counts` are its per-site numbers and `fallback` the sites where the copyright tag was unknown (the
pool characters' sum is used there, see step 4 below); `total` = sum of `counts`, like a character's.
`test/clash-numbers.test.js` re-checks both rules on the shipped snapshot.

Both lists are sorted by `total` descending. `image` may be `null`. The snapshot id is its
`generatedAt`. A hand-made sample would carry `"sample": true` at the top level; the committed
sample is real data, so it does not.

### How it is built

1. **Pool.** Danbooru character tags (category 4) ordered by post count, `--limit` of them
   (default 500, full build 2000). Costume variants such as `hoshino_(swimsuit)_(blue_archive)`
   and deprecated tags are skipped.
2. **Franchise and image.** One Danbooru search per character, `<tag> rating:g order:score`
   (60 posts). The franchise is the dominant copyright tag over those posts (crossover posts with
   more than 4 copyrights are ignored, and generic ones like `original` or `virtual_youtuber` never
   win), which picks the umbrella series (`fate_(series)`, `touhou`, `pokemon`). The image is the
   best-scored rating:g post with at most 2 characters and 3 copyrights, as the 850px `sample`
   variant (or 720/360px). If no rating:g post works, safebooru.org (SFW-only) is used. Explicit
   posts are never stored or referenced.
3. **Counts.** For each site, the post count of the same tag name. On a miss the builder tries two
   conservative alternatives: the tag without its `_(qualifier)` when the rest is multi-word, and,
   for western-order sites (e621, paheal), the two-word name swapped (`hakurei_reimu` to
   `reimu_hakurei`). Sites that report a tag category must report "character" for an alternative
   to count. A site that still misses is skipped for that character. `total` = sum of `counts`.
4. **Franchises.** Total = sum over sites of the copyright tag's own post count on that site. Where
   a site does not know the copyright tag, the sum of that site's counts for the franchise's pool
   characters is used for that site. (`--no-franchise-tags` uses the character sum everywhere.)
   Only franchises with at least one pool character are listed.

Sites: danbooru, safebooru, e621, paheal (rule34.paheal.net autocomplete API), yandere,
konachan (konachan.com, all ratings). Gelbooru and rule34.xxx now require API keys; set
`GELBOORU_USER_ID`/`GELBOORU_API_KEY` and `RULE34_USER_ID`/`RULE34_API_KEY` to include them.
The Rule-34/API project has no public documentation (its DOCUMENTATION.md says it is only for the
Rule 34 App), so the builder talks to the sites directly. Note safebooru mirrors part of Danbooru,
so those posts are counted twice; that is fine for a relative popularity game.

Politeness: one request at a time per host with a minimum gap (danbooru 350 ms, e621 700 ms,
paheal 1 s, others 500 to 700 ms), at most 3 hosts at once (`--concurrency`, max 4), retries with
exponential backoff that honours `Retry-After`, User-Agent `KayboroClash/0.1 (+...)`, batched tag
lookups where the API allows it (Danbooru and e621: 50 tags per request). Every response is cached
in `.cache/clash/http/` (git-ignored, on F:) for `--ttl-days` (7), so a build resumes after an
interruption and re-runs are free.

### Commands

```sh
# medium build (~500 characters, ~20 minutes cold, seconds warm) + 150-entry sample
node tools/clash/build-snapshot.mjs --limit 500 --sample 150

# full build (2000 characters; roughly 1 to 1.5 hours cold because paheal is 1 req/s)
node tools/clash/build-snapshot.mjs --limit 2000 --sample 150

# output: .cache/clash/snapshot.json (git-ignored); sample: tools/clash/sample-snapshot.json
```

## 2. Matchmaking (`tools/clash/matchmaking.js`)

Pure and deterministic: `buildMatch({ snapshot, mode, difficulty, seed })` gives the same rounds for
the same snapshot and seed (mulberry32), which is how the server re-scores runs and how ghosts are
replayed.

- `pickRound({ snapshot, mode, difficulty, rng, exclude? })` returns
  `{ kind, a, b, totals: { a, b }, answer: 'a'|'b' }`. `kind` is `char-char`, `char-franchise`,
  `franchise-franchise` or `group-group`; a side is `{ type: 'character'|'franchise', id }` or
  `{ type: 'group', members: [{ type, id }] }`. `rng` may be a function, a seed or a string.
- `pickPercentage({ snapshot, difficulty, rng })` returns a `group-group` round (2 to 3 members per
  side) plus `share`: side a's percentage of the combined total (one decimal).
- `buildMatch(...)` returns `{ seed, mode, difficulty, snapshot: generatedAt, rounds: [...] }`,
  10 rounds (5 for percentage), without repeating a contestant inside a match.
- Also exported: `DIFFICULTIES`, `MODES` (`ranked`, `local`, `percentage`, `ghost`), `ROUNDS`,
  `mulberry32`, `seedFromString`, `randomSeed`, `totalOf`.

| Difficulty | Tier (characters) | Totals apart | Group rounds | Score x |
| --- | --- | --- | --- | --- |
| easy | top 30% of pool, max top 600 | 1.8x to 4x | none | 1 |
| normal | top 60%, max top 1,200 | 1.35x to 2x | none | 1.5 |
| hard | whole pool | 1.1x to 1.4x | 10% | 2 |
| master | whole pool | 1.02x to 1.15x | 30% (a top-5% character vs 2 to 4 others) | 3 |

Round mix outside groups: 70% character vs character, 18% character vs franchise, 12% franchise vs
franchise. A character never meets its own franchise. The most lopsided pairing allowed anywhere
is 4x, so a very popular contestant is never paired with an unknown one, even on Easy. On very
small snapshots the band widens gradually (never past 6x) rather than failing.

## 3. Worker API (`/v1`)

| Endpoint | Notes |
| --- | --- |
| `GET /v1/health` | `{ ok, time, db, snapshot }`: 200 when the database answers and a snapshot is loaded, else 503. Not cached, not rate limited. |
| `GET /v1/snapshot[?id=]` | Current snapshot JSON from KV (ETag = id, `If-None-Match` gives 304, weak or listed tags too; 5 min cache). |
| `GET /v1/match?mode=&difficulty=` | Server picks a seed, registers it, returns `buildMatch(...)` + `registered: true`. With `&seed=` it returns that match unregistered (practice/preview). |
| `POST /v1/runs` | `{ player: { id, name, kayboId? }, mode, difficulty, group?, seed, answers: [{ round, pick: 'a'|'b'|0..100, ms }], ghostOf? }`. The server re-derives the rounds from the seed and scores them. Returns `{ runId, score, correct, rounds, details, best, rank, personalBest }`; for ghosts `{ ..., rank: null, ghost: { runId, player, score }, outcome: 'win'|'lose'|'draw' }`. A registered seed can be submitted once, within 24 h. Optional `idempotencyKey` (8 to 80 chars of `[A-Za-z0-9_-]`, or an `Idempotency-Key` header): a retry with the same key and body gets the first answer back (`idempotent-replay: true`) instead of a 409; the same key with another body is a 422. Keys are kept 48 h. |
| `GET /v1/leaderboard?mode=&difficulty=&group=&limit=` | Best score per player, standard competition ranks. `local` needs `group`. |
| `POST /v1/groups` | `{ name?, player?, idempotencyKey? }` gives `{ code: 'KITE-42', name, createdAt }`; a retried key returns the same group. |
| `GET /v1/groups/:code` | `{ code, name, createdAt, players }`. |
| `GET /v1/ghosts?player=&mode=&difficulty=` | That player's best run (seed, answers with timings, rounds). |
| `GET /v1/ghosts/top?mode=&difficulty=&group=` | The top ranker's run on that board. To race it: `POST /v1/runs` with `mode: 'ghost'`, the ghost's `seed` and `ghostOf: runId`. |

Scoring: a correct pick earns 100 x the difficulty multiplier plus a speed bonus of up to 50 (full
under 2 s, gone at 12 s, none under 200 ms). Wrong or unanswered earns 0; there is no game over
and no streak multiplier. Percentage rounds: a numeric pick is the predicted share of side a; the
right side earns 100 x multiplier, plus up to 100 for closeness (0 at 25 points off). Coins and
bets stay in the app's economy; the server only scores.

Identity: anonymous device id (8 to 64 chars of `[A-Za-z0-9_-]`) plus a display name; `kayboId` is
stored in `players.kaybo_user_id` for when Kaybo accounts exist (unverified for now). Rate limits
are per hashed IP (SHA-256 with the `IP_SALT` secret): 60 matches/min, 30 runs/min, 10 groups/hour,
240 board/ghost reads/min; a refusal is 429 with `Retry-After` (seconds). A daily cron removes expired matches, old rate
rows and idempotency records older than 48 h.

## 4. Deploy (for the owner; nothing has been created yet)

Run from the repo root in Git Bash. The token stays out of the repo: put it in the environment
(or in the git-ignored `server/clash/.env` for the upload script).

```sh
export CLOUDFLARE_API_TOKEN="$(cat /c/Users/Alexander/Documents/kaybocloudflare.txt)"
export CLOUDFLARE_ACCOUNT_ID=<your account id>       # wrangler whoami shows it
cd server/clash

# one-time resources
npx wrangler@4 d1 create kayboro-clash                # copy database_id into wrangler.toml
npx wrangler@4 kv namespace create CLASH_KV           # copy id into wrangler.toml
npx wrangler@4 d1 execute kayboro-clash --remote --file schema.sql
openssl rand -hex 16 | npx wrangler@4 secret put IP_SALT

# deploy the Worker
npx wrangler@4 deploy

# build and upload a snapshot (repeat whenever you rebuild, e.g. weekly)
cd ../..
node tools/clash/build-snapshot.mjs --limit 2000 --sample 150
CLASH_KV_NAMESPACE_ID=<kv id> node tools/clash/upload-snapshot.mjs            # add --dry-run to check first
curl https://kayboro-clash.<your-subdomain>.workers.dev/v1/snapshot | head -c 200
```

The token needs: Workers Scripts Edit, Workers KV Storage Edit, D1 Edit (and Account Settings Read
for `wrangler whoami`). Local development: `cd server/clash && npx wrangler@4 dev` with a
`.dev.vars` file containing `IP_SALT=dev`, then
`npx wrangler@4 d1 execute kayboro-clash --local --file schema.sql` and
`npx wrangler@4 kv key put --local --binding CLASH_KV snapshot:current <id>` (plus the snapshot body
under `snapshot:<id>`). The tests exercise the whole handler without wrangler (in-memory D1 via
`node:sqlite`).

Weekly refresh, if wanted: a Windows Task Scheduler job running the two `node tools/clash/...`
commands above, with the three environment variables set for that task.
