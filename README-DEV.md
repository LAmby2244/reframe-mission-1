# README-DEV — Purposeful Change Platform
## Single source of truth across all Claude development sessions

> **How to use this file:** At the start of every new Claude session, share this file. Claude reads it and picks up exactly where we left off. At the end of every session, update this file before closing.

---

## Platform Architecture

**Rewrite Your Life** — the platform name
- **Learn It** — 14 sequential Reframe missions (`/dashboard.html` + `/mission-*.html`)
- **Use It** — Body Signal, Trigger Diary, Courageous Conversation Prep (`/wearable.html`)
- **Rewrite It** — The living practice. Where it all lands. (`/rewrite.html`)

Domain: `app.purposefulchange.co.uk`

---

## Stack

| Component | Detail |
|---|---|
| Hosting | Vercel — `prj_XhDamdR45TOFhqZqHTk7A6NKWdbU` / `team_QdSm8BPRfWR7RxBzM0CtW9Ky` |
| Database / Auth | Supabase — `aoqjfqmlcccsosddqnws` |
| GitHub | `github.com/LAmby2244/reframe-mission-1` |
| DNS | 123-reg CNAME → `fb96c77117a481ee.vercel-dns-017.com` |
| Wearable | WHOOP API (OAuth2, `api.prod.whoop.com`) |
| AI companion | Lumen — Claude via `/api/lumen` |
| Brand | Rubik typeface, Purposeful Change palette (orange #F56914 / dark green #0A3228 / yellow #FFBE19) |

---

## Study Participants — All Live

| Person | Supabase user_id | WHOOP member_id | Start date |
|---|---|---|---|
| Simon | b34d797c-80b7-4c15-94ac-159ef813e202 | 36136954 | 5 Apr 2026 |
| Monica | a63f92be-e643-44e2-8775-5fa9c6fc6838 | 36285499 | 6 Apr 2026 |
| Melinda | a64f2289-f8d9-409c-9807-c58996c13b20 | 34690349 | 17 Mar 2026 |
| Jackson | ce31c087-3517-409f-a266-b4c46f978c23 | 23042959 | 10 Apr 2026 |

---

## Supabase Tables (all in `public` schema)

| Table | Purpose |
|---|---|
| `whoop_connections` | WHOOP OAuth tokens per user. Unique constraint on `whoop_member_id`. |
| `wearable_entries` | Body Signal sessions — signal state, WHOOP snapshot, answers, Lumen reply, feedback_score, feedback_text |
| `daily_state` | Raw daily WHOOP metrics per user |
| `answers` | Reframe mission answers |
| `entries` | Reframe mission entries |
| `lumen_instructions` | Per-user Lumen system context |
| `lumen_stage` | Lumen arc stage tracking (Stage 1→2→3) |
| `pattern_recurrence_rate` | Primary study metric |
| `wearable_pattern_summary` | View — pattern frequency per user |
| `weekly_study_summary` | Weekly aggregation |
| `study_participants` | Study cohort record |
| `rewrite_trees` | Rewrite It — declaration + identity shift per user |
| `rewrite_beliefs` | Rewrite It — belief/value from→toward pairs |
| `rewrite_practices` | Rewrite It — practice details (what/when/where/how/who/HALS/measure) |
| `rewrite_diary` | Rewrite It — daily balcony entries + practice check-ins |
| `rewrite_nudge_settings` | Rewrite It — WhatsApp nudge number + time |

---

## Key Files in Repo

| File | Purpose | Status |
|---|---|---|
| `wearable.html` | Body Signal — WHOOP metrics, signal state, Lumen conversation, feedback card | ✅ Live |
| `rewrite.html` | Rewrite It — Declaration, five dimensions, balcony diary, practices, history | ✅ Live |
| `dashboard.html` | Learn It — mission dashboard | ✅ Live |
| `api/whoop-data.js` | Fetches + scores WHOOP data. Node.js. Composite load index, guardrails, state escalation | ✅ Live |
| `api/whoop-auth.js` | WHOOP OAuth handler. JWT is sole source of user_id. No KNOWN_MEMBERS map. | ✅ Live |
| `api/whoop-refresh.js` | Cron job — refreshes all expiring tokens every 45 min. Node.js `module.exports` | ⚠️ See below |
| `api/lumen.js` | Lumen AI companion endpoint | ✅ Live |
| `api/nudge-whatsapp.js` | WhatsApp nudge cron | ✅ Live |
| `vercel.json` | Rewrites + cron schedule (`*/45 * * * *` for whoop-refresh) | ✅ Live |

---

## Current Known Issue — WHOOP Token Expiry Loop

**Symptom:** App shows "WHOOP unreachable · Reconnect →" repeatedly. All 4 tokens expired.

**Root cause:** WHOOP tokens expire ~1 hour after issue. The `whoop-refresh.js` cron is configured but NOT firing because the file was written with `export const config = { runtime: 'edge' }` and `export default` — Edge runtime syntax. The build log shows it is being silently skipped. All other API files use Node.js `module.exports` syntax.

**Fix ready:** New `api/whoop-refresh.js` using `module.exports` is in outputs — needs pushing to GitHub.

**Immediate workaround:** Everyone reconnects WHOOP manually via the Reconnect link. Once the cron fix is deployed and a fresh token is seeded, the cron keeps it alive.

**Env var required:** `CRON_SECRET` — already set in Vercel (all environments, added 10 Apr 2026).

**Verification:** After pushing fix, check build log — `whoop-refresh.js` should appear in the "Compiling" list alongside lumen.js, whoop-data.js etc.

---

## Scoring Engine — Current State (whoop-data.js)

### Nine signal states
Three zones: RED (01-03), AMBER (07-09), GREEN (04-06)

### Scientific Guardrails (WHOOP AI validated, 9 Apr 2026)
1. **Physiological wellbeing override** — recovery ≥ 67% AND HRV ≥ baseline AND strain low → block all amber/red trend states
2. **Minimum history** — `red_trend` requires ≥7 days. Under 7 → downgrade to `amb_trend`
3. **Recovery override** — recovery ≥ 67% blocks `red_trend` regardless of HRV trend

### Composite Load Index (WHOOP AI validated, 9 Apr 2026)
| Signal | Weight |
|---|---|
| HRV | 40% |
| Recovery | 25% |
| Sleep consistency | 20% |
| Respiratory rate | 15% |

**State escalation:** 2+ signals impaired → escalate one level (amber→red, null→amber)

**Sleep consistency:** >60 min SD in onset over 3+ days = meaningful signal. Chronic (5+ days) + borderline HRV can push through green guardrail to amber.

**RR standalone:** >1.0 bpm above baseline for 2+ consecutive nights = meaningful signal.

### New response fields
`composite_load`, `impaired_signals`, `sleep_consistency_sd_mins`, `rr_score`

### AMBER_VOLATILE state
Added 10 Apr 2026 — HRV instability/high coefficient of variation without absolute suppression.

### HRV Volatility
Added 10 Apr 2026 — night-to-night CV calculation. Further validation needed (separate session).

---

## Rewrite It — Architecture

**Four screens (bottom nav):**
- **Tree** — Declaration, identity shift (running as → becoming), beliefs/values, today's practices
- **Balcony** — Daily practice. Three questions + Lumen reflection. Streak tracking.
- **Practices** — All practices with full detail. WhatsApp nudge settings.
- **History** — All balcony entries with Body Signal state badge + Lumen replies.

**Lumen in Rewrite It:** Reads declaration, identity shift, recent diary entries, current Body Signal state → 2-3 sentence mirror reflection.

**Five dimensions of the shift:**
- Identity — who I am becoming
- Values — what I am reclaiming
- Beliefs — old belief releasing / new belief chosen
- Behaviours — the specific small daily vote
- Impact — what changes in me and others

**Lumen arc stages:**
- Stage 1 (entries 1-3): reflects individual entries
- Stage 2 (entries 4-8): names the pattern explicitly
- Stage 3 (entries 9+): tracks absence of previously recurring patterns

---

## Study Outcome Measure

After each Lumen conversation in Body Signal:
**"Did this process surface something useful?"** — 1-5 scale
**"If so, what?"** — optional free text

Saved to `wearable_entries.feedback_score` and `wearable_entries.feedback_text`.

---

## API Architecture Notes

- All API files use **Node.js `module.exports`** — NOT `export default` / Edge runtime
- Exception was `whoop-data.js` which uses `export const config = { runtime: 'edge' }` — this WORKS because it was already deployed correctly
- **Do NOT add `export const config = { runtime: 'edge' }` to new Node.js files** — it breaks them silently
- WHOOP v2 API requires full ISO datetime strings (`toISOString()` not `.split('T')[0]`)
- Supabase token updates use **PATCH** with `Prefer: resolution=merge-duplicates`
- JWT is the sole source of `user_id` — no hardcoded member maps
- `whoop-auth.js` reads token from `req.query.token` (browser redirect) AND `req.headers.authorization`

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

## Outstanding Work

### Immediate
- [ ] Push fixed `api/whoop-refresh.js` (Node.js `module.exports` version) to GitHub
- [ ] Verify build log shows `whoop-refresh.js` compiling
- [ ] All 4 participants reconnect WHOOP once to seed fresh tokens
- [ ] Add Jackson to `study_participants` table

### Body Signal — model
- [ ] HRV volatility (CV) — needs focused validation session with WHOOP AI
- [ ] Skin temperature signal — lower priority, after HRV volatility

### Study
- [ ] SRIS baseline measure — run with all 4 participants before 30-day mark
- [ ] First Pattern Recurrence Rate analysis at 30 days (Melinda has most history ~24+ days)
- [ ] Lumen stage tracking — verify Stage 1→2→3 transitions are being logged

### Rewrite It
- [ ] Test with real user data (Simon to enter declaration + first balcony entry)
- [ ] WhatsApp nudge cron (`api/nudge-whatsapp.js`) — verify it's functional
- [ ] RLS policies on rewrite tables (currently unrestricted)

### Reframe workbook
- [ ] Missions 3-5, 7-14 still to build (Missions 1, 2, 6 live)

### Research paper
- [ ] Update with Jackson as 4th participant
- [ ] Update with HRV volatility when validated

---

## Research Paper

Location: `body-signal-research-paper.docx` (in project files + Simon's Google Drive)

Last updated: 10 Apr 2026

Contains: Theory of change, technical spec (9-state scoring engine, composite load index, guardrails), research design (Pattern Recurrence Rate primary metric, Phase 1 family cohort), Lumen arc, literature references, next steps.

---

## Session Log

| Date | Key work done |
|---|---|
| 9 Apr 2026 | WHOOP OAuth fixed (JWT-only, no KNOWN_MEMBERS). Scoring engine validated with WHOOP AI. Guardrails added. 3 participants live. Feedback measure built. Composite load index built. Research paper updated. Rewrite It conceived + mocked up. Platform named: Learn It / Use It / Rewrite It. |
| 10 Apr 2026 (AM) | rewrite.html built and deployed (50k chars). HRV volatility added. AMBER_VOLATILE state added. Jackson (4th participant) added. cron_secret env var added. whoop-refresh.js cron deployed but not firing (Edge runtime bug — fix ready). All 4 tokens expired. |
| 10 Apr 2026 (PM) | Identified cron bug (Edge vs Node.js runtime). Fixed whoop-refresh.js. README-DEV.md created. |
