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
  -> dashboard.html (Learn It — 14 missions, three-tab nav)
  -> wearable.html (Body Signal — Use It)
  -> study-dashboard.html (researcher view — all participant data)
  -> rewrite.html (Rewrite It — declaration, balcony, practices, history)
privacy.html (required for WHOOP developer registration)
```

**Three-tab nav** (added 10 Apr 2026) — consistent across dashboard.html, wearable.html, rewrite.html:
- Learn It → `/dashboard.html` (active on dashboard)
- Use It → `/wearable.html` (active on wearable)
- Rewrite It → `/rewrite.html` (active on rewrite)

`start.html` — Path 3 is now **Rewrite It** (dark card, yellow accents). "Deepen It / Coming Soon" removed entirely.

---

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `wearable.html` | Body Signal main page | Passes `Authorization: Bearer [authToken]` to `/api/whoop-data`. Has localStorage→Supabase sync (syncPendingEntries) added 10 Apr PM. |
| `rewrite.html` | Rewrite It — 4 screens | Tree / Balcony / Practices / History. Auth guard → `/signin.html`. SVG icons only. March 2025 Supabase anon key. |
| `dashboard.html` | Learn It — missions | 14 missions, three-tab nav |
| `start.html` | Platform entry page | Three paths: Learn It / Use It / Rewrite It |
| `whoop-callback.html` | WHOOP OAuth callback | Stores tokens in localStorage after redirect |
| `signin.html` | Auth gate | Single sign-in for all pages |
| `study-dashboard.html` | Researcher view | All participant data, PRR charts, Lumen stages |
| `privacy.html` | Privacy policy | Required for WHOOP dev registration |
| `api/whoop-data.js` | WHOOP fetch + scoring engine | **Edge function.** Composite load index, guardrails, 9 states |
| `api/whoop-auth.js` | WHOOP OAuth flow | Fixed 10 Apr PM — uses SUPABASE_SERVICE_KEY (not anon key) to resolve user_id. Check-then-PATCH-or-INSERT pattern. No upsert. |
| `api/whoop-refresh.js` | Token refresh cron | **Node.js `module.exports`** — NOT Edge. Runs every 45 min. Fixed 10 Apr PM. |
| `api/lumen.js` | Lumen AI companion | Proxies Anthropic API, requires Supabase JWT auth |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | Daily balcony reminder. Node.js. Twilio env vars not yet set. |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `vercel.json` | Rewrites + cron schedule | `*/45 * * * *` for whoop-refresh. `* * * * *` for nudge-whatsapp. |
| `README-DEV.md` | This file | Update at end of every session before closing |

---

## Supabase Tables (all 16, `public` schema)

### wearable_entries columns (actual — verified 10 Apr 2026)
`id, user_id, created_at, mode, pattern_id, pattern_title, recovery, hrv, strain, sleep_score, answers (jsonb), lumen_reply, tags, feedback_score, feedback_text`
Note: column is `mode` NOT `signal_state`. Column is `pattern_title` NOT `lumen_opening`.

| Table | Purpose |
|---|---|
| `whoop_connections` | WHOOP OAuth tokens per user. Has `expires_at` column. PATCH not upsert. |
| `wearable_entries` | Body Signal sessions — see column list above |
| `daily_state` | Raw scored WHOOP metrics per user per day |
| `answers` | Reframe mission answers (RLS enabled) |
| `entries` | Reframe mission entries |
| `lumen_instructions` | Per-user Lumen system context |
| `lumen_stage` | Lumen arc stage tracking (Stage 1→2→3) |
| `pattern_recurrence_rate` | Primary study metric |
| `wearable_pattern_summary` | View — pattern frequency per user |
| `weekly_study_summary` | Weekly aggregation |
| `study_participants` | Study cohort record |
| `rewrite_trees` | Rewrite It — declaration + identity shift per user (one active per user) |
| `rewrite_beliefs` | Rewrite It — belief/value from→toward pairs |
| `rewrite_practices` | Rewrite It — practices (what/when/where/how/who/HALS/measure) |
| `rewrite_diary` | Rewrite It — daily balcony entries + practice check-ins |
| `rewrite_nudge_settings` | Rewrite It — WhatsApp nudge number + time |

All 5 rewrite tables have RLS enabled.

---

## Environment Variables (Vercel — all environments)
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | `https://aoqjfqmlcccsosddqnws.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key for server-side Supabase calls |
| `SUPABASE_ANON_KEY` | **NOT SET** — do not use. Use SUPABASE_SERVICE_KEY for user resolution in whoop-auth.js |
| `WHOOP_CLIENT_ID` | WHOOP OAuth app client ID |
| `WHOOP_CLIENT_SECRET` | WHOOP OAuth app client secret |
| `ANTHROPIC_API_KEY` | Claude API key for Lumen |
| `CRON_SECRET` | Secures cron endpoints — whoop-refresh + nudge-whatsapp |
| `TWILIO_ACCOUNT_SID` | WhatsApp nudge — **NOT YET SET** |
| `TWILIO_AUTH_TOKEN` | WhatsApp nudge — **NOT YET SET** |
| `TWILIO_WHATSAPP_FROM` | e.g. `whatsapp:+14155238886` — **NOT YET SET** |

