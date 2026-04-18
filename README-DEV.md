# README-DEV — Purposeful Change Platform
## Single source of truth across all Claude development sessions
## FOR CLAUDE: Fetch fresh at https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md at the start of every session. Do not rely on memory.
## Last updated: 2026-04-18 PM — 4-step roll-out plan documented. Step 1 done. Steps 2-4 outstanding. Gap closed.

---

## THE 4-STEP ROLL-OUT PLAN — sort the data gathering + arc before inviting trial users

Fix the research instrument first. Everything else (roll-out, nudges, new missions) waits until these four steps are clean.

**Step 1 — Phase 1: score every arc day and write to `daily_state` on page load** ✅ **DONE 18 Apr 2026 AM**
- Every `whoop-data.js` call scores up to 7 days and batch-upserts them into `daily_state`
- Commits: `fee670bf` (score all days) -> `79fb07dc` (await the write) -> `a74b6cd8` (on_conflict param)
- Verified 7 rows written for Simon Apr 11-18 (Apr 15 missing = genuine WHOOP dropout, not a bug)
- First red_psych captured in live study conditions (Simon 17 Apr, 46% recovery / HRV 34.1ms / rec_z -1.42)

**Step 2 — Phase 2: daily cron (~09:00 UTC) for all active study_participants** ⬜ NOT STARTED
- Currently `daily_state` only gets written when someone opens the app
- Participants who skip a day = no row = research gap disguised as a user-engagement gap
- Cron flow: for each active study_participant -> refresh WHOOP token if needed -> fetch WHOOP v2 (yesterday's cycle) -> run same scoring engine as `whoop-data.js` -> upsert to `daily_state` with `?on_conflict=user_id,date`
- Keep `whoop-data.js` page-load write (it's idempotent via the same upsert) — the cron just guarantees coverage
- Must use the exact same scoring code path as `whoop-data.js` — extract the scoring logic into a shared module OR call the same endpoint from the cron

**Step 3 — Arc-colour patches 2 + 3 (so Lumen reads what the user sees)** ⬜ NOT STARTED
- Patch 1 shipped 17 Apr: today's arc dot uses `signal_state` (not recovery band)
- Patches 2 + 3 fix Lumen's arc summary strings, which still describe days using raw recovery bands — so Lumen says "amber" for a day the dot shows red
- **Patch 2** — in `renderLumenOpening()`, replace the recovery-band helper (e.g. `const band = a.recovery_pct >= 67 ? 'green' : ...`) with a `stateBand(s)` helper reading `a.signal_state`
- **Patch 3** — same transformation in `triggerLumenReflection()`, inside the `arcSeries.map` block
- Related (group under step 3 when building): historical arc dots should also use `signal_state`, not recovery threshold. Needs `daily_state` lookup per day fed into `arc_series` in `whoop-data.js`. Once Step 2 is live this is easy — just join the cron output in
- **Deploy protocol reminder: this is the patch that triggered the 18 Apr PLACEHOLDER incident.** Use Rule 41: fetch raw file -> Python string replacement in bash -> `node --check` -> present for Simon to push via GitHub web editor. Do NOT use `push_files` with any placeholder string.

**Step 4 — Research-design gap-labelling in `daily_state.reason_missing`** ⬜ NOT STARTED
- Requires new column: `ALTER TABLE daily_state ADD COLUMN reason_missing text` (nullable)
- When a day has no complete row, distinguish:
  - `pre_enrolment` — user joined the study after this date
  - `user_didnt_open` — user enrolled, app not opened, cron wrote the row with partial data (requires Step 2)
  - `whoop_couldnt_score` — WHOOP API returned no recovery (band not worn, not enough sleep tracked)
  - `band_dropout` — explicit "no recovery record" returned from WHOOP
- Populated by both `whoop-data.js` (page-load writes) AND the Phase 2 cron
- Without this, missing rows at the 30/60/90-day PRR analysis are ambiguous — can't separate user-behaviour signal from data-instrument noise
- Gates the first credible PRR analysis

Once all four are done -> clean research instrument -> invite trial users.

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
| **Use It** | Hub: Tame a Trigger + Body Signal | `/use-it.html` |
| **Rewrite It** | The living practice. Where it all lands. | `/rewrite.html` |

---

## Stack
| Thing | Value |
|---|---|
| GitHub | `github.com/LAmby2244/reframe-mission-1` |
| Vercel project | `prj_XhDamdR45TOFhqZqHTk7A6NKWdbU` |
| Vercel team | `team_QdSm8BPRfWR7RxBzM0CtW9Ky` |
| Vercel team slug | `simons-projects-9218b53a` |
| Vercel plan | Pro |
| **Node.js version** | **20.x** — pinned in Vercel project settings. Do NOT change. Node 24 causes "Unhandled type: Identifier" build errors. |
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

All 4 participants in `study_participants` table (added 12 Apr 2026).

### First red day captured — 17 Apr 2026 (Simon)
- Recovery 46%, HRV 34.1ms, rec_z -1.42, composite_load 0.49
- Signal state: `red_psych` / medium confidence
- WHOOP's native band showed amber; engine correctly surfaced this as red because rec_z was deeply below baseline with HRV also below baseline and no sleep/strain explanation
- Product insight: arc should show `signal_state`, not WHOOP's recovery band (Step 3 patches above)

---

## The 10 Signal Archetypes (named + live as of 17 Apr 2026)

One archetype per underlying scoring-engine state. Each has a short name, description, technical data line, and an abstract SVG icon (no emoji).

**RED (3):**
- **The Quiet Cost** — `red_psych`. Low recovery + good sleep + low strain. Something non-physical is costing you. SVG: burning-down candle with wax pool.
- **The Build Up** — `red_trend`. HRV declining 3+ days, not physical. Something has been accumulating. SVG: stacked horizontal bars.
- **The Unnamed Load** — `red_strain`. High strain, no workout logged. Body logged something you haven't named. SVG: ball and chain.

**AMBER (4):**
- **The Drift** — `amb_load`. Middle recovery, HRV drifting. Carrying something without a name. SVG: gentle waves.
- **The Early Signal** — `amb_trend`. HRV drift over a few days. Catchable pattern. SVG: rising line with dot.
- **The Reset** — `amb_recovery`. Recovery rising, system stabilising. Coming back. SVG: return arc.
- **The Unsettled** — `amb_volatile`. HRV CV >20%. Surface numbers OK but system not settling. SVG: jagged oscillation.

**GREEN (3):**
- **The Flow** — `grn_thriving`. High recovery, HRV at baseline. System running well. SVG: smooth arc.
- **The Shift** — `grn_bounce`. Recovery rising after red days. Something shifted. SVG: upward turn with arrow.
- **Your Code** — `grn_streak`. 3+ consecutive strong days. Sustained pattern. SVG: seed with gold centre.

The archetype grid lives inside the "How this works" collapsible section on wearable.html. There is NO separate horizontal scroll strip below the WHOOP card — that was built on 17 Apr AM and removed the same day (kept the grid, removed the strip).

---

## Site Navigation

### Full structure
```
index.html (public landing)
-> signin.html (auth gate)
-> start.html (choice: Learn It / Use It / Rewrite It)
-> dashboard.html (Learn It — 14 missions + Lumen sidebar)
-> use-it.html (Use It hub — Tame a Trigger live, Body Signal, coming tools)
   -> wearable.html (Body Signal — internal bottom nav: Today/Entries/Study)
-> rewrite.html (Rewrite It — Today/Plan/History tabs)
-> study-dashboard.html (researcher view)
privacy.html (required for WHOOP developer registration)
```

### Three-tab topbar nav — CONSISTENT across all four authenticated pages
All four pages (`dashboard.html`, `use-it.html`, `wearable.html`, `rewrite.html`) have:
- Identical dark topbar (`background: var(--dark)`, `position: sticky`)
- Same three nav links: Learn It -> `/dashboard.html` / Use It -> `/use-it.html` / Rewrite It -> `/rewrite.html`
- Active link highlighted in yellow (`color: var(--yellow); background: rgba(255,190,25,0.1)`)
- Right side: `topbar-user` (email) + Sign out button
- `rewrite.html` additionally has `topbar-streak` span

**IMPORTANT:** Use It links go to `/use-it.html` (the hub), NOT `/wearable.html` directly.
`wearable.html` has its own internal bottom nav (Today / Entries / Study) that navigates within Body Signal.

### Mission pages — auth pattern
All mission pages (2, 3, 6, 7) redirect to `signin.html?next=/mission-X.html` if no session. They do NOT have inline auth forms. Mission 1 (workbook.html) still has its own inline auth — this is intentional as the entry point.

---

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `wearable.html` | Body Signal main page | **116KB**. Sticky dark topbar. Two-row "moment" card + 7-day arc visual. 10 archetype grid in "How this works". Real Lumen opening call (not template). Full Lumen conversation logging via `appendLumenMessage`. Prominent yellow "Close with Lumen on the balcony" button. |
| `use-it.html` | Use It hub | Lists live tools + coming soon. Auth check + sign out. |
| `rewrite.html` | Rewrite It | Three-tab: Today / Plan / History. Declaration at top. Two Supabase tables: `rewrite_weekly_plans`, `rewrite_planned_moments`. |
| `dashboard.html` | Learn It — missions | 14 missions, Lumen sidebar. Use It nav link -> `/use-it.html`. |
| `mission-7.html` | Mission 7 — Feedback is a Gift | Feedback cards with EBI split + landed/not landed fields + Pending/Received status + Lumen per card + cross-card pattern reflect. |
| `start.html` | Platform entry page | Three paths: Learn It / Use It / Rewrite It |
| `whoop-callback.html` | WHOOP OAuth callback | Stores tokens in localStorage after redirect |
| `signin.html` | Auth gate | Single sign-in for all pages. Confirm-email panel for unconfirmed users. |
| `study-dashboard.html` | Researcher view | All participant data, PRR charts, Lumen stages |
| `privacy.html` | Privacy policy | Required for WHOOP dev registration |
| `api/whoop-data.js` | WHOOP fetch + scoring engine | **Edge function.** Composite load index, guardrails, 9 states. Response includes `arc_series` (7 days), `yesterday_strain`, `today_strain_so_far`, `sleep_hours`. Scoring uses yesterday's completed-cycle strain, not today's partial. **Phase 1 (18 Apr):** Writes scored row to `daily_state` for every day in the 7-day arc on every page load, using `?on_conflict=user_id,date` URL query. |
| `api/whoop-auth.js` | WHOOP OAuth flow | Uses SUPABASE_SERVICE_KEY. Check-then-PATCH-or-INSERT. No upsert. |
| `api/whoop-refresh.js` | Token refresh cron | **Node.js.** Runs every 45 min. Auth check removed. |
| `api/lumen.js` | Lumen AI companion | **Edge.** Full six-move methodology prompt. Requires at least one user message in `messages` array. `max_tokens` default 600, cap 1200 via `maxTokens` param. |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | **Node.js.** Balcony reminders + planned moment nudges. Runs every minute. |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `vercel.json` | Rewrites + cron schedule | `*/45 * * * *` for whoop-refresh. `* * * * *` for nudge-whatsapp. **No `functions` block.** |
| `README-DEV.md` | This file | Update at end of every session. |
| `transcripts/*.txt` | 65 coaching transcripts | Source of Lumen methodology. Fetchable via raw GitHub URL. |

### Known junk in repo (safe to delete)
- `.DS_Store` — macOS metadata, harmless
- `.claude-restore-marker` — created by Claude during 18 Apr incident, 62 bytes, harmless, should be deleted

---

## Missions Status
| Mission | Title | Status |
|---|---|---|
| 1 | Your Case for Change | Live (`/workbook.html`) |
| 2 | The Immunity Map | Live (`/mission-2.html`) |
| 3 | Your Story Lifeline | Live (`/mission-3.html`) |
| 4 | The Stories Behind the Stories | Not built |
| 5 | The Value of Your Values | Not built |
| 6 | Taming Your Triggers | Live (`/mission-6.html`) |
| 7 | Feedback is a Gift | Live (`/mission-7.html`) |
| 8-14 | Various | Not built |

---

## Supabase Tables
### wearable_entries columns (verified 18 Apr 2026 PM)
`id, user_id, created_at, mode, pattern_id, pattern_title, recovery, hrv, strain, sleep_score, answers (jsonb), lumen_reply, tags, feedback_score, feedback_text, lumen_messages (jsonb)`

Note: column is `mode` NOT `signal_state`. Column is `pattern_title` NOT `lumen_opening`.

### lumen_messages — full conversation log (new, 18 Apr 2026 AM)
Array of `{ role, content, at }` objects appended live during each Lumen session.
- `role: 'assistant'` — Lumen's opening reply + all continuation replies
- `role: 'user'` — user's replies in the back-and-forth
- `role: 'balcony'` — the balcony-close reply (distinct from regular assistant turns for research filtering)
- Optional `source` field for provenance: `"pasted_transcript"` / `"extracted_from_screenshots"` / absent = live-captured
- `lumen_reply` stays as the opening read (no longer overwritten by balcony close)

### daily_state — Phase 1 write verified 18 Apr 2026
Written on every `whoop-data.js` call. One row per user per day. `whoop-data.js` sends all 7 days of scored state in a single upsert with `?on_conflict=user_id,date` in the URL. Verified 7 rows written for Simon Apr 11-18 (Apr 15 missing — WHOOP band dropout, not a bug).

Step 4 will add a `reason_missing` column to label why a date has no complete row.

| Table | Purpose |
|---|---|
| `whoop_connections` | WHOOP OAuth tokens per user. Has `expires_at` column. PATCH not upsert. |
| `wearable_entries` | Body Signal sessions — see column list above |
| `daily_state` | Raw scored WHOOP metrics per user per day. Written on every whoop-data.js call. |
| `answers` | Reframe mission answers (RLS enabled) |
| `entries` | Reframe mission entries — used by trigger diary (mission-6) and feedback cards (mission-7, tool='feedback-card') |
| `lumen_instructions` | Per-user Lumen system context |
| `lumen_stage` | Lumen arc stage tracking (Stage 1->2->3) |
| `pattern_recurrence_rate` | Primary study metric |
| `wearable_pattern_summary` | View — pattern frequency per user |
| `weekly_study_summary` | Weekly aggregation |
| `study_participants` | Study cohort record — all 4 participants |
| `rewrite_trees` | Rewrite It — declaration + identity shift per user |
| `rewrite_beliefs` | Rewrite It — belief/value from/toward pairs |
| `rewrite_practices` | Rewrite It — practices |
| `rewrite_diary` | Rewrite It — daily balcony entries + practice check-ins |
| `rewrite_nudge_settings` | Rewrite It — WhatsApp nudge number + time (UTC) |
| `rewrite_weekly_plans` | Weekly intention + Lumen reflection |
| `rewrite_planned_moments` | Planned moments (action, practice_id, frequency, frequency_days[], nudge settings, lumen_reflection) |

All rewrite tables have RLS enabled.

---

## Environment Variables (Vercel — all environments)
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | `https://aoqjfqmlcccsosddqnws.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key for server-side Supabase calls |
| `SUPABASE_ANON_KEY` | **NOT SET** — do not use. Use SUPABASE_SERVICE_KEY for server-side user resolution. |
| `WHOOP_CLIENT_ID` | WHOOP OAuth app client ID |
| `WHOOP_CLIENT_SECRET` | WHOOP OAuth app client secret |
| `ANTHROPIC_API_KEY` | Claude API key for Lumen |
| `CRON_SECRET` | Set but NOT used — auth check removed from both cron files |
| `TWILIO_ACCOUNT_SID` | Set — starts with AC |
| `TWILIO_AUTH_TOKEN` | Set |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (Twilio sandbox) |

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
13. **Icons** — SVG stroke icons only. No emoji in UI. Bottom nav 20x20 SVG. Empty state 40x40 SVG.
14. **wearable_entries columns** — `mode` not `signal_state`. `pattern_title` not `lumen_opening`. Column `lumen_messages` now exists for full conversation log.
15. **localStorage sync** — wearable.html saves to localStorage first then Supabase. `syncPendingEntries()` runs on init.
16. **wearable_entries column types** — `recovery`, `hrv`, `strain` are `numeric` (not integer). Always `Math.round()` before insert. Constraint: `mode` must be one of `red`, `green`, `amber`.
17. **Lumen 401 silent failure** — if Supabase session expires mid-conversation, Lumen returns 401 and shows "Lumen is quiet. Keep going." Looks intentional but is auth failure. Not yet fixed.
18. **lumen.js is Edge runtime** — `export const config = { runtime: 'edge' }` must stay. Never add Node.js module.exports to it.
19. **Transcripts are .txt in /transcripts folder** — fetchable via raw GitHub URL.
20. **Cron auth check removed** — both `whoop-refresh.js` and `nudge-whatsapp.js` had auth checks that caused 401 on every cron run. Do NOT re-add.
21. **nudge_time is UTC** — stored as `time without time zone`. UK participants must subtract 1hr (BST).
22. **nudge-whatsapp only shows today's body signal** — queries `wearable_entries` with `created_at >= today`. Never shows stale data.
23. **Vercel env var changes need a new deployment** — Must push a GitHub commit to force a fresh build.
24. **GitHub MCP — use the official GitHub server** — `github-mcp-server` binary (installed via `brew install github/github-mcp-server/github-mcp-server`). The old `@modelcontextprotocol/server-github` (npx) silently truncated large file pushes — do NOT use it.
25. **lumenSystemPrompt persists across conversation** — `triggerLumenReflection()` stores the rich system prompt in `lumenSystemPrompt`. `sendToLumen()` uses it for all continuation messages.
26. **wearable.html is ~116KB** — large, but pushes work fine with the official GitHub MCP server when full content is provided in one call.
27. **wearable.html last known-good commit** — `a74b6cd8e1e98b58b73dc4b7e48fcfee11c32fc5` (18 Apr, Phase 1 daily_state, arc dots fully recovered from incident). Previous known-good: `5f46d9b` (14 Apr).
28. **ALWAYS FETCH BEFORE ANSWERING REVERT QUESTIONS** — if Simon asks "do we need to revert X?" or "is file Y still correct?", Claude must fetch the live file from GitHub before answering. Never rely on memory.
29. **vercel.json must never have a `functions` block** — adding one causes Vercel to attempt ESM-to-CommonJS compilation of Edge functions, which fails with "Unhandled type: Identifier".
30. **No package.json in the repo root** — vanilla Vercel project with no build step. Adding `{"type": "module"}` breaks all Node.js API functions that use `module.exports`.
31. **When Vercel is behind GitHub HEAD — force redeploy by touching README-DEV.md** — push a trivial README-DEV change to trigger a fresh build from current HEAD.
32. **Node.js version is pinned to 20.x in Vercel project settings** — Node 24 causes "Unhandled type: Identifier" build errors.
33. **Topbar rule — never overwrite `topbar-user` with anything other than email** — `rewrite.html` has a separate `topbar-streak` span.
34. **`create_or_update_file` replaces the ENTIRE file** — never use it for single-line changes in large files. It sets the file to exactly the `content` field provided. Always provide the full, final file content in one call. Never use placeholder content as a "setup step" — there is no second step.
35. **Use It nav goes to `/use-it.html` (the hub), not `/wearable.html`** — wearable.html is one tool inside Use It.
36. **Mission pages auth pattern** — all mission pages redirect to `signin.html?next=/mission-X.html` if no Supabase session. No inline auth forms.
37. **Mission 7 feedback cards use `entries` table with `tool='feedback-card'`** — same pattern as Mission 6 trigger diary (`tool='trigger-diary'`).
38. **Mission 7 feedback card ID swap pattern** — cards start with temp ID `card-[timestamp]`. On first save, a real UUID is inserted and ALL element IDs are swapped. `attachCardListeners` uses a `ref = { id: cardId }` object so the closure captures `ref`, not the ID string.
39. **Mission 7 all card buttons use `data-action` event delegation** — never use inline `onclick` with hardcoded card IDs.
40. **lumen.js requires at least one user message** — empty `messages[]` returns a fallback. When auto-firing Lumen (no user text), add a silent user message first.
41. **Deploy protocol for large files** — fetch raw file from GitHub -> manipulate in bash with Python string replacement -> verify with `node --check` -> `present_files` for Simon to push via GitHub web editor (Cmd+A, paste, commit). Never rely on `create_or_update_file` for partial content.
42. **Recovery path when a production file is broken** — do NOT keep retrying `create_or_update_file` or `push_files` from the Claude container. `raw.githubusercontent.com` is not in the bash allowlist, so re-fetching the good content back into Claude is unreliable. Reliable recovery = Simon runs `git checkout <good-sha> -- <file>` from his local terminal, or uses GitHub web UI Raw -> select all -> paste into edit view. Claude provides the good commit SHA, Simon does the restore.
43. **daily_state writes must use `?on_conflict=user_id,date` in the URL** — Supabase REST upsert needs conflict columns in the query string, not just the `Prefer: resolution=merge-duplicates` header. Without it, upsert silently falls back to plain insert and fails on the unique constraint.
44. **Arc card: today's dot uses signal_state; historical dots still use recovery thresholds** — shipped 17 Apr. Step 3 of the roll-out plan still outstanding: also use signal_state in the arcSummary strings passed to Lumen in `renderLumenOpening()` and `triggerLumenReflection()` so Lumen's prose matches what the user sees.
45. **Lumen opening is a real API call, not a template** — `renderLumenOpening()` is async, calls `/api/lumen` with full arc + today + signal state. Do NOT regress to rule-based string construction. Template opening was removed 17 Apr for feeling narrow.
46. **lumen.js `max_tokens` default is 600, cap 1200** — raised from 300 on 17 Apr. Frontend can pass `maxTokens` override per call (opening uses 400). Don't reduce back to 300 — Lumen needs room to read the arc.
47. **Balcony close logs as `role: 'balcony'`, not `role: 'assistant'`** — distinct role for research filtering. Balcony close never overwrites `lumen_reply` (opening stays there). See Lumen Architecture.
48. **WHOOP cycle timing gotcha** — WHOOP recoveries are keyed by sleep (forward-looking to the next cycle). `daily[0].day_strain` is today's partial strain, not yesterday's completed. For "yesterday's load" in the scoring engine, use yesterday's completed cycle strain, not `daily[1]`. The two-row card side-steps this by not trying to show yesterday's strain at all — the arc visualisation handles it cleanly.

---

## Data Flow — Body Signal
1. User signs in -> `signin.html` -> Supabase session persists across all pages
2. `wearable.html` passes `Authorization: Bearer [supabaseJWT]` to `/api/whoop-data`
3. `whoop-data.js` decodes JWT -> `user_id` -> queries `whoop_connections` by `user_id`
4. Fetches 28 days WHOOP v2 API using stored `access_token`
5. Auto-refreshes token if expired using `refresh_token`
6. Computes 28-day baselines + z-scores
7. Runs composite load index + 9-state scoring engine
8. **Writes 7 days of scored state to `daily_state` via upsert with `?on_conflict=user_id,date`** (Phase 1, 18 Apr 2026)
9. Returns scored data + trend arrays + arc_series + yesterday_strain + today_strain_so_far + sleep_hours
10. `wearable.html` renders two-row moment card + 7-day arc visual below it
11. `renderLumenOpening()` -> async call to `/api/lumen` with arc + today + signal state -> Lumen's real observation, not a template
12. User clicks CTA -> 4 questions -> `triggerLumenReflection()` with full system prompt (methodology + arc + answers)
13. `lumenSystemPrompt` stored at session start — reused for all continuation messages
14. Every turn logged to `lumen_messages` via `appendLumenMessage(entry, role, content)` as it happens
15. Balcony close -> `role: 'balcony'` turn — does NOT overwrite `lumen_reply` (opening stays)
16. Feedback card (1-5 + optional text) appended after balcony close
17. Entry saved to localStorage immediately, then Supabase. If Supabase fails, retried on next load.

---

## Scoring Engine — 9 States
**RED** — `red_psych` (rec_z < -0.8, sleep adequate, low strain) / `red_trend` (HRV declining 3+ days, no physical cause, >=7 days history) / `red_strain` (high strain, no workout)
**AMBER** — `amb_load` / `amb_trend` / `amb_recovery` / `amb_volatile` (HRV CV)
**GREEN** — `grn_thriving` / `grn_bounce` / `grn_streak`

### Scientific Guardrails (WHOOP AI validated 9 Apr 2026)
1. Recovery >= 67% AND HRV >= baseline AND low strain -> block all amber/red trend states
2. `red_trend` requires >=7 days history — under 7 downgrades to `amb_trend`
3. Recovery >= 67% blocks `red_trend` regardless of HRV trend

### Composite Load Index
HRV 40% / Recovery 25% / Sleep consistency 20% / Respiratory rate 15%
2+ signals impaired -> escalate one level.

### Strain source
Scoring `strain_z` uses yesterday's completed-cycle strain, not today's partial. See Rule 48.

---

## Lumen Architecture

### The Prompt — Six Moves
`api/lumen.js` contains a full methodology prompt extracted from 65 real coaching transcripts. The six moves:

1. **SURFACE** — warmth first, find what is actually present.
2. **NAME THE CODE** — when the same fear/belief appears twice in different forms, name it precisely.
3. **GIVE IT ITS PLACE** — never attack the code. It was adaptive once.
4. **THE PARADOX** — the pivot point. "The way that code is working is creating the very thing you fear most." Let it land.
5. **THE REFRAME** — only after the paradox lands. Help them find the new belief — do not give it to them.
6. **THE PRACTICE** — specific, scheduled, embodied. Catch vagueness.

### The Question / Offer Distinction
Questions when excavating. Offers when you've seen enough to name something.
If the offer is rejected — treat it as data. Ask: "What would you say instead?"

### The Balcony Close — four questions in sequence
1. "What are you taking away?"
2. "What are you learning?"
3. "What do you need to integrate?"
4. "And what are you going to do — specifically?"

### The balcony-close UI
Prominent yellow pill button, dark green bold text, with italic hint "Get a final reflection on the thread". Sits below the Lumen input area. Copy: "Close with Lumen on the balcony ->". Shipped 18 Apr AM for trial launch.

### Why no more "one observation, one question" rule
Before 17 Apr, wearable.html sent a `systemExtra` saying "One observation. One question. Nothing more." This overrode the six-move methodology — every turn became observation-plus-question, forever. Removed 17 Apr. Now `systemExtra` passes only context (mode, data, answers, history, arc) and tells Lumen to follow the six moves. Do NOT regress (see Rule 45).

### Mission 7 Lumen — four moments
1. Bridge from Mission 6 (reads trigger, reflects it back)
2. Per-card: reads all fields (who, why, focus, plus, ebi, landed, not_landed). Fires only when card has content.
3. Cross-card pattern: names the theme across multiple people
4. Arc close: names the shift others see that the person is beginning to own

---

## Rewrite It — Architecture

### Three-tab structure
**Today tab:** Declaration hero. Practices checklist. Balcony check-in.
**Plan tab:** Weekly intention (Lumen reflects). Planned moments list — each moment has action, practice link, frequency, day picker, nudge toggle + time + message, "Ask Lumen" per moment.
**History tab:** Read-only balcony entries.

### Two Supabase tables (RLS enabled)
- `rewrite_weekly_plans` — `user_id, week_start, intention, lumen_reflection`
- `rewrite_planned_moments` — `user_id, week_start, action, practice_id, frequency, frequency_days[], nudge_enabled, nudge_time, nudge_message, lumen_reflection`

---

## WhatsApp Nudge
- Cron: every minute via `vercel.json` (`* * * * *`)
- Finds users where `nudge_time` (UTC) matches current UTC minute
- Skips balcony if practice already completed today
- Fetches today's `wearable_entries` for recovery/HRV/signal line
- Also fires planned moment nudges — respects frequency/days per moment
- Twilio sandbox: `+14155238886`. Join keyword: `join suggest-obtain`
- Simon opted in. Other participants still need to opt in.

---

## The Full Methodology Loop — Signal to Identity Shift

### The Arc
```
Signal -> Body -> Questions -> Belief Named -> Origin Surfaced -> Reframe -> Practice -> Identity Shift -> Physiological Confirmation
```

### Jackson's case — reference example (updated 16 Apr 2026)
- **Session 1 (10 Apr):** red_psych, recovery 23%. Belief: "If I stop, I am lazy." Origin: intergenerational.
- **Session 2 (11 Apr):** green, recovery 72% — body confirmed the shift overnight. Second HALS surfaced: self-compassion feels threatening.
- **Session 3 (16 Apr):** red, recovery 65% — cognitive rest not landing. Alcohol reveal (first time in years, rugby weekend). Third HALS: "it was nice to feel like I could again" — permission. Jackson drew a clean boundary: "Let's stop here."
- **Full case study:** `jackson-case-study.docx` — Section 11 ("Six Days Later") + Section 12 ("What Comes Next") added 16 Apr. "A Principle About HALS" beat added (HALS don't disappear, they lose authority). Subtitle now "One participant. Six days. Three sessions." Document retuned to remove blue default Heading1 colour and match the dark forest green (#0A3228) used elsewhere.
- **Simon's own 18 Apr session** — worked through "her stress means I'm not loved" -> intergenerational origin -> reframe -> practice commitment (breathe and ask "what's going on for you?"). All six moves in sequence. 44 turns captured (pasted transcript, pre-logging).

### Simon 17 Apr (first live-study red)
- Recovery 46%, HRV 34.1ms, rec_z -1.42. Classified `red_psych` / medium confidence.
- WHOOP-amber, engine-red. This was the moment the engine first caught a red day in live conditions — research milestone.

---

## Research Paper — body-signal-research-paper.docx
**Updated 16 Apr 2026** — all factual corrections:
- URL: `app.purposefulchange.co.uk` (was old blocked `reframe-mission-1.vercel.app`)
- Data source: Live WHOOP API (was "Simulated WHOOP data via getWhoopData()")
- Participant framing: "four participants" (was "a family of four")
- Study Design section: "Initial Cohort" (was "Family Cohort")
- Participant list: all 4 with correct start dates, Jackson included, Monica's name corrected
- History counts: Simon 11, Monica 10, Melinda 30, Jackson 6
- Origin story: "Simon Lamb and several colleagues"

**Two manual fixes still pending** (XML too fragmented for safe regex surgery):
- Document status date: "April 2026" -> "16 April 2026" (first page, status table)
- Mission 7 mention: find "Mission 6, Taming Your Triggers..." and append "Missions 1, 2, 3, 6, and 7 are live at app.purposefulchange.co.uk. Mission 7, Feedback is a Gift, was added April 2026."
Both are quick Ctrl+F jobs in Word.

---

## Outstanding Work

**The 4-step roll-out plan lives at the top of this file. Steps 2, 3, 4 are the priority — everything below is downstream or parallel.**

### Supporting fixes (do alongside the 4 steps)
- [ ] **Delete `.claude-restore-marker`** from repo root (junk from 18 Apr incident)
- [ ] Research paper: apply two manual fixes (date + Mission 7 mention)
- [ ] Monica, Melinda, Jackson reconnect WHOOP (refresh tokens likely expired) — becomes less urgent once Step 2 cron is live
- [ ] Monica, Melinda, Jackson opt in to Twilio sandbox + set nudge time in Rewrite It
- [ ] Clean up any remaining empty `{}` feedback card entries in Supabase for Simon
- [ ] **Arc alignment bug** — when a day is missing, dots mislabelled S/M/T/W/T/F/S instead of actual dates (tied to Step 4)

### After the 4 steps — next build
- [ ] Mission 1 -> Rewrite It handover CTA (pre-populate declaration from Case for Change answer)
- [ ] "See what Lumen notices across your feedback" button — cross-card Lumen
- [ ] Missions 4, 5, 8-14 to build
- [ ] **Methodology question still open** — daily vs weekly vs signal-triggered reflection rhythm. Simon's instinct: user-initiated, arc-plus-moment, Lumen adapts to whatever window elapsed. Decision parked 17 Apr pending real usage data from the current cohort. Do NOT rush a structural change mid-study.

### Study
- [ ] SRIS baseline — all 4 participants before 30-day mark
- [ ] Pattern Recurrence Rate first analysis at 30 days (Melinda most history — OVERDUE) — requires Step 4 for clean gap-labelling
- [ ] Jackson 30-day follow-up — does Body Signal confirm the identity shift?
- [ ] **Log first red_psych capture (Simon 17 Apr) in research paper** — first live-study catch of the engine detecting a psychological red day under real conditions

### Infrastructure
- [ ] Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`
- [ ] Twilio sandbox -> production WhatsApp Business API (when study scales)

---

## How to Start a Session
1. Fetch this file fresh: `https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md`
2. Read the 4-step roll-out plan at the top — that's the governing frame
3. Ask Simon what he wants to work on (most likely Step 2, 3, or 4)
4. Before touching any file: fetch it fresh from GitHub
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

# Restore a file from a known-good commit (the 18 Apr recovery method)
git checkout <commit-sha> -- <file-path>
git commit -m "Restore <file> from <sha>"
git push
```

---

## Session Log
| Date | Key work done |
|---|---|
| ~7 Apr 2026 | Body Signal MVP. WHOOP OAuth. 9-state scoring engine. Lumen opening observation. wearable.html live. |
| 8 Apr 2026 | Cross-user isolation fixed (JWT-only lookup). WHOOP auth refactored. Melinda connected. 3 participants live. |
| 9 Apr 2026 | Scoring engine WHOOP AI validated. Guardrails added. Composite load index built. Feedback measure deployed. Research paper updated. Rewrite It conceived + mocked up. |
| 10 Apr 2026 AM | rewrite.html built (4 screens, SVG icons, 5 Supabase tables with RLS). HRV volatility + AMBER_VOLATILE added. Jackson (4th participant) connected. CRON_SECRET added. |
| 10 Apr 2026 PM | WHOOP token expiry fixed. whoop-refresh.js Node.js runtime confirmed. localStorage->Supabase sync added. Three-tab nav. Jackson case study written. README-DEV established. |
| 11 Apr 2026 | Three bugs fixed: float types, pendingSync, amber mode constraint. Jackson 2 sessions in Supabase. Body confirmed identity shift overnight (23% -> 72%). Case study Section 9 + research paper Section 3.4 added. |
| 12 Apr 2026 AM | 65 coaching transcripts converted to .txt and pushed. Lumen six-move methodology prompt deployed. |
| 12 Apr 2026 PM | GitHub MCP server installed. whoop-refresh cron fixed. All 4 participants in study_participants. Twilio set up. nudge-whatsapp live — first nudge received 18:25 UTC. |
| 13 Apr 2026 AM | Fixed lumenSystemPrompt bug. wearable.html accidentally wiped twice — root cause: old npx GitHub MCP server truncating large payloads. |
| 13 Apr 2026 PM | Switched to official GitHub MCP server. daily_state write added to whoop-data.js. signin.html confirm-email panel. Node.js pinned 20.x. Rules 28-32 added. |
| 14 Apr 2026 AM | Nav consistency completed across all 4 pages. Dark sticky topbar everywhere. rewrite.html streak fix. Rules 33-35 added. |
| 14 Apr 2026 PM | Supabase confirmation email branded. Mission 7 built and deployed. Rules 36-37 added. |
| 15 Apr 2026 | Mission 7 full bug fix session. ID swap closure bug. All inline onclick replaced with data-action. Empty messages fallback. Two new card fields. Rewrite It Today/Plan/History restructure. Two new tables. Rules 38-41 added. |
| 16 Apr 2026 AM | **Jackson's third session (red, 65% recovery, cognitive-rest gap + alcohol/rugby reveal + third HALS).** Case study updated: Sections 11 + 12 added, then reordered, then section numbers fixed, then headings matched to dark green. Subtitle updated to "Six days. Three sessions." |
| 16 Apr 2026 PM | **Suite consistency check across Brochure / Research Paper / Case Study.** Research paper fact-corrections shipped: URL, live WHOOP data (not simulated), "four participants" (not "family of four"), correct participant list + start dates, "Initial Cohort". Two manual fixes still pending (doc date + Mission 7). |
| 16 Apr 2026 EVE | **10 archetype labels named and agreed:** Quiet Cost / Build Up / Unnamed Load / Drift / Early Signal / Reset / Unsettled / Flow / Shift / Your Code. |
| 17 Apr 2026 AM | **Archetype SVGs + horizontal scroll strip shipped** (candle / ball-and-chain / bars / waves / rising line / arc / jagged osc / S-curve / upward turn / seed). Then the duplicate strip was removed the same day — kept the grid in "How this works", removed the strip below WHOOP card. |
| 17 Apr 2026 MID | **Lumen "relentless" fix:** removed "One observation. One question. Nothing more." override. Added balcony-close button ("Where have we got to?"). Rule 45 added. |
| 17 Apr 2026 PM | **Three-row card -> two-row card + 7-day arc visual:** tried three-row (yesterday/last night/today) but WHOOP cycle timing made strain-alignment impossible. Pivoted to two-row card + 7-day arc visual below. Arc dots coloured by signal_state for today, recovery thresholds for history. Rule 44 + 48 added. |
| 17 Apr 2026 EVE | **Lumen opening moved from template to real API call.** `renderLumenOpening()` now async, calls `/api/lumen` with full arc + today + signal state. `max_tokens` in lumen.js raised 300 -> 600 default, 1200 cap. Rules 45 + 46 added. |
| 18 Apr 2026 AM | **STEP 1 OF ROLL-OUT PLAN SHIPPED — Phase 1 daily_state scoring.** Three commits: `fee670bf`, `79fb07dc`, `a74b6cd8`. Final fix: `?on_conflict=user_id,date` in URL + awaited fetch. 7 rows verified for Simon. Also shipped: **Full Lumen conversation logging** (`lumen_messages jsonb`, `appendLumenMessage`, `role: 'balcony'` distinct, `lumen_reply` preserved). Simon 08:00 UTC session reconstructed (44 turns, pasted transcript). Jackson 16 Apr session reconstructed (23 turns, screenshots). Prominent yellow balcony-close button for trial launch. Rules 43 + 47 added. |
| 18 Apr 2026 PM | **Production incident + recovery.** While trying to set up Step 3 (arc-colour patches 2+3), Claude called `github:push_files` with `content: "PLACEHOLDER"` on wearable.html (commit `8362aff`). Pushed a 3KB maintenance page on top (`dce0230`). Created junk `.claude-restore-marker` (`7bfff13`). Extended failed recovery attempts (raw.githubusercontent.com, api.github.com, Vercel previews, inline create_file — all blocked or truncated). **Simon restored manually** via `git checkout a74b6cd8 -- wearable.html` from local terminal. Production verified back at 14:18 UTC. Rule 34 updated. Rule 42 added. Step 3 still pending — lesson: use Rule 41 deploy protocol. |
| 18 Apr 2026 EVE | **Gap closed + 4-step roll-out plan documented at top of README.** 16-17 Apr reconstructed from chat transcripts (CHAT_FOR_CLAUDE_part_1.docx + chart_for_claude_part_2.docx). README restructured so the governing frame is: Step 1 done; Steps 2 (Phase 2 daily cron), 3 (arc-colour patches 2+3), 4 (`daily_state.reason_missing` gap-labelling) are the path to trial roll-out. |

---

*Update this file at the end of every session. It is the memory between chats.*
