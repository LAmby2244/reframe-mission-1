# README-DEV — Purposeful Change Platform
## Single source of truth across all Claude development sessions
## FOR CLAUDE: Fetch fresh at https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md at the start of every session. Do not rely on memory.

---

## Who & What
**Simon Lamb** — coach, author, Purposeful Change. Working with Claude daily across multiple chats. Conversations get too large and must be started fresh — this file bridges every gap.

**Co-author:** Christina Watt (Reframe workbook)

**Core proposition:** "We use the body to surface patterns the mind hasn't admitted yet, and resolve them until they stop returning."

---

## Platform Architecture

**Rewrite Your Life** — the platform name

| Layer | Description | URL |
|---|---|---|
| **Learn It** | 14 sequential Reframe missions | `/dashboard.html` |
| **Use It** | Body Signal + daily tools | `/wearable.html` |
| **Rewrite It** | The living practice. Where it all lands. | `/rewrite.html` |

---

## Stack

| Thing | Value |
|---|---|
| GitHub | `github.com/LAmby2244/reframe-mission-1` |
| Vercel project | `prj_XhDamdR45TOFhqZqHTk7A6NKWdbU` |
| Vercel team | `team_QdSm8BPRfWR7RxBzM0CtW9Ky` |
| Vercel plan | Pro |
| Supabase | `aoqjfqmlcccsosddqnws` |
| Live domain | `app.purposefulchange.co.uk` |
| DNS | CNAME `fb96c77117a481ee.vercel-dns-017.com` in 123-reg |
| Old domain | `reframe-mission-1.vercel.app` — blocked by Google Safe Browsing (false positive submitted) |
| Brand font | Rubik |
| Framework | Vanilla HTML/JS + Vercel serverless functions + Supabase auth |

---

## Study Participants

| Person | Supabase user_id | WHOOP member_id | Start |
|---|---|---|---|
| Simon | b34d797c-80b7-4c15-94ac-159ef813e202 | 36136954 | 5 Apr 2026 |
| Monica | a63f92be-e643-44e2-8775-5fa9c6fc6838 | 36285499 | 6 Apr 2026 |
| Melinda | a64f2289-f8d9-409c-9807-c58996c13b20 | 34690349 | 17 Mar 2026 |
| Jackson | ce31c087-3517-409f-a266-b4c46f978c23 | 23042959 | 10 Apr 2026 |

---

## Site Navigation

```
index.html (public landing)
  -> signin.html (auth gate — single sign-in point for all pages)
    -> start.html (choice: Learn It / Use It / Rewrite It)
      -> dashboard.html (Learn It — 14 missions, tabbed nav)
      -> wearable.html (Body Signal — Use It)
        -> study-dashboard.html (researcher view — all participant data)
      -> rewrite.html (Rewrite It — declaration, balcony, practices, history)
privacy.html (required for WHOOP developer registration)
```

---

## Key Files

| File | Purpose | Notes |
|---|---|---|
| `wearable.html` | Body Signal main page | Passes `Authorization: Bearer [authToken]` to `/api/whoop-data` |
| `rewrite.html` | Rewrite It — 4 screens | Tree / Balcony / Practices / History |
| `dashboard.html` | Learn It — missions | 14 missions, tabbed nav |
| `whoop-callback.html` | WHOOP OAuth callback | Stores tokens in localStorage after redirect |
| `start.html` | Platform entry page | Three paths: Learn It / Use It / Rewrite It |
| `signin.html` | Auth gate | Single sign-in for all pages |
| `study-dashboard.html` | Researcher view | All participant data, PRR charts, Lumen stages |
| `privacy.html` | Privacy policy | Required for WHOOP dev registration |
| `api/whoop-data.js` | WHOOP fetch + scoring engine | Edge function. Composite load index, guardrails, 9 states |
| `api/whoop-auth.js` | WHOOP OAuth flow | PATCH not upsert. JWT is sole source of user_id. No KNOWN_MEMBERS map. |
| `api/whoop-refresh.js` | Token refresh cron | **Node.js `module.exports`** — NOT Edge. Runs every 45 min. |
| `api/lumen.js` | Lumen AI companion | Proxies Anthropic API, requires Supabase JWT auth |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | Daily balcony reminder |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `vercel.json` | Rewrites + cron schedule | `*/45 * * * *` for whoop-refresh |
| `README-DEV.md` | This file | Update at end of every session before closing |

