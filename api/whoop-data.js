/**
 * /api/whoop-data.js
 * Vercel Edge Function — WHOOP Data + Scoring Engine
 * Restored to working version (commit 247cca7)
 */
export const config = { runtime: 'edge' };

const WHOOP_BASE = 'https://api.prod.whoop.com/developer/v2';

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
  const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
  return Math.max(Math.sqrt(variance), 0.1);
}

function zScore(value, baseline_mean, baseline_sd) {
  if (value === null || value === undefined) return null;
  return (value - baseline_mean) / baseline_sd;
}

function scoreSignalState(today, baselines, history) {
  const { rec_z, hrv_z, rhr_z, strain_z, nas_z, sleep_suff, sleep_debt_7d, sleep_stress, workout_logged, recovery_pct, hrv_ms, strain } = today;
  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];
  const last3rec = history.slice(0, 3).map(d => d.recovery_pct).filter(Boolean);
  const recRising = last3rec.length >= 2 && last3rec[0] > last3rec[last3rec.length - 1];

  if (rec_z !== null && rec_z < -0.8 && sleep_suff !== null && sleep_suff >= 0.85 && strain_z !== null && strain_z < 0.3 && (sleep_stress === 'poor' || (hrv_z !== null && hrv_z < -0.5))) {
    return { state: 'red_psych', confidence: 'high' };
  }
  if (hrvDeclining && hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) && strain_z !== null && strain_z < 0.5) {
    return { state: 'red_trend', confidence: 'high' };
  }
  if (strain_z !== null && strain_z > 1.0 && !workout_logged && (nas_z !== null && nas_z > 1.0)) {
    return { state: 'red_strain', confidence: 'high' };
  }
  if (rec_z !== null && rec_z < -0.8 && sleep_suff >= 0.85) {
    return { state: 'red_psych', confidence: 'medium' };
  }
  if (hrvDeclining && strain_z < 0.5) {
    return { state: 'red_trend', confidence: 'medium' };
  }
  if (rec_z !== null && rec_z > 0.5 && hrv_z !== null && hrv_z >= 0.0 && rhr_z !== null && rhr_z < 0.0) {
    return { state: 'grn_thriving', confidence: 'high' };
  }
  if (rec_z !== null && rec_z > 0.3 && recRising && history.length >= 2 && history[1].rec_z < -0.3) {
    return { state: 'grn_bounce', confidence: 'high' };
  }
  const consecutiveGreen = last3rec.filter(r => r >= 67).length;
  if (consecutiveGreen >= 3) {
    return { state: 'grn_streak', confidence: 'high' };
  }
  if (rec_z !== null && rec_z > 0.5) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }
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
  if (nas_z !== null && nas_z > 1.5) score += 1;
  if (hrv_z !== null && hrv_z < -1.5) score += 1;
  return score;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Accept access_token directly OR look up from Supabase using mid
  let { access_token, mid } = body;

  // If no access_token but we have mid, fetch from Supabase
  if (!access_token && mid && process.env.SUPABASE_URL) {
    try {
      const connRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}&select=access_token,refresh_token,expires_at&limit=1`,
        { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, apikey: process.env.SUPABASE_SERVICE_KEY } }
      );
      const rows = await connRes.json();
      if (rows.length) {
        access_token = rows[0].access_token;
        // Refresh if expired
        if (new Date(rows[0].expires_at) <= new Date()) {
          const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: rows[0].refresh_token,
              client_id: process.env.WHOOP_CLIENT_ID,
              client_secret: process.env.WHOOP_CLIENT_SECRET
            })
          });
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) {
            access_token = refreshed.access_token;
            // Update Supabase
            const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, apikey: process.env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: expiresAt })
            });
          }
        }
      }
    } catch (e) { console.error('Supabase lookup error:', e.message); }
  }

  if (!access_token) {
    return new Response(JSON.stringify({ error: 'Missing access_token — please reconnect WHOOP', data_source: 'error' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    const startStr = startDate.toISOString();
    const endStr = new Date().toISOString();

    const [recoveryRes, cyclesRes, sleepRes, workoutsRes] = await Promise.all([
      whoopGet(`/recovery?start=${startStr}&end=${endStr}&limit=25`, access_token),
      whoopGet(`/cycle?start=${startStr}&end=${endStr}&limit=25`, access_token),
      whoopGet(`/activity/sleep?start=${startStr}&end=${endStr}&limit=25`, access_token),
      whoopGet(`/activity/workout?start=${startStr}&end=${endStr}&limit=25`, access_token),
    ]);

    const recoveries = recoveryRes.records || [];
    const cycles = cyclesRes.records || [];
    const sleeps = sleepRes.records || [];
    const workouts = workoutsRes.records || [];

    if (!recoveries.length) {
      return new Response(JSON.stringify({ error: 'No WHOOP recovery data available yet', data_source: 'error' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    const cycleById = {};
    cycles.forEach(c => { cycleById[c.id] = c; });
    const workoutDates = new Set(workouts.map(w => w.start?.split('T')[0]).filter(Boolean));

    const daily = recoveries.map(rec => {
      const recScore = rec.score || {};
      const date = rec.created_at?.split('T')[0];
      const cycle = cycleById[rec.cycle_id] || {};
      const cycleScore = cycle.score || {};
      const sleep = sleeps.find(s => s.cycle_id === rec.cycle_id && !s.nap) || sleeps.find(s => s.cycle_id === rec.cycle_id);
      const sleepScore = sleep?.score || {};
      const hoursSlept = sleepScore.stage_summary?.total_in_bed_time_milli ? sleepScore.stage_summary.total_in_bed_time_milli / 3600000 : null;
      const sleepNeed = sleepScore.sleep_needed?.baseline_milli ? sleepScore.sleep_needed.baseline_milli / 3600000 : null;
      const sleepStress = sleepScore.respiratory_rate ? (sleepScore.respiratory_rate > 17 ? 'poor' : sleepScore.respiratory_rate > 15 ? 'sufficient' : 'optimal') : null;
      return {
        date,
        recovery_pct: recScore.recovery_score ?? null,
        hrv_ms: recScore.hrv_rmssd_milli ?? null,
        rhr_bpm: recScore.resting_heart_rate ?? null,
        day_strain: cycleScore.strain ?? null,
        sleep_hours: hoursSlept,
        sleep_need_hours: sleepNeed,
        sleep_perf_pct: sleepScore.sleep_performance_percentage ?? null,
        sleep_stress: sleepStress,
        workout_logged: workoutDates.has(date),
        sleep_suff: hoursSlept && sleepNeed ? hoursSlept / sleepNeed : null,
        last_workout_days_ago: null,
      };
    }).filter(d => d.date && d.recovery_pct !== null)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!daily.length) {
      return new Response(JSON.stringify({ error: 'Could not parse WHOOP data', data_source: 'error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Last workout days ago
    const sortedWorkoutDates = [...workoutDates].sort().reverse();
    const lastWorkoutDate = sortedWorkoutDates[0] || null;
    const todayStr = new Date().toISOString().split('T')[0];
    const lastWorkoutDaysAgo = lastWorkoutDate ? Math.round((new Date(todayStr) - new Date(lastWorkoutDate)) / 86400000) : null;

    const historicalDays = daily.slice(1);
    const baselines = {
      recovery_mean: mean(historicalDays.map(d => d.recovery_pct).filter(Boolean)),
      recovery_sd: sd(historicalDays.map(d => d.recovery_pct).filter(Boolean)),
      hrv_mean: mean(historicalDays.map(d => d.hrv_ms).filter(Boolean)),
      hrv_sd: sd(historicalDays.map(d => d.hrv_ms).filter(Boolean)),
      rhr_mean: mean(historicalDays.map(d => d.rhr_bpm).filter(Boolean)),
      rhr_sd: sd(historicalDays.map(d => d.rhr_bpm).filter(Boolean)),
      strain_mean: mean(historicalDays.map(d => d.day_strain).filter(Boolean)),
      strain_sd: sd(historicalDays.map(d => d.day_strain).filter(Boolean)),
      nas_mean: 0, nas_sd: 1,
    };

    const today = daily[0];
    const sleep_debt_7d = daily.slice(0, 7).reduce((acc, d) => {
      if (d.sleep_need_hours && d.sleep_hours) return acc + Math.max(0, d.sleep_need_hours - d.sleep_hours);
      return acc;
    }, 0);

    const todayScored = {
      ...today,
      rec_z: zScore(today.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z: zScore(today.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
      rhr_z: zScore(today.rhr_bpm, baselines.rhr_mean, baselines.rhr_sd),
      strain_z: zScore(today.day_strain, baselines.strain_mean, baselines.strain_sd),
      nas_z: null,
      sleep_debt_7d,
    };

    const history = daily.slice(1).map(d => ({
      ...d,
      rec_z: zScore(d.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z: zScore(d.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
    }));

    const { state, confidence } = scoreSignalState(todayScored, baselines, history);
    const exploration_score = computeExplorationScore(todayScored, baselines, history);

    const response = {
      recovery: today.recovery_pct,
      hrv: today.hrv_ms ? parseFloat(today.hrv_ms.toFixed(1)) : null,
      strain: today.day_strain ? parseFloat(today.day_strain.toFixed(1)) : null,
      rhr: today.rhr_bpm,
      sleep_score: today.sleep_perf_pct,
      sleep_hours: today.sleep_hours ? parseFloat(today.sleep_hours.toFixed(1)) : null,
      sleep_need: today.sleep_need_hours ? parseFloat(today.sleep_need_hours.toFixed(1)) : null,
      sleep_stress: today.sleep_stress,
      workout_logged: today.workout_logged,
      last_workout_days_ago: lastWorkoutDaysAgo,
      hrv_baseline: parseFloat(baselines.hrv_mean.toFixed(1)),
      recovery_baseline: parseFloat(baselines.recovery_mean.toFixed(1)),
      strain_baseline: parseFloat(baselines.strain_mean.toFixed(1)),
      rec_z: todayScored.rec_z ? parseFloat(todayScored.rec_z.toFixed(2)) : null,
      hrv_z: todayScored.hrv_z ? parseFloat(todayScored.hrv_z.toFixed(2)) : null,
      strain_z: todayScored.strain_z ? parseFloat(todayScored.strain_z.toFixed(2)) : null,
      sleep_debt_7d: parseFloat(sleep_debt_7d.toFixed(1)),
      exploration_score,
      signal_state: state,
      signal_confidence: confidence,
      days_trend: daily.slice(0, 7).map(d => d.hrv_ms).filter(Boolean),
      recovery_trend: daily.slice(0, 7).map(d => d.recovery_pct).filter(Boolean),
      date: today.date,
      data_source: 'whoop_live',
      days_of_history: historicalDays.length,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    console.error('whoop-data error:', err);
    return new Response(JSON.stringify({ error: err.message, data_source: 'error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
