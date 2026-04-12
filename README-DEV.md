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
| `api/lumen.js` | Lumen AI companion | **UPDATED 12 Apr 2026** — full six-move methodology prompt. See Lumen Architecture section below. |
| `api/whoop-webhook.js` | WHOOP webhook | Fires each morning when sleep scored |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | Daily balcony reminder. Node.js. Twilio env vars not yet set. |
| `api/study-data.js` | Study dashboard data | Service role query across all participants |
| `vercel.json` | Rewrites + cron schedule | `*/45 * * * *` for whoop-refresh. `* * * * *` for nudge-whatsapp. |
| `README-DEV.md` | This file | Update at end of every session before closing |
| `transcripts/*.txt` | 65 coaching transcripts | Plain text versions added 12 Apr 2026. Fetchable via raw GitHub URL. Source of Lumen methodology. |

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
13. **Icons** — SVG stroke icons only. No emoji in UI. Bottom nav 20x20 SVG. Empty state 40x40 SVG.
14. **wearable_entries columns** — `mode` not `signal_state`. `pattern_title` not `lumen_opening`. Always check column names before querying.
15. **localStorage sync** — wearable.html saves to localStorage first then Supabase. `syncPendingEntries()` runs on init to retry any entry with no `supabaseId`.
16. **wearable_entries column types** — `recovery`, `hrv`, `strain` are `numeric` (not integer). Always `Math.round()` before insert. Constraint: `mode` must be one of `red`, `green`, `amber`.
17. **Lumen 401 silent failure** — if Supabase session expires mid-conversation, Lumen returns 401 and shows "Lumen is quiet. Keep going." Looks intentional but is auth failure. Not yet fixed.
18. **lumen.js is Edge runtime** — `export const config = { runtime: 'edge' }` must stay. Never add Node.js module.exports to it.
19. **Transcripts are .txt in /transcripts folder** — fetchable via raw GitHub URL. Both .docx and .txt versions exist. Use .txt for reading.

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
9. `wearable.html` renders signal card → calls `/api/lumen` with arc as `systemExtra` context
10. Lumen reads arc, works through six-move methodology arc
11. After conversation: feedback card ("Did this process surface something useful?" 1-5)
12. Entry saved to localStorage immediately, then Supabase. If Supabase fails, retried on next load.

---

## Scoring Engine — 9 States
**RED** — `red_psych` (rec_z < -0.8, sleep adequate, low strain) / `red_trend` (HRV declining 3+ days, no physical cause, >=7 days history) / `red_strain` (high strain, no workout)
**AMBER** — `amb_load` / `amb_trend` / `amb_recovery` / `amb_volatile` (HRV CV, added 10 Apr)
**GREEN** — `grn_thriving` / `grn_bounce` / `grn_streak`

### Scientific Guardrails (WHOOP AI validated 9 Apr 2026)
1. Recovery >= 67% AND HRV >= baseline AND low strain → block all amber/red trend states
2. `red_trend` requires >=7 days history — under 7 downgrades to `amb_trend`
3. Recovery >= 67% blocks `red_trend` regardless of HRV trend

### Composite Load Index
HRV 40% / Recovery 25% / Sleep consistency 20% / Respiratory rate 15%
2+ signals impaired → escalate one level.

---

## Lumen Architecture — UPDATED 12 Apr 2026

### The Problem with the Old Prompt
The previous Lumen prompt described values and voice but gave Lumen no methodology sequence — no destination. Lumen stayed in open-ended reflective questioning mode indefinitely, which felt like a coaching chatbot rather than a coaching methodology. The paradox move — the pivot point that makes reframing possible — was completely absent.

### The New Prompt — Six Moves
`api/lumen.js` now contains a full methodology prompt extracted from 65 real coaching transcripts. The six moves:

1. **SURFACE** — warmth first, find what is actually present. Stay here until the real thing emerges.
2. **NAME THE CODE** — when the same fear/belief appears twice in different forms, name it precisely. "The code I'm hearing is..."
3. **GIVE IT ITS PLACE** — never attack the code. It was adaptive once. "Where did that come from? When was it true?"
4. **THE PARADOX** — the pivot point. Always: "Here's the irony... the way that code is working is creating the very thing you fear most." The protection overplayed becomes the threat. "You can't escape it." Do not rush past this. Let it land.
5. **THE REFRAME** — only after the paradox lands. "Is it actually true?" Help them find the new belief — do not give it to them. Identity first, functional translation second.
6. **THE PRACTICE** — specific, scheduled, embodied. Catch vagueness. "That doesn't sound like a real commitment. What would make it real?"

### The Question / Offer Distinction
The most important skill in the prompt. Questions when excavating. Offers when you've seen enough to name something.

An offer: "Here's the irony..." / "The code I'm hearing is..." / "What I'm noticing is..."

**If the offer is rejected — treat it as data.** Do not immediately re-offer. Ask one question: "What would you say instead?" or "What is it more like?" Their answer will either refine the offer or redirect you. A rejected offer that produces "no, it's more like..." is often the real belief stated more precisely than the original offer.

### The Balcony Close — always four questions in sequence
1. "What are you taking away?"
2. "What are you learning?"
3. "What do you need to integrate?"
4. "And what are you going to do — specifically?"

### Signal State Calibration
- **RED** — full six moves, paradox usually accessible, do not skip it
- **AMBER** — surface first, paradox may be reachable
- **GREEN** — do not rush to paradox, deeper layers accessible from safety

### Critical Open Question — systemExtra
Lumen receives `systemExtra` from `wearable.html` containing WHOOP context. This is what makes it specific rather than generic. Claude must verify what is actually being passed in systemExtra before assuming Lumen has the signal state, recovery numbers, and session history. Without rich systemExtra context, Lumen opens blind. Next session: audit what wearable.html actually passes.

### Simon's Coaching Language — extracted from transcripts
These phrases are baked into the Lumen prompt verbatim:
- "Here's the irony..." — paradox opener
- "Your code" — the running belief/HALS
- "The overplayed value always creates the opposite of the value"
- "You can't escape it" — permission after the paradox
- "Is it actually true?"
- "That belief was built for a different chapter"
- "Get on the balcony of this"

### Previous Lumen Prompt
Preserved in GitHub commit history. Accessible at any previous commit on `api/lumen.js`. Can be restored in one git command if needed.

---

## The Full Methodology Loop — Signal to Identity Shift

### The Arc
```
Signal → Body → Questions → Belief Named → Origin Surfaced → Reframe → Practice → Identity Shift → Physiological Confirmation
```

### Extended Arc (from Jackson two-day case)
```
Signal → Body → Questions → Belief Named → Origin Surfaced → Reframe → Practice → Identity Shift → Body Confirms → Deeper Layer Surfaces → Work Continues
```

### What the platform produces at the end of a session (Rewrite It output)
1. **The Declaration** — "I am choosing to be someone who [identity claim]."
2. **The Identity Shift** — From / Toward
3. **The Belief Shift** — From / Toward
4. **The HALS Being Revised** — including origin (intergenerational where relevant)
5. **The Practice** — What / When / Where / Who / Why. Specific, embodied, scheduled.
6. **The Measure** — "I will know it is working when..."

### Jackson's case (10 Apr 2026) — reference example
- **Signal:** red_psych, recovery 23%, HRV declining, no physical cause
- **Belief surfaced:** "If I stop, I am lazy"
- **Origin:** Intergenerational — family history of working hard and being useful
- **Declaration:** "I am choosing to be someone who deserves to rest."
- **Identity from/toward:** conditional worth → leads from recovery
- **Belief from/toward:** "If I stop I am lazy" → "I deserve to rest"
- **Practice:** Hit golf balls at the range or throw darts, twice a week, in the diary
- **Measure:** WHOOP recovery stops trending red without physical cause
- **Two-day arc:** 23% recovery → 72% recovery in one night. Green session surfaced second HALS: self-compassion feels threatening.
- **Full case study:** `jackson-case-study.docx` in project files

