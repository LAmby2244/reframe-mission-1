/**
 * /api/whoop-daily-cron.js
 * Vercel Node.js Function -- Phase 2 daily cron (Step 2 of roll-out plan)
 *
 * Runs ~09:15 UTC daily. For each active study_participants row:
 *   - POSTs to /api/whoop-data with { user_id, cron_secret }
 *   - whoop-data.js handles: token lookup, refresh if needed, WHOOP v2 fetch,
 *     scoring engine, daily_state upsert. Same exact code path as the page-load write.
 *
 * Why no direct WHOOP / scoring logic here: the README explicitly requires
 * "exact same scoring code path as whoop-data.js". Calling the endpoint is
 * the simplest way to guarantee that -- literally the same function runs.
 *
 * Failure mode: if a participant's refresh token is expired, whoop-data.js
 * returns 401. Cron logs the user_id and moves on. Participant must reconnect.
 * (Step 4 will add daily_state.reason_missing to label these rows explicitly.)
 */

module.exports = async function handler(req, res) {
  // Accept GET (Vercel cron default) and POST (for manual trigger + testing)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE env vars');
    return res.status(500).json({ error: 'Missing SUPABASE env vars' });
  }
  if (!CRON_SECRET) {
    console.error('Missing CRON_SECRET -- whoop-data.js cron fallback will reject');
    return res.status(500).json({ error: 'Missing CRON_SECRET' });
  }

  // Derive this deployment's own origin. Vercel sets VERCEL_URL to the
  // deployment hostname without scheme. In production we prefer the custom
  // domain (app.purposefulchange.co.uk) so Vercel Edge cold-starts don't
  // chain weirdly. Fall back to VERCEL_URL when hitting a preview.
  const origin = process.env.CRON_SELF_ORIGIN
    || (process.env.VERCEL_ENV === 'production'
        ? 'https://app.purposefulchange.co.uk'
        : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!origin) {
    console.error('Could not determine self-origin for whoop-data call');
    return res.status(500).json({ error: 'Missing origin' });
  }

  const startedAt = new Date().toISOString();
  console.log('whoop-daily-cron start', startedAt, 'origin', origin);

  // Fetch all active study_participants.
  // If study_participants has an `active` or `status` column, filter here.
  // For now, treat every row as active (cohort is small and curated).
  let participants = [];
  try {
    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/study_participants?select=user_id,whoop_member_id`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY
        }
      }
    );
    if (!pRes.ok) {
      const txt = await pRes.text().catch(() => '');
      console.error('study_participants fetch failed', pRes.status, txt.slice(0, 300));
      return res.status(500).json({ error: 'study_participants fetch failed', status: pRes.status });
    }
    participants = await pRes.json();
  } catch (e) {
    console.error('study_participants fetch error:', e.message);
    return res.status(500).json({ error: 'study_participants fetch error', message: e.message });
  }

  console.log('whoop-daily-cron found', participants.length, 'participants');

  const results = [];

  // Serial (not parallel) on purpose: WHOOP rate-limits, and the cohort is tiny.
  // Each call does 4 WHOOP API fetches + a Supabase write. Keeping it serial
  // also makes Vercel log-ordering sane for debugging.
  for (const p of participants) {
    const userId = p.user_id;
    if (!userId) {
      results.push({ user_id: null, whoop_member_id: p.whoop_member_id, status: 'skipped', reason: 'no_user_id' });
      continue;
    }

    try {
      const wdRes = await fetch(`${origin}/api/whoop-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          cron_secret: CRON_SECRET
        })
      });

      const wdText = await wdRes.text();
      let wdBody = null;
      try { wdBody = JSON.parse(wdText); } catch {}

      if (wdRes.ok) {
        results.push({
          user_id: userId,
          status: 'ok',
          signal_state: wdBody?.signal_state || null,
          days_of_history: wdBody?.days_of_history || null
        });
        console.log('cron', userId, 'ok', wdBody?.signal_state || 'none');
      } else {
        results.push({
          user_id: userId,
          status: 'failed',
          http_status: wdRes.status,
          error: wdBody?.error || wdText.slice(0, 200)
        });
        console.error('cron', userId, 'failed', wdRes.status, (wdBody?.error || wdText).slice(0, 200));
      }
    } catch (e) {
      results.push({ user_id: userId, status: 'error', message: e.message });
      console.error('cron', userId, 'error', e.message);
    }
  }

  const summary = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    participants: participants.length,
    ok: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status !== 'ok').length,
    results
  };

  console.log('whoop-daily-cron summary', JSON.stringify(summary));
  return res.status(200).json(summary);
};