---

## Critical Architecture Rules — READ THESE EVERY SESSION
1. **`whoop-data.js` uses Edge runtime** — `export const config = { runtime: 'edge' }` must stay.
2. **All other API files use Node.js** — `module.exports = async function(req, res)`. Never add Edge config.
3. **`whoop-refresh.js` must be Node.js** — Edge runtime causes it to be silently skipped by the build.
4. **WHOOP v2 API needs full ISO datetime** — `new Date().toISOString()` NOT `.split('T')[0]`
5. **Supabase token updates use PATCH** — not upsert. Upsert causes 409 conflicts.
6. **JWT is sole source of `user_id`** — look up `whoop_connections` by `user_id` from JWT. Never use `mid` from localStorage.
7. **No KNOWN_MEMBERS map** — removed. JWT only.
8. **Non-ASCII chars in JS break Edge runtime** — em dashes, smart quotes, box-drawing chars cause silent failures. ASCII only in JS files.
9. **Never use Chrome browser replace-all for code edits** — corrupts code.
10. **Always verify JS syntax** — `node --check file.js` before presenting any JS file.
11. **Watch for extra `)` on the `fetch('/api/whoop-data'` call in `wearable.html`** — introduced by patches twice before.
12. **Supabase anon key** — use the March 2025 key matching `dashboard.html`. The old Feb 2024 key causes 401s. `SUPABASE_ANON_KEY` env var does NOT exist in Vercel — use `SUPABASE_SERVICE_KEY` for server-side user resolution.
13. **Icons** — SVG stroke icons only. No emoji in UI. Bottom nav 20×20 SVG. Empty state 40×40 SVG.
14. **wearable_entries columns** — `mode` not `signal_state`. `pattern_title` not `lumen_opening`. Always check column names before querying.
15. **localStorage sync** — wearable.html saves to localStorage first then Supabase. `syncPendingEntries()` runs on init to retry failed saves. Entries missing from Supabase may be in localStorage on the user's device.

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
12. Entry saved to localStorage immediately, then Supabase. If Supabase fails, marked `pendingSync: true` and retried on next load.

---

## Scoring Engine — 9 States
**RED** — `red_psych` (rec_z < -0.8, sleep adequate, low strain) / `red_trend` (HRV declining 3+ days, no physical cause, ≥7 days history) / `red_strain` (high strain, no workout)
**AMBER** — `amb_load` / `amb_trend` / `amb_recovery` / `amb_volatile` (HRV CV, added 10 Apr)
**GREEN** — `grn_thriving` / `grn_bounce` / `grn_streak`

### Scientific Guardrails (WHOOP AI validated 9 Apr 2026)
1. Recovery ≥ 67% AND HRV ≥ baseline AND low strain → block all amber/red trend states
2. `red_trend` requires ≥7 days history — under 7 downgrades to `amb_trend`
3. Recovery ≥ 67% blocks `red_trend` regardless of HRV trend

### Composite Load Index
HRV 40% / Recovery 25% / Sleep consistency 20% / Respiratory rate 15%
2+ signals impaired → escalate one level.

