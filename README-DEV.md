# README-DEV — Purposeful Change / Body Signal
## Daily context file — read this at the start of every dev session
## FOR CLAUDE: Fetch fresh at https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md before doing anything else. Do not rely on memory.

---

## Who & What
**Simon Lamb** — coach, author, Purposeful Change. Working with Claude daily. Conversations get too large and must be started fresh — this file bridges the gap.

**Co-author:** Christina Watt (Reframe workbook)

---

## Two Products in This Repo

### 1. Body Signal (`app.purposefulchange.co.uk`)
Wearable integration tool. Connects WHOOP data to psychological coaching methodology. Shows daily recovery signal, scores it against personal baseline (9-state engine: 3 red / 3 amber / 3 green), and uses Lumen to surface psychological meaning from physiological patterns.

### 2. Reframe Workbook
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
| Old domain | `reframe-mission-1.vercel.app` — blocked by Google Safe Browsing (false positive submitted) |
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
| `wearable.html` | Main Body Signal page | Must pass `Authorization: Bearer [authToken]` to `/api/whoop-data` |
| `whoop-callback.html` | OAuth callback | Stores tokens in localStorage after WHOOP redirect |
| `api/whoop-data.js` | WHOOP data fetch + scoring | **Must be Edge function** (`export const config = { runtime: 'edge' }`) |
| `api/whoop-auth.js` | WHOOP OAuth flow | Uses PATCH not upsert; KNOWN_MEMBERS map for user_id lookup |
| `api/lumen.js` | Lumen AI companion | Proxies Anthropic API, requires Supabase JWT auth |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored; refreshes tokens |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `study-dashboard.html` | Researcher-only dashboard | Shows all participant data, PRR charts, Lumen stages |
| `start.html` | Product entry/choice page | Three paths: Learn It / Use It / Deepen It |
| `signin.html` | Auth gate | Single sign-in point for all product pages |
| `use-it.html` | Use It layer | Reusable daily tools including Body Signal |
| `dashboard.html` | Learn It / missions | 14 missions, tabbed nav |
| `privacy.html` | Privacy policy | Required for WHOOP developer registration |
| `README-DEV.md` | This file | Update at end of every session before closing |

---

## Architecture — Body Signal Data Flow
1. User signs in via `signin.html` → Supabase session persists across all pages
2. `wearable.html` passes `Authorization: Bearer [supabaseJWT]` header to `/api/whoop-data`
3. `whoop-data.js` decodes JWT → gets `user_id` → queries `whoop_connections` by `user_id`
4. Fetches 28 days from WHOOP v2 API using stored `access_token`
5. Auto-refreshes WHOOP token if expired using stored `refresh_token`
6. Computes personal baselines (28-day mean/SD) + z-scores
7. Runs 9-state scoring engine → returns scored data + trend arrays
8. `wearable.html` renders signal card + calls `/api/lumen` with trend arc as context
9. Lumen reads arc, names the turning point, invites exploration

---

## Supabase Tables
| Table | Purpose |
|---|---|
| `whoop_connections` | Links Supabase user_id -> WHOOP member_id + tokens |
| `daily_state` | Scored WHOOP data per day per user |
| `wearable_entries` | User journal entries (RLS enabled) |
| `study_participants` | Study participant tracking |
| `answers` | Reframe workbook answers (RLS enabled) |

---

## Critical Architecture Rules — READ THESE FIRST
1. `whoop-data.js` **must** use `export const config = { runtime: 'edge' }` — if missing it silently breaks
2. WHOOP v2 API needs full ISO datetime: `new Date().toISOString()` — NOT `.split('T')[0]`
3. Supabase token updates use **PATCH** not upsert — upsert causes 409 conflicts
4. `whoop_connections` lookup must be by `user_id` from JWT — NOT by `mid` from localStorage
5. Non-ASCII chars in JS (em dashes, box-drawing chars) break the Edge runtime — ASCII only in JS files
6. **Never use Chrome browser replace-all for code edits** — it corrupts code
7. Always verify JS syntax with `node --check` before presenting files
8. Watch for extra `)` on the `fetch('/api/whoop-data'` call in `wearable.html` — it's been introduced by patches twice

---

## 9-State Scoring Engine

**RED — excavation mode** (rec_z < -0.8, sleep ok, low strain = `red_psych` / HRV declining 3+ days = `red_trend` / high strain no workout = `red_strain`)

