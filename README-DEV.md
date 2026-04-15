# README-DEV — Purposeful Change Platform
## Single source of truth across all Claude development sessions
## FOR CLAUDE: Fetch fresh at https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/README-DEV.md at the start of every session. Do not rely on memory.
## Last updated: 2026-04-15 — Mission 7 feedback cards fully working. Lumen on cards fixed. Rewrite It new structure live.

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

---

## Site Navigation — UPDATED 14 Apr 2026

### Full structure
```
index.html (public landing)
-> signin.html (auth gate)
-> start.html (choice: Learn It / Use It / Rewrite It)
-> dashboard.html (Learn It — 14 missions + Lumen sidebar)
-> use-it.html (Use It hub — Tame a Trigger live, Body Signal, coming tools)
   -> wearable.html (Body Signal — internal bottom nav: Today/Entries/Study)
-> rewrite.html (Rewrite It — Today/Plan/History tabs — UPDATED 15 Apr 2026)
-> study-dashboard.html (researcher view)
privacy.html (required for WHOOP developer registration)
```

### Three-tab topbar nav — CONSISTENT across all four authenticated pages
All four pages (`dashboard.html`, `use-it.html`, `wearable.html`, `rewrite.html`) have:
- Identical dark topbar (`background: var(--dark)`, `position: sticky`)
- Same three nav links: Learn It -> `/dashboard.html` / Use It -> `/use-it.html` / Rewrite It -> `/rewrite.html`
- Active link highlighted in yellow (`color: var(--yellow); background: rgba(255,190,25,0.1)`)
- Right side: `topbar-user` (email) + Sign out button
- `rewrite.html` additionally has `topbar-streak` span (shows "N day streak" in yellow when active, empty otherwise — rewrite-specific, does NOT overwrite email)

**IMPORTANT:** Use It links go to `/use-it.html` (the hub), NOT `/wearable.html` directly.
`wearable.html` has its own internal bottom nav (Today / Entries / Study) that navigates within Body Signal — this is separate and intentional.

### Mission pages — auth pattern
All mission pages (2, 3, 6, 7) redirect to `signin.html?next=/mission-X.html` if no session. They do NOT have inline auth forms. Mission 1 (workbook.html) still has its own inline auth — this is intentional as the entry point.

