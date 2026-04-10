# README-DEV — Purposeful Change / Body Signal
## Daily context file — read this at the start of every dev session

---

## Who & What
**Simon Lamb** — coach, author, Purposeful Change. Working with Claude daily on a rolling basis. Conversations get too large and must be started fresh — this file is the persistent context bridge.

**Co-author:** Christina Watt (Reframe workbook)

---

## Two Products in This Repo

### 1. Body Signal (`app.purposefulchange.co.uk`)
Wearable integration tool. Connects WHOOP data to psychological coaching methodology. Shows daily recovery signal, scores it against personal baseline, and uses Lumen (AI companion) to surface psychological meaning from physiological patterns.

### 2. Reframe Workbook (`reframe-mission-1.vercel.app` — blocked by Safe Browsing, false positive submitted)
14-mission digital workbook. Missions 1, 2, 6 built. Missions 3-5, 7-14 still to build.

---

## Stack
| Thing | Value |
|---|---|
| GitHub | `github.com/LAmby2244/reframe-mission-1` |
| Vercel project | `prj_XhDamdR45TOFhqZqHTk7A6NKWdbU` |
| Vercel team | `team_QdSm8BPRfWR7RxBzM0CtW9Ky` |
| Supabase | `aoqjfqmlcccsosddqnws` |
| Live domain | `app.purposefulchange.co.uk` |
| DNS | CNAME `fb96c77117a481ee.vercel-dns-017.com` in 123-reg |
| Brand font | Rubik |
| Framework | Vanilla HTML/JS + Vercel Edge Functions + Supabase auth |

---

## Key People / IDs
| Person | Supabase user_id | WHOOP member_id |
|---|---|---|
| Simon (simon@purposefulchange.co.uk) | b34d797c-80b7-4c15-94ac-159ef813e202 | 36136954 |
| Melinda (melinda@purposefulchange.co.uk) | a64f2289-f8d9-409c-9807-c58996c13b20 | 34690349 |

---

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `wearable.html` | Main Body Signal page | Sends `Authorization: Bearer [authToken]` to `/api/whoop-data` |
| `whoop-callback.html` | OAuth callback | Stores tokens in localStorage scoped to userId |
| `api/whoop-data.js` | WHOOP data fetch + scoring | **Must be Edge function** (`export const config = { runtime: 'edge' }`) |
| `api/whoop-auth.js` | WHOOP OAuth flow | Uses PATCH not upsert to avoid 409 conflicts |
| `api/lumen.js` | Lumen AI companion | Proxies Anthropic API, requires Supabase JWT auth |
| `api/study-data.js` | Study dashboard data | Reads from Supabase |

---

## Architecture — Body Signal Data Flow
1. User logs in via Supabase auth
2. `wearable.html` calls `/api/whoop-data` with `Authorization: Bearer [supabaseJWT]`
3. `whoop-data.js` decodes JWT → gets `user_id` → queries `whoop_connections` by `user_id`
4. Fetches 28 days from WHOOP v2 API using stored `access_token`
5. Computes personal baselines (28-day mean/SD) + z-scores
6. Runs 9-state scoring engine → returns scored data
7. `wearable.html` renders signal card + calls `/api/lumen` with trend arc as context
8. Lumen reads arc, names the psychological clue, invites exploration

---

## Supabase Tables
| Table | Purpose |
|---|---|
| `whoop_connections` | Links Supabase user_id → WHOOP member_id + tokens |
| `daily_state` | Scored WHOOP data per day per user |
| `wearable_entries` | User journal entries from Body Signal |
| `study_participants` | Study participant tracking |
| `answers` | Reframe workbook answers (RLS enabled) |

---

## Critical Architecture Rules
- `whoop-data.js` **must** use `export const config = { runtime: 'edge' }` — if this is missing it silently breaks
- WHOOP v2 API needs full ISO datetime: `new Date().toISOString()` not `.split('T')[0]`
- Supabase token updates use **PATCH** not upsert — upsert causes 409 conflicts
- `whoop_connections` lookup must be by `user_id` from JWT — NOT by `mid` from localStorage (this caused a cross-user data leak)
- Non-ASCII characters in JS comments (em dashes `—`, box chars `═`) break the Edge runtime — use plain ASCII only
- Never use Chrome browser replace-all for code edits — it corrupts code. Always use bash tool or present files for download

---

## Lumen — AI Companion
- Lives in `api/lumen.js`
- Voice: Simon Lamb (clear, grounded), Nancy Kline (presence), Byron Katie (gentle inquiry)
- Mirror not a coach — 2-3 sentences, one question max, never clinical
- Body Signal opening: reads recovery trend arc, treats data as clue to psychological state, invites exploration
- Never uses: "certainly", "absolutely", "I understand", "that's really insightful"

---

## Known Issues / Outstanding Work

### 🔴 Must fix next session
- Cross-user data isolation: push `api/whoop-data.js` and `wearable.html` from Claude outputs (JWT lookup fix)
- Run SQL in Supabase to fix Melinda's user_id:
  ```sql
  UPDATE whoop_connections 
  SET user_id = 'a64f2289-f8d9-409c-9807-c58996c13b20'
  WHERE whoop_member_id = '34690349';
  ```
- After fix: Melinda reconnects WHOOP once to refresh her token

### 🟡 Soon
- Remaining 11 Reframe missions to build (3-5, 7-14)
- Study dashboard (`study-dashboard.html`) — needs real participant data from Supabase
- Webhook integration for automatic WHOOP recovery data population
- `The Boy Who Closed a Door` subtitle finalisation

### 🟢 Working well
- Live WHOOP data: recovery, HRV, strain, sleep, workout
- 9-state scoring engine (3 red / 3 amber / 3 green)
- Lumen opening observation reads trend arc
- OAuth flow stable
- `app.purposefulchange.co.uk` live and verified

---

## How to Start a Session
1. Read this file
2. Check what's outstanding above
3. Ask Simon what he wants to work on
4. Before touching any file: fetch it fresh from GitHub or have Simon upload it — never work from memory
5. Always verify syntax with Node.js (`node --check`) before presenting files
6. Present files via bash tool outputs — never rely on Chrome browser downloads

---

## Common Debugging Commands
```bash
# Check syntax of a JS file
node --check api/whoop-data.js

# Check for non-ASCII chars
python3 -c "content=open('file.js').read(); print([(i,hex(ord(c)),c) for i,c in enumerate(content) if ord(c)>127][:5])"

# Find syntax error line
node --check file.js 2>&1
```

---

## Study Context
- **Research question:** Does body signal data create a better entry point into psychological coaching work than questionnaires or conversation alone?
- **Participants:** Simon + Melinda (Day 3 begins after next sleep)
- **Genuinely novel:** No published research combines HRV trend data with reflective coaching methodology
- **Direction:** 20-30 participants over 8 weeks → qualitative data on what shifts → publishable + commercially distinctive

---

*Last updated: April 9 2026*