---

## Supabase Tables (all 16, `public` schema)

| Table | Purpose |
|---|---|
| `whoop_connections` | WHOOP OAuth tokens per user. Unique constraint on `whoop_member_id`. |
| `wearable_entries` | Body Signal sessions — signal state, answers, Lumen reply, `feedback_score`, `feedback_text` |
| `daily_state` | Raw scored WHOOP metrics per user per day |
| `answers` | Reframe mission answers (RLS enabled) |
| `entries` | Reframe mission entries |
| `lumen_instructions` | Per-user Lumen system context |
| `lumen_stage` | Lumen arc stage tracking (Stage 1→2→3) |
| `pattern_recurrence_rate` | Primary study metric |
| `wearable_pattern_summary` | View — pattern frequency per user |
| `weekly_study_summary` | Weekly aggregation |
| `study_participants` | Study cohort record |
| `rewrite_trees` | Rewrite It — declaration + identity shift per user |
| `rewrite_beliefs` | Rewrite It — belief/value from→toward pairs |
| `rewrite_practices` | Rewrite It — practices (what/when/where/how/who/HALS/measure) |
| `rewrite_diary` | Rewrite It — daily balcony entries + practice check-ins |
| `rewrite_nudge_settings` | Rewrite It — WhatsApp nudge number + time |

---

## Environment Variables (Vercel — all environments)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | `https://aoqjfqmlcccsosddqnws.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key for server-side Supabase calls |
| `WHOOP_CLIENT_ID` | WHOOP OAuth app client ID |
| `WHOOP_CLIENT_SECRET` | WHOOP OAuth app client secret |
| `ANTHROPIC_API_KEY` | Claude API key for Lumen |
| `CRON_SECRET` | Secures `/api/whoop-refresh` cron endpoint (added 10 Apr 2026) |

---

## Critical Architecture Rules — READ THESE EVERY SESSION

1. **`whoop-data.js` uses Edge runtime** — `export const config = { runtime: 'edge' }` must stay. If missing it silently breaks.
2. **All other API files use Node.js** — `module.exports = async function(req, res)`. Never add Edge config to these.
3. **`whoop-refresh.js` must be Node.js `module.exports`** — Edge runtime causes it to be silently skipped by the build. This was a bug (Apr 10).
4. **WHOOP v2 API needs full ISO datetime** — `new Date().toISOString()` NOT `.split('T')[0]`
5. **Supabase token updates use PATCH** — not upsert. Upsert causes 409 conflicts.
6. **JWT is sole source of `user_id`** — look up `whoop_connections` by `user_id` from JWT. Never use `mid` from localStorage.
7. **No KNOWN_MEMBERS map** — removed. JWT only.
8. **Non-ASCII chars in JS break Edge runtime** — em dashes, smart quotes, box-drawing chars all cause silent failures. ASCII only in JS files.
9. **Never use Chrome browser replace-all for code edits** — corrupts code.
10. **Always verify JS syntax** — `node --check file.js` before presenting any JS file.
11. **Watch for extra `)` on the `fetch('/api/whoop-data'` call in `wearable.html`** — introduced by patches twice before.

---

## Data Flow — Body Signal

