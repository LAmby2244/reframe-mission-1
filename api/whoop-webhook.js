/**
 * /api/whoop-webhook.js
 * Vercel Edge Function — WHOOP Webhook Receiver
 *
 * WHOOP calls this URL when new data is available for a user:
 *   - recovery.scored  → new recovery cycle complete
 *   - sleep.scored     → sleep data processed
 *   - workout.scored   → workout recorded
 *
 * Webhook URL to register with WHOOP:
 *   https://reframe-mission-1.vercel.app/api/whoop-webhook
 *
 * Environment variables required:
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

export const config = { runtime: 'edge' };

const WHOOP_BASE = 'https://api.prod.whoop.com/developer/v2';

export default async function handler(req) {

  // WHOOP sends a GET request to verify the webhook on registration
  // Respond with the challenge token to confirm ownership
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('challenge');
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    return new Response('WHOOP webhook endpoint active', { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Parse the webhook payload
  let event;
  try {
    event = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // WHOOP webhook payload shape:
  // { event_type: 'recovery.scored', user_id: '12345', trace_id: 'abc' }
  const { event_type, user_id: whoopMemberId } = event;

  // We only care about recovery events for the study
  // sleep.scored and workout.scored are useful but recovery is primary
  const relevantEvents = ['recovery.scored', 'sleep.scored', 'workout.scored'];
  if (!relevantEvents.includes(event_type)) {
    return new Response('Event ignored', { status: 200 });
  }

  try {
    // ── 1. GET THE USER'S ACCESS TOKEN FROM SUPABASE ────
    const tokenRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${whoopMemberId}&select=access_token,refresh_token,expires_at,user_id`,
      {
        headers: {
          'apikey':        process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        }
      }
    );

    const connections = await tokenRes.json();
    if (!connections.length) {
      // User not in our system — ignore
      return new Response('User not found', { status: 200 });
    }

    let { access_token, refresh_token, expires_at, user_id } = connections[0];

    // ── 2. REFRESH TOKEN IF EXPIRED ──────────────────────
    if (new Date(expires_at) < new Date()) {
      const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token,
          client_id:     process.env.WHOOP_CLIENT_ID,
          client_secret: process.env.WHOOP_CLIENT_SECRET,
        })
      });

      if (refreshRes.ok) {
        const newTokens = await refreshRes.json();
        access_token = newTokens.access_token;

        // Update token in Supabase
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${whoopMemberId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':  'application/json',
              'apikey':        process.env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              access_token:  newTokens.access_token,
              refresh_token: newTokens.refresh_token,
              expires_at:    new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
              updated_at:    new Date().toISOString(),
            })
          }
        );
      }
    }

    // ── 3. FETCH TODAY'S WHOOP DATA ───────────────────────
    // Only fetch the specific data type that triggered the webhook
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [cycleRes, sleepRes, workoutRes] = await Promise.all([
      fetch(`${WHOOP_BASE}/cycle?start=${yesterday}&end=${today}&limit=2`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }),
      fetch(`${WHOOP_BASE}/activity/sleep?start=${yesterday}&end=${today}&limit=2`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }),
      fetch(`${WHOOP_BASE}/activity/workout?start=${yesterday}&end=${today}&limit=5`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }),
    ]);

    const cycles   = cycleRes.ok   ? (await cycleRes.json()).records   || [] : [];
    const sleeps   = sleepRes.ok   ? (await sleepRes.json()).records   || [] : [];
    const workouts = workoutRes.ok ? (await workoutRes.json()).records || [] : [];

    if (!cycles.length) {
      return new Response('No cycle data yet', { status: 200 });
    }

    const cycle = cycles[0];
    const sleep = sleeps[0];
    const score = cycle.score || {};
    const sleepScore = sleep?.score || {};
    const cycleDate = cycle.start?.split('T')[0] || today;
    const workoutDates = new Set(workouts.map(w => w.start?.split('T')[0]).filter(Boolean));

    const hoursSlept = sleepScore.stage_summary?.total_in_bed_time_milli
      ? sleepScore.stage_summary.total_in_bed_time_milli / 3600000 : null;
    const sleepNeed = sleepScore.sleep_needed?.baseline_milli
      ? sleepScore.sleep_needed.baseline_milli / 3600000 : null;
    const sleepStress = sleepScore.respiratory_rate
      ? (sleepScore.respiratory_rate > 17 ? 'poor' : sleepScore.respiratory_rate > 15 ? 'sufficient' : 'optimal')
      : null;

    // ── 4. SAVE TO daily_state ────────────────────────────
    const stateRecord = {
      user_id,
      date:                cycleDate,
      recovery_pct:        score.recovery_score ?? null,
      hrv_ms:              score.hrv_rmssd_milli ?? null,
      rhr_bpm:             score.resting_heart_rate ?? null,
      sleep_hours:         hoursSlept,
      sleep_need_hours:    sleepNeed,
      sleep_perf_pct:      sleepScore.sleep_performance_percentage ?? null,
      sleep_stress:        sleepStress,
      day_strain:          score.strain ?? null,
      workout_logged:      workoutDates.has(cycleDate),
      sleep_suff:          hoursSlept && sleepNeed ? hoursSlept / sleepNeed : null,
    };

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/daily_state`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify(stateRecord)
    });

    // ── 5. CHECK IF EXPLORATION SCORE WARRANTS A NUDGE ───
    // Future: send a notification if exploration_score >= 7
    // For now: just log and return success

    console.log(`Webhook processed: ${event_type} for member ${whoopMemberId}, date ${cycleDate}, recovery ${score.recovery_score}`);

    return new Response(JSON.stringify({ ok: true, date: cycleDate }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Webhook error:', err);
    // Return 200 to stop WHOOP retrying — log the error internally
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