---

## Coaching Transcripts — 12 Apr 2026
65 transcripts from Simon's real coaching sessions added to `/transcripts/` folder as `.txt` files.
Fetchable via: `https://raw.githubusercontent.com/LAmby2244/reframe-mission-1/main/transcripts/[Name].txt`

### Session Types identified across corpus
| Type | Signal state | Arc | Examples |
|---|---|---|---|
| Personal HALS | red/amber | Full six moves | Jackson, Helen, Kara, Will Rayment, George |
| Leadership/values | amber/green | Overplayed values framing | Marianne, Eugene, Georgina, Danielle |
| Meaning/transition | varied | Integration not reframe | Brian, Raj, Rick |
| First/orientation | any | Edge-finding, not yet at belief | Jason, Nick, Torkjel |

The wearable surfaces Personal HALS sessions most often. That is where Lumen must be strongest.

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
- [ ] All 4 participants reconnect WHOOP once (cron running)
- [ ] Add Jackson to `study_participants` table
- [ ] Set Twilio env vars to activate WhatsApp nudges
- [ ] Simon enters first Rewrite It declaration + balcony entry to test end-to-end
- [ ] **Audit what `systemExtra` wearable.html passes to Lumen** — critical to ensure Lumen is not opening blind (no signal state = generic responses)
- [ ] Test new Lumen prompt with real session — does it feel like Simon or like a checklist?

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

**Case study:** `jackson-case-study.docx` — complete narrative arc from signal to identity shift.
Nine sections including the intergenerational HALS layer, two-stage reframe, structured Rewrite It output, and the two-day arc (Section 9).
To be updated at 30 days with full physiological arc.

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

# Convert transcripts locally (if needed)
cd '/Users/simonlamb/Library/CloudStorage/OneDrive-PurposefulChange/coaching transcripts'
for f in *.docx; do pandoc "$f" -t plain -o "${f%.docx}.txt" && echo "Done: $f"; done
```

---

## Session Log
| Date | Key work done |
|---|---|
| ~7 Apr 2026 | Body Signal MVP. WHOOP OAuth. 9-state scoring engine. Lumen opening observation. wearable.html live. |
| 8 Apr 2026 | Cross-user isolation fixed (JWT-only lookup). WHOOP auth refactored. Melinda connected. 3 participants live. |
| 9 Apr 2026 | Scoring engine WHOOP AI validated. Guardrails added. Composite load index built. Feedback measure deployed. Research paper updated. Rewrite It conceived + mocked up. |
| 10 Apr 2026 AM | rewrite.html built (4 screens, SVG icons, 5 Supabase tables with RLS). HRV volatility + AMBER_VOLATILE added. Jackson (4th participant) connected. CRON_SECRET added. |
| 10 Apr 2026 PM | WHOOP token expiry fixed. whoop-refresh.js Node.js runtime confirmed. localStorage→Supabase sync added. Three-tab nav across all pages. Jackson case study written. README-DEV established. |
| 11 Apr 2026 | Three bugs fixed: float types, pendingSync, amber mode constraint. Jackson 2 sessions in Supabase. Body confirmed identity shift overnight (23% → 72%). Second HALS surfaced in green session. Case study Section 9 added. Research paper Section 3.4 added. |
| 12 Apr 2026 | 65 coaching transcripts converted to .txt and pushed to /transcripts/ on GitHub. Transcript corpus analysed — Simon's coaching methodology extracted (six moves, question/offer distinction, paradox move, balcony close, Simon's exact language). Lumen system prompt completely rewritten based on real transcripts. New prompt deployed to production. Critical open question identified: need to audit systemExtra context passed from wearable.html to Lumen — without rich context Lumen may open generically. |

---

*Update this file at the end of every session. It is the memory between chats.*