1. User signs in → `signin.html` → Supabase session persists across all pages
2. `wearable.html` passes `Authorization: Bearer [supabaseJWT]` to `/api/whoop-data`
3. `whoop-data.js` decodes JWT → `user_id` → queries `whoop_connections` by `user_id`
4. Fetches 28 days WHOOP v2 API using stored `access_token`
5. Auto-refreshes token if expired using `refresh_token`
6. Computes 28-day baselines + z-scores
7. Runs composite load index + 9-state scoring engine
8. Returns scored data + trend arrays
9. `wearable.html` renders signal card → calls `/api/lumen` with arc as context
10. Lumen reads arc, names turning point, invites exploration
11. After conversation: feedback card ("Did this process surface something useful?" 1-5)

---

## Scoring Engine — 9 States

**RED — excavation mode**
- `red_psych` — rec_z < -0.8, sleep adequate, low strain
- `red_trend` — HRV declining 3+ days, no physical cause. Requires ≥7 days history.
- `red_strain` — high strain, no workout logged

**AMBER — curiosity mode**
- `amb_load` — medium confidence red signals
- `amb_trend` — early HRV drift, 2-3 days
- `amb_recovery` — recovery rising after red period
- `amb_volatile` — HRV instability / high CV (added 10 Apr 2026)

**GREEN — glimmer mode**
- `grn_thriving` — rec_z > 0.5, HRV above baseline
- `grn_bounce` — recovery rising after red
- `grn_streak` — 3+ consecutive strong days

**Exploration Score:** weighted sum 0-3 noise / 4-6 nudge / 7+ explore / 10+ pattern cluster

### Scientific Guardrails (WHOOP AI validated 9 Apr 2026)
1. Recovery ≥ 67% AND HRV ≥ baseline AND low strain → block all amber/red trend states
2. `red_trend` requires ≥7 days history — under 7 downgrades to `amb_trend`
3. Recovery ≥ 67% blocks `red_trend` regardless of HRV trend

### Composite Load Index (WHOOP AI validated 9 Apr 2026)
| Signal | Weight |
|---|---|
| HRV | 40% |
| Recovery | 25% |
| Sleep consistency | 20% |
| Respiratory rate | 15% |

2+ signals impaired → escalate one level. Sleep consistency exception: chronic (5+ days, >60 min SD) + borderline HRV → can push through green guardrail to amber.

**New response fields:** `composite_load`, `impaired_signals`, `sleep_consistency_sd_mins`, `rr_score`

### HRV Volatility
Added 10 Apr 2026. Night-to-night coefficient of variation. Needs focused WHOOP AI validation session.

---

## Rewrite It — Architecture

**Four screens (bottom nav):**
- **Tree** — Declaration hero, identity shift (running as → becoming), beliefs/values (from/toward), today's practices as checkable pills, 7-day streak bar
- **Balcony** — Daily practice. Three questions + Lumen reflection. Marks complete when done.
- **Practices** — All practices with full detail (what/when/where/how/who/HALS/measure). WhatsApp nudge settings.
- **History** — All balcony entries, Body Signal state badge, Lumen replies

**Five dimensions of the shift:**
- Identity — who I am becoming
- Values — what I am reclaiming
- Beliefs — old releasing / new chosen
- Behaviours — the specific small daily vote
- Impact — what changes in me and others

**Lumen arc stages in Rewrite It:**
- Stage 1 (entries 1-3): reflects individual entries back
- Stage 2 (entries 4-8): names the pattern explicitly
- Stage 3 (entries 9+): tracks absence of previously recurring patterns — "This pattern hasn't appeared in 9 days."

---

## Study Outcome Measure (live as of 9 Apr 2026)
After each Lumen conversation: **"Did this process surface something useful?"** 1-5 + optional free text.
Saved to `wearable_entries.feedback_score` + `wearable_entries.feedback_text`.

---

## Current Known Issue — WHOOP Token Expiry

**Symptom:** "WHOOP unreachable · Reconnect →" on all 4 participants. Tokens expire ~1hr after issue.

**Root cause:** `whoop-refresh.js` was written with Edge runtime syntax (`export const config`, `export default`). Build silently skips it. Zero cron executions.