---

## The Full Methodology Loop — Signal to Identity Shift

This is the core process the platform enables. Documented from Jackson's session (10 Apr 2026) as the first complete case study.

### The Arc
```
Signal → Body → Questions → Belief Named → Origin Surfaced → Reframe → Practice → Identity Shift → Physiological Confirmation
```

### What the platform produces at the end of a session (Rewrite It output)

**1. The Declaration**
"I am choosing to be someone who [identity claim]."
Identity-level, present tense, specific to the belief surfaced.

**2. The Identity Shift — From / Toward**
From: the HALS-driven identity that has been running
Toward: the more adaptive identity being chosen

**3. The Belief Shift — From / Toward**
From: the exact belief as articulated in the session
Toward: the new belief arrived at through the conversation (not imposed)

**4. The HALS Being Revised**
The Historic Adaptive Life Strategy named — including origin (intergenerational where relevant)

**5. The Practice — What / When / Where / Who / Why**
Specific, embodied, scheduled. A vote for the new identity cast repeatedly.

**6. The Measure**
"I will know it is working when..." — qualitative + physiological (Body Signal arc)

### Jackson's case (10 Apr 2026) — reference example
- **Signal:** red_psych, recovery 23%, HRV declining, no physical cause
- **Pattern questions:** red_psych set (4 questions)
- **Belief surfaced:** "If I stop, I am lazy"
- **Origin:** Intergenerational — family history of working hard and being useful. The HALS came before him.
- **Declaration:** "I am choosing to be someone who deserves to rest."
- **Identity from:** Someone whose worth is conditional on output
- **Identity toward:** Someone who leads from recovery
- **Belief from:** "If I stop, I am lazy"
- **Belief toward:** "I deserve to rest" / "Rest is what makes everything else possible"
- **Practice:** Hit golf balls at the range or throw darts, twice a week, in the diary
- **Measure:** WHOOP recovery stops trending red without physical cause
- **Full case study:** `jackson-case-study.docx` in project files

---

## Rewrite It — Architecture
**Five Supabase tables:** `rewrite_trees`, `rewrite_beliefs`, `rewrite_practices`, `rewrite_diary`, `rewrite_nudge_settings` — all with RLS.

**Four screens:** Tree / Balcony / Practices / History

**Commitment object:** what / when / where / how / who / HALS being revised / measure

**Daily balcony practice (three questions):**
1. Where did I act from the more whole version of myself today?
2. What do I appreciate about how I showed up?
3. One thing tomorrow I want to bring my declaration into

**WhatsApp nudge:** Twilio Business API. Daily at person-set time. Skips if already done. Personalised with declaration. Twilio env vars not yet set.

---

## Study Outcome Measure
After each Lumen conversation: "Did this process surface something useful?" 1-5 + optional free text.
Saved to `wearable_entries.feedback_score` + `wearable_entries.feedback_text`.

---

## Outstanding Work

### Immediate
- [ ] All 4 participants reconnect WHOOP once (cron now running, whoop-auth.js fixed)
- [ ] Add Jackson to `study_participants` table
- [ ] Retrieve Jackson's session from his localStorage (session from 10 Apr visible under Entries on his device)
- [ ] Set Twilio env vars to activate WhatsApp nudges
- [ ] Simon enters first Rewrite It declaration + balcony entry to test end-to-end

### Body Signal
- [ ] HRV volatility (CV) — WHOOP AI validation session needed
- [ ] Skin temperature — lower priority

### Study
- [ ] SRIS baseline — all 4 participants before 30-day mark
- [ ] Pattern Recurrence Rate first analysis at 30 days (Melinda: most history)
- [ ] Jackson 30-day follow-up — does Body Signal confirm the identity shift?

### Reframe workbook
- [ ] Missions 3-5, 7-14 to build (1, 2, 6 live)