---

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `wearable.html` | Body Signal main page | ~107KB. Sticky dark topbar (not fixed). No more `auth-user-bar` div. `lumenSystemPrompt` persists rich context across full conversation. |
| `use-it.html` | Use It hub | Lists live tools (Tame a Trigger, Body Signal) + coming soon. Has auth check + sign out. |
| `rewrite.html` | Rewrite It | **UPDATED 15 Apr 2026** — new three-tab structure: Today / Plan / History. Declaration always at top. Today tab: practices checklist + balcony check-in. Plan tab: weekly intention + planned moments (action/frequency/nudge per moment + Lumen per moment). History tab: read-only balcony entries. Two new Supabase tables: `rewrite_weekly_plans`, `rewrite_planned_moments`. |
| `dashboard.html` | Learn It — missions | 14 missions, Lumen sidebar. Use It nav link -> `/use-it.html`. Mission 7 now live. |
| `mission-7.html` | Mission 7 — Feedback is a Gift | **FULLY FIXED 15 Apr 2026.** Feedback cards (one per person). Fields: Who/Why/Focus + EBI split (What's working / Even Better If) + What has landed / What has not landed yet + Status (Pending/Received). Lumen per card reads all fields. Lumen cross-card pattern reflect. Full event delegation via `data-action` attributes + `ref` object — survives temp→UUID ID swap. |
| `start.html` | Platform entry page | Three paths: Learn It / Use It / Rewrite It |
| `whoop-callback.html` | WHOOP OAuth callback | Stores tokens in localStorage after redirect |
| `signin.html` | Auth gate | Single sign-in for all pages. Shows confirm-email panel if email not yet confirmed. Supabase confirmation email now branded as Rewrite Your Life. |
| `study-dashboard.html` | Researcher view | All participant data, PRR charts, Lumen stages |
| `privacy.html` | Privacy policy | Required for WHOOP dev registration |
| `api/whoop-data.js` | WHOOP fetch + scoring engine | **Edge function.** Composite load index, guardrails, 9 states. Writes to daily_state on every load. |
| `api/whoop-auth.js` | WHOOP OAuth flow | Uses SUPABASE_SERVICE_KEY. Check-then-PATCH-or-INSERT. No upsert. |
| `api/whoop-refresh.js` | Token refresh cron | **Node.js.** Runs every 45 min. Auth check removed 12 Apr (was causing 401 on every run). |
| `api/lumen.js` | Lumen AI companion | **Edge. UPDATED 12 Apr 2026** — full six-move methodology prompt. Requires at least one user message in `messages` array — empty array returns fallback. |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | **Node.js. LIVE 12 Apr 2026.** Runs every minute. Fires balcony reminders AND planned moment nudges (respecting frequency/days). |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `vercel.json` | Rewrites + cron schedule | `*/45 * * * *` for whoop-refresh. `* * * * *` for nudge-whatsapp. **No `functions` block** — adding one breaks Edge runtime compilation. |
| `README-DEV.md` | This file | Update at end of every session before closing |
| `transcripts/*.txt` | 65 coaching transcripts | Plain text. Fetchable via raw GitHub URL. Source of Lumen methodology. |

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
| 7 | Feedback is a Gift | **Live (`/mission-7.html`) — fully fixed 15 Apr 2026** |
| 8-14 | Various | Not built |

---

## Supabase Tables
### wearable_entries columns (actual — verified 10 Apr 2026)
`id, user_id, created_at, mode, pattern_id, pattern_title, recovery, hrv, strain, sleep_score, answers (jsonb), lumen_reply, tags, feedback_score, feedback_text`
Note: column is `mode` NOT `signal_state`. Column is `pattern_title` NOT `lumen_opening`.

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
| `study_participants` | Study cohort record — all 4 participants added 12 Apr 2026 |
| `rewrite_trees` | Rewrite It — declaration + identity shift per user (one active per user) |
| `rewrite_beliefs` | Rewrite It — belief/value from/toward pairs |
| `rewrite_practices` | Rewrite It — practices (what/when/where/how/who/HALS/measure) |
| `rewrite_diary` | Rewrite It — daily balcony entries + practice check-ins |
| `rewrite_nudge_settings` | Rewrite It — WhatsApp nudge number + time (UTC). Simon set to 18:00 UTC. |
| `rewrite_weekly_plans` | **NEW 15 Apr 2026** — weekly intention + Lumen reflection per user per week_start |
| `rewrite_planned_moments` | **NEW 15 Apr 2026** — planned moments (action, practice_id, frequency, frequency_days[], nudge_enabled, nudge_time, nudge_message, lumen_reflection) |
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
| `TWILIO_ACCOUNT_SID` | **SET 12 Apr 2026** — starts with AC |
| `TWILIO_AUTH_TOKEN` | **SET 12 Apr 2026** |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (Twilio sandbox) — **SET 12 Apr 2026** |

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
15. **localStorage sync** — wearable.html saves to localStorage first then Supabase. `syncPendingEntries()` runs on init to retry any entry with no `supabaseId`.
16. **wearable_entries column types** — `recovery`, `hrv`, `strain` are `numeric` (not integer). Always `Math.round()` before insert. Constraint: `mode` must be one of `red`, `green`, `amber`.
17. **Lumen 401 silent failure** — if Supabase session expires mid-conversation, Lumen returns 401 and shows "Lumen is quiet. Keep going." Looks intentional but is auth failure. Not yet fixed.
18. **lumen.js is Edge runtime** — `export const config = { runtime: 'edge' }` must stay. Never add Node.js module.exports to it.
19. **Transcripts are .txt in /transcripts folder** — fetchable via raw GitHub URL. Both .docx and .txt versions exist. Use .txt for reading.
20. **Cron auth check removed** — both `whoop-refresh.js` and `nudge-whatsapp.js` had auth checks that caused 401 on every cron run. Removed 12 Apr. Do NOT re-add.
21. **nudge_time is UTC** — stored as `time without time zone`. Cron compares `HH:MM` against UTC. UK participants must subtract 1hr (BST). UI shows UTC label with hint.
22. **nudge-whatsapp only shows today's body signal** — queries `wearable_entries` with `created_at >= today`. If no session done today, sends nudge without data line. Never shows stale data.
23. **Vercel env var changes need a new deployment** — Redeploy via UI reuses the same build. Must push a GitHub commit to force a fresh build that picks up new env vars.
24. **GitHub MCP — use the official GitHub server** — `github-mcp-server` binary (installed via `brew install github/github-mcp-server/github-mcp-server`). Config: `{"command": "github-mcp-server", "args": ["stdio"], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "..."}}`. The old `@modelcontextprotocol/server-github` (npx) silently truncated large file pushes — do NOT use it.
25. **lumenSystemPrompt persists across conversation (FIXED 13 Apr)** — `triggerLumenReflection()` stores the rich system prompt in `lumenSystemPrompt`. `sendToLumen()` uses it for all continuation messages. Lumen stays in full context for the whole session.
26. **wearable.html is ~107KB — large file pushes work fine** with the official GitHub MCP server (rule 24). `create_or_update_file` handles the full file without truncation.
27. **wearable.html last known-good commit** — `5f46d9b` (14 Apr, sticky topbar, no auth-user-bar, consistent nav).
28. **ALWAYS FETCH BEFORE ANSWERING REVERT QUESTIONS** — if Simon asks "do we need to revert X?" or "is file Y still correct?", Claude must fetch the live file from GitHub before answering. Never rely on memory. This rule exists because Claude confidently said vercel.json did not need reverting during the Jaroslav session without checking — it did, and caused 6 consecutive failed builds.
29. **vercel.json must never have a `functions` block** — adding one causes Vercel to attempt ESM-to-CommonJS compilation of Edge functions, which fails with "Unhandled type: Identifier". Runtime is declared via `export const config = { runtime: 'edge' }` inside the file itself.
30. **No package.json in the repo root** — vanilla Vercel project with no build step. Adding `{"type": "module"}` breaks all Node.js API functions that use `module.exports`.
31. **When Vercel is behind GitHub HEAD — force redeploy by touching README-DEV.md** — push a trivial README-DEV change to trigger a fresh build from current HEAD. Do NOT push code changes to force a deploy.
32. **Node.js version is pinned to 20.x in Vercel project settings** — Node 24 causes "Unhandled type: Identifier" build errors. Check `Vercel > Settings > Build & Deployment > Node.js Version` if builds start failing for no obvious reason.
33. **Topbar rule — never overwrite `topbar-user` with anything other than email** — `rewrite.html` has a separate `topbar-streak` span for the streak count. The streak rendering function (`renderStreak()`) must only write to `topbar-streak`, not `topbar-user`. Before 14 Apr it was overwriting the email — now fixed.
34. **`create_or_update_file` replaces the ENTIRE file** — never use it for single-line changes in large files. It sets the file to exactly the `content` field provided. For surgical changes to large files, use `push_files` with the full correct content, or `push_files` with the patched content from bash manipulation.
35. **Use It nav goes to `/use-it.html` (the hub), not `/wearable.html`** — `wearable.html` is one tool inside Use It. Users land on the hub first and choose their tool.
36. **Mission pages auth pattern** — all mission pages redirect to `signin.html?next=/mission-X.html` if no Supabase session. They do NOT have inline auth forms. Never add an inline auth form to a mission page — it won't work correctly with existing sessions.
37. **Mission 7 feedback cards use `entries` table with `tool='feedback-card'`** — same pattern as Mission 6 trigger diary (`tool='trigger-diary'`). One row per person/card. `entry_data` jsonb stores: `person_name`, `why`, `focus_area`, `plus`, `ebi`, `landed`, `not_landed`, `status` (pending/received).
38. **Mission 7 feedback card ID swap pattern** — cards start with temp ID `card-[timestamp]`. On first save, a real UUID is inserted and ALL element IDs are swapped (card, body, clp, clm, clr, toggle, status-badge, status-pending, status-received). `attachCardListeners` uses a `ref = { id: cardId }` object stored on `fc._ref` — the closure captures `ref`, not the ID string, so it always has the current UUID after swap.
39. **Mission 7 all card buttons use `data-action` event delegation** — status toggle, Lumen open/close/send, delete, and header toggle are all wired via `card.addEventListener('click')` using `e.target.closest('[data-action]')`. Never use inline `onclick` with hardcoded card IDs — they break after the temp→UUID swap.
40. **lumen.js requires at least one user message** — the Anthropic API returns an error if `messages` is empty, which falls through to the "Lumen is quiet" fallback. When auto-firing Lumen on card open (no user text), `sendCardLumenMessage` must add a silent `{role:'user', content:'Please reflect on this feedback record.'}` message before calling the API.
41. **Deploy protocol for large files** — fetch raw file from GitHub -> manipulate in bash with Python string replacement -> verify with `node --check` -> `present_files` for Simon to push via GitHub web editor (Cmd+A, paste, commit). Never rely on `create_or_update_file` for files >~40KB — the tool passes the literal content parameter, not filesystem content.

---

## Data Flow — Body Signal
1. User signs in -> `signin.html` -> Supabase session persists across all pages
2. `wearable.html` passes `Authorization: Bearer [supabaseJWT]` to `/api/whoop-data`
3. `whoop-data.js` decodes JWT -> `user_id` -> queries `whoop_connections` by `user_id`
4. Fetches 28 days WHOOP v2 API using stored `access_token`
5. Auto-refreshes token if expired using `refresh_token`
6. Computes 28-day baselines + z-scores
7. Runs composite load index + 9-state scoring engine
8. Writes scored row to `daily_state` (fire-and-forget, upsert on user_id+date)
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

## Lumen Architecture — UPDATED 15 Apr 2026

### The New Prompt — Six Moves
`api/lumen.js` now contains a full methodology prompt extracted from 65 real coaching transcripts. The six moves:

1. **SURFACE** — warmth first, find what is actually present. Stay here until the real thing emerges.
2. **NAME THE CODE** — when the same fear/belief appears twice in different forms, name it precisely. "The code I'm hearing is..."
3. **GIVE IT ITS PLACE** — never attack the code. It was adaptive once. "Where did that come from? When was it true?"
4. **THE PARADOX** — the pivot point. Always: "Here's the irony... the way that code is working is creating the very thing you fear most." Do not rush past this. Let it land.
5. **THE REFRAME** — only after the paradox lands. "Is it actually true?" Help them find the new belief — do not give it to them.
6. **THE PRACTICE** — specific, scheduled, embodied. Catch vagueness.

### The Question / Offer Distinction
Questions when excavating. Offers when you've seen enough to name something.
If the offer is rejected — treat it as data. Ask: "What would you say instead?"

### The Balcony Close — always four questions in sequence
1. "What are you taking away?"
2. "What are you learning?"
3. "What do you need to integrate?"
4. "And what are you going to do — specifically?"

### Mission 7 Lumen — four moments
1. Bridge from Mission 6 (reads trigger they named, reflects it back)
2. Per-card: reads all fields (who, why, focus, plus, ebi, landed, not_landed). Names the gap between what was heard and what was expected. Fires only when card has content. If empty shows "Fill in some of the card first..."
3. Cross-card pattern: reads all cards together, names the theme appearing across multiple people
4. Arc close: names the shift others see that the person is beginning to own

---

## Rewrite It — Architecture (UPDATED 15 Apr 2026)

### New three-tab structure
**Today tab:** Declaration hero at top. Practices checklist (tick off inline). Balcony check-in anchored to declaration.
**Plan tab:** Weekly intention (Lumen reflects on it). Planned moments list — each moment has action, practice link, frequency, day picker, nudge toggle + time + message, "Ask Lumen" per moment.
**History tab:** Read-only balcony entries. Chronological.

### Two new Supabase tables (created 15 Apr 2026, RLS enabled)
- `rewrite_weekly_plans` — `user_id, week_start, intention, lumen_reflection`
- `rewrite_planned_moments` — `user_id, week_start, action, practice_id, frequency, frequency_days[], nudge_enabled, nudge_time, nudge_message, lumen_reflection`

### nudge-whatsapp.js updated (15 Apr 2026)
Now fires two types of nudge:
1. Balcony reminders (existing)
2. Planned moment nudges — respects `frequency` and `frequency_days`. Commit SHA `7c9e8a60`.

### Live data state (verified 14 Apr 2026 — Simon's account)
- Declaration: "Believes rest is productive"
- Running as: "I am lazy if I don't carry it all and I stop"
- Becoming: "I rest to stay productive"
- 1 practice: "I will check my mind talk and breathe when I feel the anger / When they arise"
- 2 beliefs: productivity belief + sustainable productivity value
- 1 balcony entry: 10 Apr — "I am being calmer, managing the thoughts in my mind"

---

## WhatsApp Nudge — LIVE 12 Apr 2026
- Cron: every minute via `vercel.json`
- Finds users where `nudge_time` (UTC) matches current UTC minute
- Skips if balcony practice already completed today
- Fetches today's `wearable_entries` — shows recovery/HRV/signal if session done today, otherwise sends without data
- **Also fires planned moment nudges** (added 15 Apr) — respects frequency/days per moment
- Message: "Time to get on the balcony." + body signal line (if available) + link to `wearable.html`
- Twilio sandbox: `+14155238886`. Join keyword: `join suggest-obtain`
- Simon opted in. Nudge confirmed working at 18:25 UTC 12 Apr 2026.

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
- **Two-day arc:** 23% recovery -> 72% recovery in one night. Green session surfaced second HALS: self-compassion feels threatening.
- **Full case study:** `jackson-case-study.docx` in project files

---

## Outstanding Work

### Immediate — still pending
- [ ] **Push mission-7.html** — the empty-messages fix (Lumen auto-fire on cards) was patched in-browser this session but NOT yet deployed to GitHub. Must push the file from outputs.
- [ ] Monica, Melinda, Jackson reconnect WHOOP (refresh tokens expired — needs OAuth reconnect from their devices)
- [ ] Monica, Melinda, Jackson opt in to Twilio sandbox + set nudge time in Rewrite It
- [ ] Verify `daily_state` table populating correctly (load wearable.html, check Supabase)
- [ ] Clean up any remaining empty `{}` feedback card entries in Supabase for Simon

### Next build
- [ ] Mission 1 -> Rewrite It handover CTA (pre-populate declaration from Case for Change answer)
- [ ] "See what Lumen notices across your feedback" button — same empty messages bug as card Lumen, same one-line fix needed
- [ ] Missions 4, 5, 8-14 to build (1, 2, 3, 6, 7 live)

### Study
- [ ] SRIS baseline — all 4 participants before 30-day mark
- [ ] Pattern Recurrence Rate first analysis at 30 days (Melinda: most history — due mid-April, OVERDUE)
- [ ] Jackson 30-day follow-up — does Body Signal confirm the identity shift?

### Infrastructure
- [ ] WHOOP cross-user isolation bug — fix files ready (`whoop-data.js`, `wearable.html`, `whoop-callback.html`) but never pushed
- [ ] Supabase SQL pending: `UPDATE whoop_connections SET user_id='a64f2289-f8d9-409c-9807-c58996c13b20' WHERE whoop_member_id='34690349'` then Melinda reconnects WHOOP
- [ ] Submit Safe Browsing false positive: `safebrowsing.google.com/safebrowsing/report_error/`
- [ ] Twilio sandbox -> production WhatsApp Business API (when study scales)

---

## Research Paper
File: `body-signal-research-paper.docx`
Last updated: 10 Apr 2026
**Case study:** `jackson-case-study.docx` — to be updated at 30 days with full physiological arc.

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
```

---

## Session Log
| Date | Key work done |
|---|---|
| ~7 Apr 2026 | Body Signal MVP. WHOOP OAuth. 9-state scoring engine. Lumen opening observation. wearable.html live. |
| 8 Apr 2026 | Cross-user isolation fixed (JWT-only lookup). WHOOP auth refactored. Melinda connected. 3 participants live. |
| 9 Apr 2026 | Scoring engine WHOOP AI validated. Guardrails added. Composite load index built. Feedback measure deployed. Research paper updated. Rewrite It conceived + mocked up. |
| 10 Apr 2026 AM | rewrite.html built (4 screens, SVG icons, 5 Supabase tables with RLS). HRV volatility + AMBER_VOLATILE added. Jackson (4th participant) connected. CRON_SECRET added. |
| 10 Apr 2026 PM | WHOOP token expiry fixed. whoop-refresh.js Node.js runtime confirmed. localStorage->Supabase sync added. Three-tab nav across all pages. Jackson case study written. README-DEV established. |
| 11 Apr 2026 | Three bugs fixed: float types, pendingSync, amber mode constraint. Jackson 2 sessions in Supabase. Body confirmed identity shift overnight (23% -> 72%). Second HALS surfaced in green session. Case study Section 9 added. Research paper Section 3.4 added. |
| 12 Apr 2026 AM | 65 coaching transcripts converted to .txt and pushed to /transcripts/. Transcript corpus analysed. Lumen six-move methodology prompt written and deployed. systemExtra audit completed. |
| 12 Apr 2026 PM | GitHub MCP server installed. whoop-refresh cron fixed. All 4 participants added to study_participants. Twilio set up and all env vars set. nudge-whatsapp live — first nudge received 18:25 UTC. Nudge message: today's body signal only, links to wearable.html. rewrite.html: nudge settings pre-fill on load, UTC label. |
| 13 Apr 2026 AM | Fixed lumenSystemPrompt bug — wearable.html sendToLumen() was rebuilding a blank system prompt after message 1. wearable.html accidentally wiped twice during session by create_or_update_file with partial content — root cause: old @modelcontextprotocol/server-github npx server silently truncated large file payloads. |
| 13 Apr 2026 PM | Switched to official GitHub MCP server. daily_state write added to whoop-data.js. signin.html confirm-email panel added. Bad session (Jaroslav work) changed Node.js to 24.x and corrupted whoop-data.js with markdown fences — caused 10+ failed builds. Fixed: Node.js pinned back to 20.x in Vercel settings, whoop-data.js restored from clean container copy. Rules 28-32 added. |
| 14 Apr 2026 AM | Nav consistency completed across all 4 pages. Dark sticky topbar, identical structure, all Use It links -> /use-it.html. use-it.html got auth check + sign out. rewrite.html streak fixed (separate topbar-streak span, email stays in topbar-user). Rules 33-35 added. Full platform audit completed — structural issues with Rewrite It documented. Next build priorities set: Rewrite It restructure + Mission 1->Rewrite It handover. |
| 14 Apr 2026 PM | Supabase confirmation email branded as Rewrite Your Life. Mission 7 (Feedback is a Gift) built and deployed — feedback cards (one per person), EBI split, Pending/Received status toggle, Lumen reads across all cards for pattern analysis. Dashboard updated: Mission 7 link activated. Auth bug fixed: mission-7 now redirects to signin.html if no session. Rules 36-37 added. |
| 15 Apr 2026 | **Mission 7 full bug fix session.** Fixed: (1) inline onkeydown syntax error killing JS; (2) 14 duplicate empty card entries from closure bug — closure captured temp ID not ref, every keystroke re-inserted instead of updating. Fixed with `ref = {id}` object on `fc._ref`, updated on UUID swap. (3) All inline onclick attributes replaced with `data-action` event delegation — status toggle, Lumen open/close/send, delete, header toggle all survive temp→UUID swap. (4) Lumen auto-fire on empty card now shows "Fill in some of the card first..." instead of API call on blank data. (5) Lumen stale convo check now catches both "Fill in some" and "Lumen is quiet" messages. (6) Lumen requires at least one user message — empty `messages[]` returns fallback; added silent message on auto-fire. (7) Two new card fields: "What has landed?" and "What has not landed yet?" (`data-field="not_landed"`). Both feed Lumen context. **Rewrite It restructured** — new Today/Plan/History tabs. Two new Supabase tables. nudge-whatsapp updated for planned moment nudges. Rules 38-41 added. |

---

*Update this file at the end of every session. It is the memory between chats.*
