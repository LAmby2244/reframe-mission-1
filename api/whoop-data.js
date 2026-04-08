/**
 * /api/whoop-data.js
 * Vercel Edge Function — WHOOP Data + Scoring Engine
 *
 * POST /api/whoop-data
 * Headers: { Authorization: Bearer <supabase_session_token> }
 *
 * No WHOOP token needed from the client — it's looked up server-side
 * from whoop_connections using the authenticated user's Supabase session.
 * The webhook keeps whoop_connections fresh automatically.
 */

export const config = { runtime: 'edge' };

const WHOOP_BASE = 'https://api.prod.whoop.com/developer/v1';

// ── HELPERS ───────────────────────────────────────────────────────

async function whoopGet(path, token) {
  const res = await fetch(`${WHOOP_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`WHOOP ${path} failed: ${res.status}`);
  return res.json();
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  return Math.max(Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length), 0.1);
}

function zScore(value, baseline_mean, baseline_sd) {
  if (value === null || value === undefined) return null;
  return (value - baseline_mean) / baseline_sd;
}

// ── SCORING ENGINE ────────────────────────────────────────────────

function scoreSignalState(today, baselines, history) {
  const { rec_z, hrv_z, rhr_z, strain_z, nas_z, sleep_suff, sleep_stress, workout_logged } = today;

  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];
  const last3rec = history.slice(0, 3).map(d => d.recovery_pct).filter(Boolean);
  const recRising = last3rec.length >= 2 && last3rec[0] > last3rec[last3rec.length - 1];

  if (rec_z !== null && rec_z < -0.8 && sleep_suff >= 0.85 && strain_z < 0.3 &&
      (sleep_stress === 'poor' || (hrv_z !== null && hrv_z < -0.5)))
    return { state: 'red_psych', confidence: 'high' };

  if (hrvDeclining && hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) && strain_z < 0.5)
    return { state: 'red_trend', confidence: 'high' };

  if (strain_z > 1.0 && !workout_logged && nas_z > 1.0)
    return { state: 'red_strain', confidence: 'high' };

  if (rec_z !== null && rec_z < -0.8 && sleep_suff >= 0.85)
    return { state: 'red_psych', confidence: 'medium' };

  if (hrvDeclining && strain_z < 0.5)
    return { state: 'red_trend', confidence: 'medium' };

  if (rec_z > 0.5 && hrv_z >= 0.0 && rhr_z < 0.0)
    return { state: 'grn_thriving', confidence: 'high' };

  if (rec_z > 0.3 && recRising && history.length >= 2 && history[1].rec_z < -0.3)
    return { state: 'grn_bounce', confidence: 'high' };

  const consecutiveGreen = last3rec.filter(r => r >= 67).length;
  if (consecutiveGreen >= 3) return { state: 'grn_streak', confidence: 'high' };

  if (rec_z > 0.5) return { state: 'grn_thriving', confidence: 'medium' };

  return { state: null, confidence: 'low' };
}

function computeExplorationScore(today, baselines, history) {
  let score = 0;
  const { rec_z, hrv_z, strain_z, nas_z, sleep_suff, sleep_debt_7d, sleep_stress, workout_logged } = today;
  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];

  if (rec_z < -0.8 && sleep_suff >= 0.85 && strain_z < 0.3) score += 3;
  if (hrvDeclining && hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) && strain_z < 0.5) score += 2;
  if (strain_z > 1.0 && !workout_logged && nas_z > 1.0) score += 3;
  if (sleep_stress === 'poor') score += 1;
  if (sleep_debt_7d > 1.5) score += 1;
  if (nas_z > 1.5) score += 1;
  if (hrv_z < -1.5) score += 1;
  return score;
}

// ── REFRESH TOKEN IF NEEDED ────────────────────────────────────────

async function getValidToken(conn) {
  // If token is still valid (with 5 min buffer), use it
  if (conn.expires_at && new Date(conn.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token;
  }

  // Token expired — refresh it
  if (!conn.refresh_token) throw new Error('No refresh token available');

  const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: conn.refresh_token,
      client_id:     process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    })
  });

  if (!refreshRes.ok) throw new Error('Token refresh failed');

  const tokens = await refreshRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  // Update Supabase with fresh token
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${encodeURIComponent(conn.whoop_member_id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        expires_at:    expiresAt,
        updated_at:    new Date().toISOString(),
      })
    }
  );

  return tokens.access_token;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  // Verify the Supabase session from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  const sessionToken = authHeader.replace('Bearer ', '');

  try {
    // ── 1. GET USER FROM SUPABASE SESSION ─────────────────────────
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey':        process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${sessionToken}`,
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await userRes.json();
    const userId = user.id;

    // ── 2. LOOK UP WHOOP TOKEN FROM SUPABASE ──────────────────────
    const connRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?user_id=eq.${userId}&select=*&limit=1`,
      {
        headers: {
          'apikey':        process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        }
      }
    );

    const connections = await connRes.json();

    // Fallback: try by member ID if user_id lookup fails
    // (older connections may not have user_id set)
    let conn = connections?.[0];
    if (!conn) {
      return new Response(JSON.stringify({ error: 'No WHOOP connection found. Please reconnect.' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 3. GET A VALID TOKEN (refresh if expired) ─────────────────
    const access_token = await getValidToken(conn);

    // ── 4. FETCH 28 DAYS OF WHOOP DATA ───────────────────────────
    const endDate   = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr   = endDate.toISOString().split('T')[0];

    const [cyclesRes, sleepRes, workoutsRes] = await Promise.all([
      whoopGet(`/cycle?start=${startStr}&end=${endStr}&limit=30`, access_token),
      whoopGet(`/activity/sleep?start=${startStr}&end=${endStr}&limit=30`, access_token),
      whoopGet(`/activity/workout?start=${startStr}&end=${endStr}&limit=30`, access_token),
    ]);

    const cycles   = cyclesRes.records   || [];
    const sleeps   = sleepRes.records    || [];
    const workouts = workoutsRes.records || [];

    if (!cycles.length) {
      return new Response(JSON.stringify({ error: 'No WHOOP data available yet' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 5. BUILD DAILY RECORDS ────────────────────────────────────
    const workoutDates = new Set(workouts.map(w => w.start?.split('T')[0]).filter(Boolean));

    const workoutDatesSorted = [...workoutDates].sort().reverse();
    const lastWorkoutDate = workoutDatesSorted[0] || null;
    const lastWorkoutDaysAgo = lastWorkoutDate
      ? Math.round((new Date(endStr) - new Date(lastWorkoutDate)) / 86400000)
      : null;

    const daily = cycles.map(cycle => {
      const date = cycle.start?.split('T')[0];
      const score = cycle.score || {};
      const sleep = sleeps.find(s => s.start?.split('T')[0] === date);
      const sleepScore = sleep?.score || {};
      const hoursSlept = sleepScore.stage_summary?.total_in_bed_time_milli
        ? sleepScore.stage_summary.total_in_bed_time_milli / 3600000 : null;
      const sleepNeed = sleepScore.sleep_needed?.baseline_milli
        ? sleepScore.sleep_needed.baseline_milli / 3600000 : null;
      const sleepStress = sleepScore.respiratory_rate
        ? (sleepScore.respiratory_rate > 17 ? 'poor' : sleepScore.respiratory_rate > 15 ? 'sufficient' : 'optimal')
        : null;

      return {
        date,
        recovery_pct:        score.recovery_score ?? null,
        hrv_ms:              score.hrv_rmssd_milli ?? null,
        rhr_bpm:             score.resting_heart_rate ?? null,
        sleep_hours:         hoursSlept,
        sleep_need_hours:    sleepNeed,
        sleep_perf_pct:      sleepScore.sleep_performance_percentage ?? null,
        sleep_stress:        sleepStress,
        day_strain:          cycle.score?.strain ?? null,
        non_activity_stress: (!workoutDates.has(date) ? cycle.score?.strain : null) ?? null,
        workout_logged:      workoutDates.has(date),
        sleep_suff:          hoursSlept && sleepNeed ? hoursSlept / sleepNeed : null,
      };
    }).filter(d => d.date).sort((a, b) => b.date.localeCompare(a.date));

    if (!daily.length) {
      return new Response(JSON.stringify({ error: 'Could not parse WHOOP data' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 6. COMPUTE BASELINES + Z-SCORES ──────────────────────────
    const historicalDays = daily.slice(1);
    const baselines = {
      recovery_mean: mean(historicalDays.map(d => d.recovery_pct).filter(Boolean)),
      recovery_sd:   sd(historicalDays.map(d => d.recovery_pct).filter(Boolean)),
      hrv_mean:      mean(historicalDays.map(d => d.hrv_ms).filter(Boolean)),
      hrv_sd:        sd(historicalDays.map(d => d.hrv_ms).filter(Boolean)),
      rhr_mean:      mean(historicalDays.map(d => d.rhr_bpm).filter(Boolean)),
      rhr_sd:        sd(historicalDays.map(d => d.rhr_bpm).filter(Boolean)),
      strain_mean:   mean(historicalDays.map(d => d.day_strain).filter(Boolean)),
      strain_sd:     sd(historicalDays.map(d => d.day_strain).filter(Boolean)),
      nas_mean:      mean(historicalDays.map(d => d.non_activity_stress).filter(Boolean)),
      nas_sd:        sd(historicalDays.map(d => d.non_activity_stress).filter(Boolean)),
    };

    const today = daily[0];
    const sleep_debt_7d = daily.slice(0, 7).reduce((acc, d) =>
      acc + (d.sleep_need_hours && d.sleep_hours ? Math.max(0, d.sleep_need_hours - d.sleep_hours) : 0), 0);

    const todayScored = {
      ...today,
      rec_z:    zScore(today.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z:    zScore(today.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
      rhr_z:    zScore(today.rhr_bpm, baselines.rhr_mean, baselines.rhr_sd),
      strain_z: zScore(today.day_strain, baselines.strain_mean, baselines.strain_sd),
      nas_z:    zScore(today.non_activity_stress, baselines.nas_mean, baselines.nas_sd),
      sleep_debt_7d,
    };

    const history = daily.slice(1).map(d => ({
      ...d,
      rec_z: zScore(d.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z: zScore(d.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
    }));

    // ── 7. SCORE ──────────────────────────────────────────────────
    const { state, confidence } = scoreSignalState(todayScored, baselines, history);
    const exploration_score = computeExplorationScore(todayScored, baselines, history);

    // ── 8. SAVE TO daily_state ────────────────────────────────────
    fetch(`${process.env.SUPABASE_URL}/rest/v1/daily_state`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id:         userId,
        date:            today.date,
        recovery_pct:    today.recovery_pct,
        hrv_ms:          today.hrv_ms,
        rhr_bpm:         today.rhr_bpm,
        sleep_hours:     today.sleep_hours,
        sleep_need_hours:today.sleep_need_hours,
        sleep_perf_pct:  today.sleep_perf_pct,
        sleep_stress:    today.sleep_stress,
        day_strain:      today.day_strain,
        rec_z:           todayScored.rec_z,
        hrv_z:           todayScored.hrv_z,
        strain_z:        todayScored.strain_z,
        sleep_suff:      today.sleep_suff,
        sleep_debt_7d,
        exploration_score,
        signal_state:    state,
        workout_logged:  today.workout_logged,
      })
    }).catch(e => console.error('daily_state save failed:', e));

    // ── 9. RESPOND ────────────────────────────────────────────────
    return new Response(JSON.stringify({
      recovery:              today.recovery_pct,
      hrv:                   today.hrv_ms ? parseFloat(today.hrv_ms.toFixed(1)) : null,
      strain:                today.day_strain ? parseFloat(today.day_strain.toFixed(1)) : null,
      rhr:                   today.rhr_bpm,
      sleep_score:           today.sleep_perf_pct,
      sleep_stress:          today.sleep_stress,
      workout_logged:        today.workout_logged,
      last_workout_days_ago: lastWorkoutDaysAgo,
      hrv_baseline:          parseFloat(baselines.hrv_mean.toFixed(1)),
      recovery_baseline:     parseFloat(baselines.recovery_mean.toFixed(1)),
      strain_baseline:       parseFloat(baselines.strain_mean.toFixed(1)),
      rec_z:    todayScored.rec_z   ? parseFloat(todayScored.rec_z.toFixed(2))   : null,
      hrv_z:    todayScored.hrv_z   ? parseFloat(todayScored.hrv_z.toFixed(2))   : null,
      strain_z: todayScored.strain_z? parseFloat(todayScored.strain_z.toFixed(2)): null,
      sleep_debt_7d:    parseFloat(sleep_debt_7d.toFixed(1)),
      exploration_score,
      signal_state:     state,
      signal_confidence:confidence,
      days_trend:       daily.slice(0, 7).map(d => d.hrv_ms).filter(Boolean),
      recovery_trend:   daily.slice(0, 7).map(d => d.recovery_pct).filter(Boolean),
      date:             today.date,
      data_source:      'whoop_live',
      days_of_history:  historicalDays.length,
    }), {
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err) {
    console.error('whoop-data error:', err);
    return new Response(JSON.stringify({ error: err.message, data_source: 'error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