### Infrastructure
- [ ] Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`

---

## Research Paper
File: `body-signal-research-paper.docx`
Last updated: 10 Apr 2026
Key additions: Cycle of Constructed Experience (Barrett 2017, McEwen, Porges), HALS concept, 9-state scoring, composite load index, HRV volatility, study design.

**Case study:** `jackson-case-study.docx` — complete narrative arc from signal to identity shift. Eight sections. Includes the intergenerational HALS layer, the two-stage reframe ("I deserve to rest" → "Take time to rest to not burn yourself out"), and the structured Rewrite It output with declaration, from/toward shifts, practice, and measure. To be updated at 30 days with Jackson's physiological arc.

---

## How to Start a Session
1. Fetch this file fresh: `https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md`
2. Read outstanding issues
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


---

## Case Study — Jackson (10 Apr 2026)

File: `jackson-case-study.docx` (in project files)

This is the primary case study for the research paper. One participant, one morning, the complete methodology made visible. Use this as the narrative anchor for the paper.

### The Arc

**Signal:** 23% recovery, HRV below baseline and declining, no physical cause. Scoring engine: `red_psych`.

**The four questions (red_psych pattern):**
1. What has been sitting with you lately? — "Rugby training and a few beers. Feeling like I have to keep going to keep things afloat."
2. Where have you felt tension in your body this week? — "Right between my shoulders."
3. What were you believing to be true about yourself that felt uncomfortable? — "I have to not let people down. If I stop it costs others dearly."
4. What would it mean if you let yourself fully rest right now? — "I would let people down."

**Lumen's move:** Named that the rugby was not the cause. The real pattern: "If I stop, I am lazy."

**The intergenerational layer:** Lumen asked where that belief came from. Jackson recognised it wasn't just his experience — it came before him. A family history of working hard and being useful. A HALS borrowed from a different generation, a different context.

**The reframe (arrived at, not imposed):**
- First: "I deserve to rest." (identity-level — worthiness, not strategy)
- Then: "Take time to rest to not burn yourself out." (functional translation)

**The practice:**
- What: Hit golf balls at the range / throw darts
- When: Twice a week, in the diary
- Why it works: Each act is a vote for the new identity

**The Rewrite It output (Section 7 of the case study):**
- Declaration: "I am choosing to be someone who deserves to rest."
- Identity shift from/toward: conditional worth → leads from recovery
- Belief shift from/toward: "If I stop I am lazy" → "I deserve to rest"
- HALS being revised: inherited belief that worth = output, built across generations
- Practice: what/when/where/who/measure
- Measure: guilt before rest stops; Monday mornings feel different; WHOOP recovery stops trending red

### What to watch at 30 days
- HRV stabilising toward baseline
- Recovery climbing
- `red_psych` pattern recurrence rate declining
- Signal state moving from red toward amber/green

### Note on data
Jackson's session entry did not save to Supabase on 10 Apr (token expired at time of session). wearable.html now has `syncPendingEntries()` — runs on load, retries any localStorage entry that failed to write to Supabase. His next session will save correctly.


---

## Session Log
| Date | Key work done |
|---|---|
| ~7 Apr 2026 | Body Signal MVP. WHOOP OAuth. 9-state scoring engine. Lumen opening observation. wearable.html live. |
| 8 Apr 2026 | Cross-user isolation fixed (JWT-only lookup). WHOOP auth refactored. Melinda connected. 3 participants live. |
| 9 Apr 2026 | Scoring engine WHOOP AI validated. Guardrails added. Composite load index built. Feedback measure deployed. Research paper updated. Rewrite It conceived + mocked up. |
| 10 Apr 2026 AM | rewrite.html built (4 screens, SVG icons, 5 Supabase tables with RLS). HRV volatility + AMBER_VOLATILE added. Jackson (4th participant) connected. CRON_SECRET added. |
| 10 Apr 2026 PM | WHOOP token expiry fixed (whoop-auth.js — SUPABASE_SERVICE_KEY for user resolution, PATCH not upsert). whoop-refresh.js Node.js runtime confirmed working. localStorage→Supabase sync added to wearable.html. Three-tab nav across all pages. start.html — Rewrite It replaces Deepen It. Auth bug fixed in rewrite.html (wrong anon key). Jackson case study written — complete arc from signal to identity shift including intergenerational HALS layer. README-DEV established as cross-session context. |

---
*Update this file at the end of every session. It is the memory between chats.*
