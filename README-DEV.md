# README-DEV — Purposeful Change Platform
## Single source of truth across all Claude development sessions
## FOR CLAUDE: Fetch fresh at https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md at the start of every session. Do not rely on memory.
## Last updated: 2026-04-18 — Phase 1 daily_state scoring shipped. First red_psych captured in live study (17 Apr). Production incident (wearable.html PLACEHOLDER) recovered.

---

## GAP NOTICE — 16 & 17 Apr 2026
Two full working days between 15 Apr (last logged session) and 18 Apr are NOT captured in this file. Chats ran out of memory before the README could be updated. What is known about that period comes only from evidence visible in the current repo state and Supabase data, not from session transcripts.

**Known to be true from repo/data evidence:**
- By 17 Apr, the scoring engine was live and catching real-world red days (Simon's Fri 17 Apr data: 46% recovery, HRV 34.1ms, rec_z -1.42, composite_load 0.49 — classified red_psych/medium confidence). This is the first red_psych captured in live study conditions — research milestone.
- `daily_state` table writes were not yet reliable on 17 Apr — fixed on 18 Apr (see session log).

**Unknown — may need re-discovery:**
- What was deployed / attempted between 15 and 18 Apr
- Whether the WHOOP cross-user isolation fix files (whoop-data.js, wearable.html, whoop-callback.html) listed as pending in old "Outstanding Work" were ever pushed
- Whether the Mission 7 empty-messages fix was ever pushed
- Any other changes made to the repo in that window

**Recovery approach if needed:** Check `git log --since='2026-04-15' --until='2026-04-18'` for commit messages from that period. The commits themselves are the ground truth.

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

All 4 participants now in `study_participants` table (added 12 Apr 2026).

### First red day captured — 17 Apr 2026 (Simon)
- Recovery 46%, HRV 34.1ms, rec_z -1.42, composite_load 0.49
- Signal state: `red_psych` / medium confidence
- WHOOP's native band showed amber; engine correctly surfaced this as red because rec_z was deeply below baseline with HRV also below baseline and no sleep/strain explanation
- Product insight: arc should show `signal_state`, not WHOOP's recovery band (patch pending, see Outstanding Work)

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
| `wearable.html` | Body Signal main page | **116KB** (was ~107KB before Phase 1 daily_state work). Sticky dark topbar. `lumenSystemPrompt` persists rich context. Daily state write on every page load. |
| `use-it.html` | Use It hub | Lists live tools + coming soon. Auth check + sign out. |
| `rewrite.html` | Rewrite It | Three-tab: Today / Plan / History. Declaration at top. Two Supabase tables: `rewrite_weekly_plans`, `rewrite_planned_moments`. |
| `dashboard.html` | Learn It — missions | 14 missions, Lumen sidebar. Use It nav link -> `/use-it.html`. |
| `mission-7.html` | Mission 7 — Feedback is a Gift | Feedback cards with EBI split + landed/not landed fields + Pending/Received status + Lumen per card + cross-card pattern reflect. |
| `start.html` | Platform entry page | Three paths: Learn It / Use It / Rewrite It |
| `whoop-callback.html` | WHOOP OAuth callback | Stores tokens in localStorage after redirect |
| `signin.html` | Auth gate | Single sign-in for all pages. Confirm-email panel for unconfirmed users. |
| `study-dashboard.html` | Researcher view | All participant data, PRR charts, Lumen stages |
| `privacy.html` | Privacy policy | Required for WHOOP dev registration |
| `api/whoop-data.js` | WHOOP fetch + scoring engine | **Edge function.** Composite load index, guardrails, 9 states. **Phase 1 (18 Apr):** Writes scored row to `daily_state` for every day in the 7-day arc on every page load, using `?on_conflict=user_id,date` URL query. |
| `api/whoop-auth.js` | WHOOP OAuth flow | Uses SUPABASE_SERVICE_KEY. Check-then-PATCH-or-INSERT. No upsert. |
| `api/whoop-refresh.js` | Token refresh cron | **Node.js.** Runs every 45 min. Auth check removed. |
| `api/lumen.js` | Lumen AI companion | **Edge.** Full six-move methodology prompt. Requires at least one user message in `messages` array. |
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
### wearable_entries columns (actual — verified 10 Apr 2026)
`id, user_id, created_at, mode, pattern_id, pattern_title, recovery, hrv, strain, sleep_score, answers (jsonb), lumen_reply, tags, feedback_score, feedback_text`
Note: column is `mode` NOT `signal_state`. Column is `pattern_title` NOT `lumen_opening`.

### daily_state — Phase 1 write verified 18 Apr 2026
Written on every `whoop-data.js` call (fire-and-forget). One row per user per day. `whoop-data.js` sends all 7 days of scored state in a single upsert with `?on_conflict=user_id,date` in the URL. Verified 7 rows written for Simon Apr 11–18 (Apr 15 missing — WHOOP band dropout, not a bug).

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
14. **wearable_entries columns** — `mode` not `signal_state`. `pattern_title` not `lumen_opening`. Always check column names before querying.
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
42. **NEW — recovery path when a production file is broken** — do NOT keep retrying `create_or_update_file` or `push_files` from the Claude container. `raw.githubusercontent.com` is not in the bash allowlist, so re-fetching the good content back into Claude is unreliable. Reliable recovery = Simon runs `git checkout <good-sha> -- <file>` from his local terminal, or uses GitHub web UI Raw -> select all -> paste into edit view. Claude provides the good commit SHA, Simon does the restore.
43. **NEW — daily_state writes must use `?on_conflict=user_id,date` in the URL** — Supabase REST upsert needs conflict columns in the query string, not just the `Prefer: resolution=merge-duplicates` header. Without it, upsert silently falls back to plain insert and fails on the unique constraint.
44. **NEW — arc card should use `signal_state` for every day, not recovery bands** — Fri 17 Apr Simon's day was WHOOP-amber (46%) but engine-red (red_psych). Arc dot should show red because the engine saw something the recovery score alone didn't. Three patches specified but not yet applied (see Outstanding Work).

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
9. Returns scored data + trend arrays
10. `wearable.html` renders signal card -> calls `/api/lumen` with arc as `systemExtra` context
11. Lumen reads arc, works through six-move methodology arc
12. `lumenSystemPrompt` stored at session start — reused for all continuation messages
13. After conversation: feedback card ("Did this process surface something useful?" 1-5)
14. Entry saved to localStorage immediately, then Supabase. If Supabase fails, retried on next load.

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

### Jackson's case (10 Apr 2026) — reference example
- **Signal:** red_psych, recovery 23%, HRV declining, no physical cause
- **Belief surfaced:** "If I stop, I am lazy"
- **Origin:** Intergenerational — family history of working hard and being useful
- **Declaration:** "I am choosing to be someone who deserves to rest."
- **Two-day arc:** 23% recovery -> 72% recovery in one night.
- **Full case study:** `jackson-case-study.docx` in project files

---

## Outstanding Work

### Immediate
- [ ] **Apply arc-colour patches to wearable.html** — three changes needed so arc dots use `signal_state` for every day, not recovery bands:
  1. `renderArc()` — replace `dayClass(rec)` + `todayClassFromState(state)` with a unified `stateClass(state)` used for every dot, with `recoveryClass(rec)` as fallback only when signal_state is null.
  2. `renderLumenOpening()` arcSummary — replace `const band = a.recovery_pct >= 67 ? 'green' : ...` with a `stateBand(s)` helper that reads `a.signal_state`.
  3. `triggerLumenReflection()` arcSummary — same transformation in the `arcSeries.map` block.
- [ ] **Delete `.claude-restore-marker`** from repo root (junk from 18 Apr incident)
- [ ] **Verify WHOOP cross-user isolation fix files status** — pending in pre-15-Apr README. Gap in session log means status unknown. Check `git log` for `whoop-data.js` changes 15–17 Apr to confirm whether JWT lookup fix was pushed.
- [ ] **Verify Mission 7 empty-messages fix status** — pending in 15 Apr README. Same uncertainty.
- [ ] Monica, Melinda, Jackson reconnect WHOOP (refresh tokens likely expired)
- [ ] Monica, Melinda, Jackson opt in to Twilio sandbox + set nudge time in Rewrite It
- [ ] Clean up any remaining empty `{}` feedback card entries in Supabase for Simon

### Phase 2 — daily_state
- [ ] **Phase 2 daily cron (~09:00 UTC)** to refresh tokens and write daily_state for all active study_participants, not just users who open the app
- [ ] **Arc alignment bug** — when a day is missing, dots mislabelled S/M/T/W/T/F/S instead of actual dates
- [ ] **Research-design gap-labelling** — distinguish pre-enrolment / user-didn't-open / WHOOP-couldn't-score in `daily_state.reason_missing`

### Next build
- [ ] Mission 1 -> Rewrite It handover CTA (pre-populate declaration from Case for Change answer)
- [ ] "See what Lumen notices across your feedback" button — cross-card Lumen
- [ ] Missions 4, 5, 8-14 to build

### Study
- [ ] SRIS baseline — all 4 participants before 30-day mark
- [ ] Pattern Recurrence Rate first analysis at 30 days (Melinda most history — OVERDUE)
- [ ] Jackson 30-day follow-up — does Body Signal confirm the identity shift?
- [ ] **Log first red_psych capture (Simon 17 Apr) in research paper** — first live-study catch of the engine detecting a psychological red day under real conditions

### Infrastructure
- [ ] Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`
- [ ] Twilio sandbox -> production WhatsApp Business API (when study scales)

---

## Research Paper
File: `body-signal-research-paper.docx`
Case study: `jackson-case-study.docx` — to be updated at 30 days with full physiological arc.
**To add:** Simon 17 Apr — first live-study red_psych capture, research milestone.

---

## How to Start a Session
1. Fetch this file fresh: `https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md`
2. Read outstanding issues and next build priorities
3. Ask Simon what he wants to work on
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
| **16-17 Apr 2026** | **GAP — chats ran out of memory before update. See GAP NOTICE at top of this file. Evidence of work only: (a) Simon's 17 Apr data — first red_psych captured in live study, 46% rec, HRV 34.1ms. (b) Scoring engine evidently live and processing real user data by end of this window.** |
| 18 Apr 2026 AM | **Phase 1 daily_state scoring shipped.** Three commits (`fee670bf`, `79fb07dc`, `a74b6cd8`). Final fix: `?on_conflict=user_id,date` in URL + awaited fetch + split error logs. Engine now writes 7 scored rows per page load. Verified 7 rows written for Simon Apr 11-18 (Apr 15 missing — WHOOP band dropout). Rule 43 added. |
| 18 Apr 2026 PM | **Production incident + recovery.** Claude called `github:push_files` with `content: "PLACEHOLDER"` on wearable.html (commit `8362aff`) while trying to set up an arc-colour patch. Pushed a 3KB maintenance page on top (`dce0230`). Created junk `.claude-restore-marker` (`7bfff13`). Extended failed attempts to restore via `raw.githubusercontent.com` (not in bash allowlist), `api.github.com` (not in allowlist), Vercel preview URLs (auth-walled), and inline `create_file` (116KB truncated). **Simon restored manually** via `git checkout a74b6cd8 -- wearable.html && git commit && git push` from local terminal. Production verified back at 14:18 UTC. Rule 34 updated (never use PLACEHOLDER as setup step). Rules 42 + 44 added. Arc-colour patch still pending. |

---

*Update this file at the end of every session. It is the memory between chats.*