**AMBER — curiosity mode** (medium confidence red / recovery 34-66% no clear pattern = amber states)

**GREEN — glimmer mode** (rec_z > 0.5, HRV above baseline = `grn_thriving` / recovery rising after red = `grn_bounce` / 3+ consecutive strong = `grn_streak`)

Exploration Score: weighted sum of pattern components (0-3 noise, 4-6 nudge, 7+ explore, 10+ pattern cluster)

---

## Lumen Opening Observation
- Gets the full `recovery_trend` array — reads the arc not just today
- When recovery has turned a corner: explicitly names it ("dropped to X%, back to Y% today")
- Treats data as clue to psychological state — not a report
- Ends with a direct invitation to tap the explore button
- Falls back to static text if API unavailable
- Three distinct prompts: Trigger (red), Check In (amber), Glimmer (green)

---

## Known Issues / Outstanding Work

### CRITICAL — Cross-User Data Isolation Bug
Both Simon and Melinda see Simon's data. Two fixes needed:

**Step 1 — SQL in Supabase SQL Editor:**
```sql
UPDATE whoop_connections 
SET user_id = 'a64f2289-f8d9-409c-9807-c58996c13b20'
WHERE whoop_member_id = '34690349';
```

**Step 2 — Push from Claude outputs:**
- `api/whoop-data.js` — looks up by `user_id` from Supabase JWT in Authorization header
- `wearable.html` — sends `Authorization: Bearer [authToken]` header

After pushing: Melinda reconnects WHOOP once to store her token under her own user_id.

### Token Sustainability
WHOOP tokens expire hourly. Server-side refresh via webhook fires each morning. The `whoop-data.js` should auto-refresh using `refresh_token` from `whoop_connections` when `access_token` is expired — this avoids users ever needing to manually reconnect.

### Soon
- Remaining 11 Reframe missions (3-5, 7-14)
- Study dashboard: dynamic participant data from Supabase
- Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`

---

## Site Architecture / Navigation
```
index.html (public landing)
  -> signin.html (auth gate)
    -> start.html (choice: Learn It / Use It / Deepen It)
      -> dashboard.html (Learn It — missions, tabbed nav)
      -> use-it.html (Use It — daily tools)
        -> wearable.html (Body Signal)
          -> study-dashboard.html (researcher view)
```

---

## Research Paper
`body-signal-research-paper.docx` in repo. Contains full theory of change, 9-state formulae with scientific grounding, Exploration Score, Pattern Recurrence Rate as primary research metric, Signal to Meaning Map appendix.

**Core proposition:** "We use the body to surface patterns the mind hasn't admitted yet, and resolve them until they stop returning."

**The closed loop:** Body detects -> System interprets -> User reflects -> Lumen patterns -> Missions resolve -> Body changes -> Loop closes

---

## Study Context
- **Participants so far:** Simon + Melinda
- **Study day:** Check `daily_state` table for day count
- **Primary metric:** Pattern Recurrence Rate — same Lumen tag frequency per week, should decrease by week 8
- **Genuinely novel:** No published research combines HRV trend data with reflective coaching methodology

---

## How to Start a Session
1. Fetch this file fresh from GitHub
2. Check outstanding issues above — cross-user isolation is the top priority
3. Ask Simon what he wants to work on today
4. Before touching any file: fetch it fresh from GitHub raw URL
5. Verify syntax with `node --check` on any JS file before presenting
6. Present files via bash tool — never Chrome downloads
7. Update this README at end of session before closing

---

## Common Commands
```bash
# Check JS syntax
node --check file.js

# Find non-ASCII chars in JS
python3 -c "
content = open('file.js', 'rb').read().decode('utf-8')
bad = [(i, hex(ord(c)), c) for i, c in enumerate(content) if ord(c) > 127]
print(bad[:10])
"

# Fix non-ASCII
python3 -c "
content = open('file.js', 'rb').read().decode('utf-8')
import re
fixed = re.sub(r'[^\x00-\x7F]', '-', content)
open('file.js', 'w').write(fixed)
"

# Find syntax error line
node --check file.js 2>&1
```

---

*Last updated: April 9 2026 — end of session 2 (Body Signal live, cross-user bug identified, fixes ready in outputs)*