**Fix:** New `whoop-refresh.js` using `module.exports` Node.js syntax — ready in outputs, needs pushing.

**After fix:** Everyone reconnects WHOOP once to seed a fresh token. Cron fires every 45 min thereafter.

**Verify fix worked:** Check build log — `whoop-refresh.js` should appear in the Compiling list.

---

## Outstanding Work

### Immediate
- [ ] Push fixed `api/whoop-refresh.js` (Node.js version) to GitHub
- [ ] Verify build log shows it compiling
- [ ] All 4 participants reconnect WHOOP once
- [ ] Add Jackson to `study_participants` table

### Body Signal
- [ ] HRV volatility (CV) — WHOOP AI validation session needed
- [ ] Skin temperature — lower priority, after HRV volatility

### Study
- [ ] SRIS baseline — run with all 4 participants before 30-day mark
- [ ] Pattern Recurrence Rate first analysis at 30 days (Melinda: most history)
- [ ] Lumen stage 1→2→3 transitions — verify logging correctly

### Rewrite It
- [ ] Test with real data — Simon enters first declaration + balcony entry
- [ ] RLS policies on all 5 rewrite tables (currently unrestricted)
- [ ] WhatsApp nudge cron — verify functional

### Reframe workbook
- [ ] Missions 3-5, 7-14 to build (1, 2, 6 live)

### Infrastructure
- [ ] Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`

---

## Research Paper
File: `body-signal-research-paper.docx`
Last updated: 10 Apr 2026

Contains: theory of change, 9-state formulae with scientific grounding, composite load index, guardrails, Exploration Score, Pattern Recurrence Rate, Signal to Meaning Map, study design (Phase 1 family cohort), literature references (Porges, Pennebaker, Shaffer & Ginsberg, Kim et al. 2018, Lehrer & Gevirtz 2014 etc.)

---

## How to Start a Session

1. Fetch this file fresh: `https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md`
2. Read outstanding issues — token expiry fix is top priority
3. Ask Simon what he wants to work on
4. Before touching any file: fetch it fresh from GitHub raw URL
5. Run `node --check` on any JS before presenting
6. Check for non-ASCII chars in any JS file before pushing
7. Update this README at end of session before closing

---

## Common Commands

```bash
# Check JS syntax
node --check file.js

# Find non-ASCII chars (silent killers in Edge functions)
python3 -c "
content = open('file.js', 'rb').read().decode('utf-8')
bad = [(i, hex(ord(c)), c) for i, c in enumerate(content) if ord(c) > 127]
print(bad[:10])
"

# Fix non-ASCII
python3 -c "
import re
content = open('file.js', 'rb').read().decode('utf-8')
fixed = re.sub(r'[^\x00-\x7F]', '-', content)
open('file.js', 'w').write(fixed)
"
```

---

## Session Log

| Date | Key work done |
|---|---|
| ~7 Apr 2026 | Body Signal MVP. WHOOP OAuth. 9-state scoring engine. Lumen opening observation. wearable.html live. |
| 8 Apr 2026 | Cross-user isolation fixed (JWT-only lookup). WHOOP auth refactored. Melinda connected. 3 participants live. |
| 9 Apr 2026 | Scoring engine WHOOP AI validated. Guardrails added. Composite load index built. Feedback measure deployed. Research paper updated. Rewrite It conceived + mocked up. Platform named: Learn It / Use It / Rewrite It. |
| 10 Apr 2026 AM | rewrite.html built and deployed (50k chars, 4 screens). All 16 Supabase tables confirmed. HRV volatility + AMBER_VOLATILE added. Jackson (4th participant) connected. cron_secret env var added. |
| 10 Apr 2026 PM | Cron bug identified (Edge vs Node.js runtime — whoop-refresh silently skipped). Fix built. README-DEV.md created as cross-session context file. |

---

*Update this file at the end of every session. It is the memory between chats.*
