/**
 * /api/whoop-data.js
 * Vercel Edge Function -- WHOOP Data + Scoring Engine
 * Validated against WHOOP AI and HRV research literature
 *
 * Phase 1: writes 7 days to daily_state (not 1). Arc shows per-day signal state.
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

// -- HRV VOLATILITY (COEFFICIENT OF VARIATION) --
// For day at dayIndex: compute CV over the 7 nights *before* that day
// (matches the original engine's `history.slice(0, 7)` semantics).
function computeHRVVolatility(dayIndex, daily) {
  const window = daily.slice(dayIndex + 1, dayIndex + 8);
  const hrvValues = window.map(d => d.hrv_ms).filter(Boolean);
  if (hrvValues.length < 5) {
    return { cv_pct: null, volatility_score: 0, volatile: false, volatile_high: false };
  }
  const m = mean(hrvValues);
  if (m === 0) return { cv_pct: null, volatility_score: 0, volatile: false, volatile_high: false };
  const s = sd(hrvValues);
  const cv_pct = (s / m) * 100;
  let volatility_score = 0;
  if (cv_pct > 30) volatility_score = 1.0;
  else if (cv_pct > 20) volatility_score = 0.6;
  else if (cv_pct > 10) volatility_score = 0.2;
  const volatile = cv_pct > 20;
  const volatile_high = cv_pct > 30 && hrvValues.length >= 5;
  return {
    cv_pct: parseFloat(cv_pct.toFixed(1)),
    volatility_score: parseFloat(volatility_score.toFixed(2)),
    volatile,
    volatile_high
  };
}

// -- COMPOSITE LOAD --
// For day at dayIndex: look at the 6 days *before* it for sleep consistency,
// and the 2 days *before* it for RR elevation (with a 12-day RR baseline
// starting 2 days before the target).
function computeCompositeLoad(dayIndex, daily, todayScored) {
  const { hrv_z, rec_z, rr_bpm } = todayScored;

  let hrv_score = 0;
  if (hrv_z !== null) {
    if (hrv_z < -1.0) hrv_score = 1.0;
    else if (hrv_z < -0.5) hrv_score = 0.6;
    else if (hrv_z < 0) hrv_score = 0.3;
  }

  let rec_score = 0;
  if (rec_z !== null) {
    if (rec_z < -1.0) rec_score = 1.0;
    else if (rec_z < -0.5) rec_score = 0.6;
    else if (rec_z < 0) rec_score = 0.3;
  }

  // Sleep consistency: 6 days before the target day
  const onsetHours = daily.slice(dayIndex + 1, dayIndex + 7)
    .map(d => d.sleep_onset_hour)
    .filter(h => h !== null && h !== undefined);
  let consistency_score = 0;
  let sleep_consistency_sd_mins = null;
  if (onsetHours.length >= 3) {
    const m = onsetHours.reduce((a, b) => a + b, 0) / onsetHours.length;
    const variance = onsetHours.reduce((a, b) => a + Math.pow(b - m, 2), 0) / onsetHours.length;
    const sd_hours = Math.sqrt(variance);
    const sd_minutes = sd_hours * 60;
    sleep_consistency_sd_mins = parseFloat(sd_minutes.toFixed(1));
    if (sd_minutes > 90) consistency_score = 1.0;
    else if (sd_minutes > 60) consistency_score = 0.7;
    else if (sd_minutes > 45) consistency_score = 0.4;
  }

  // Respiratory rate: 2 days before target for elevation check,
  // days 2-13 before target as the RR baseline.
  let rr_score = 0;
  const last2rr = daily.slice(dayIndex + 1, dayIndex + 3).map(d => d.rr_bpm).filter(Boolean);
  const rr_baseline = daily.slice(dayIndex + 3, dayIndex + 15).map(d => d.rr_bpm).filter(Boolean);
  if (rr_bpm && rr_baseline.length >= 3) {
    const rr_mean = rr_baseline.reduce((a, b) => a + b, 0) / rr_baseline.length;
    const rr_elevation = rr_bpm - rr_mean;
    const prev_elevated = last2rr.length >= 1 && last2rr.every(r => r > rr_mean + 0.8);
    if (rr_elevation > 1.5 && prev_elevated) rr_score = 1.0;
    else if (rr_elevation > 1.0 && prev_elevated) rr_score = 0.7;
    else if (rr_elevation > 1.0) rr_score = 0.4;
  }

  const composite = (hrv_score * 0.40) + (rec_score * 0.25) +
                    (consistency_score * 0.20) + (rr_score * 0.15);
  const impaired_count = [hrv_score, rec_score, consistency_score, rr_score]
    .filter(s => s >= 0.5).length;

  return {
    composite,
    impaired_count,
    hrv_score,
    rec_score,
    consistency_score,
    rr_score,
    sleep_consistency_sd_mins
  };
}

// -- STATE ESCALATION --
// Uses the 5 days *before* the target day to check chronic sleep-consistency.
function applyStateEscalation(dayIndex, daily, state, confidence, compositeLoad, todayScored) {
  const { impaired_count, consistency_score } = compositeLoad;
  const { hrv_z } = todayScored;

  if (state && state.startsWith('red_')) return { state, confidence };

  if (impaired_count >= 2) {
    if (state && state.startsWith('amb_')) {
      return { state: 'red_psych', confidence: 'medium' };
    }
    if (!state || state === null) {
      return { state: 'amb_load', confidence: 'medium' };
    }
  }

  if (consistency_score >= 0.7) {
    const chronicDays = daily.slice(dayIndex + 1, dayIndex + 6)
      .filter(d => {
        if (!d.sleep_onset_hour) return false;
        return true;
      }).length;
    const borderlineSignal = hrv_z !== null && hrv_z < -0.2;
    if (chronicDays >= 5 && borderlineSignal && state && state.startsWith('grn_')) {
      return { state: 'amb_load', confidence: 'low' };
    }
  }

  return { state, confidence };
}

// -- SIGNAL STATE --
// Scores any day given its index in the newest-first `daily` array.
// `history` = the days strictly *before* the target day.
function scoreSignalState(dayIndex, daily, todayScored, baselines, hrvVolatility) {
  const history = daily.slice(dayIndex + 1);
  const {
    rec_z, hrv_z, rhr_z, strain_z, nas_z,
    sleep_suff, sleep_debt_7d, sleep_stress,
    workout_logged, recovery_pct, hrv_ms
  } = todayScored;

  // last3hrv = the 3 days *before* the target (not including target)
  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];

  const last3rec = history.slice(0, 3).map(d => d.recovery_pct).filter(Boolean);
  const recRising = last3rec.length >= 2 && last3rec[0] > last3rec[last3rec.length - 1];

  const hrvAtOrAboveBaseline = hrv_z !== null && hrv_z >= 0;
  const recoveryIsGreen = recovery_pct !== null && recovery_pct >= 67;
  const strainIsLowMod = strain_z === null || strain_z < 1.0;
  const physiologicallyWell = recoveryIsGreen && hrvAtOrAboveBaseline && strainIsLowMod;

  if (
    rec_z !== null && rec_z < -0.8 &&
    sleep_suff !== null && sleep_suff >= 0.85 &&
    strain_z !== null && strain_z < 0.3 &&
    (sleep_stress === 'poor' || (hrv_z !== null && hrv_z < -0.5))
  ) {
    return { state: 'red_psych', confidence: 'high' };
  }

  if (
    hrvDeclining &&
    hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) &&
    strain_z !== null && strain_z < 0.5
  ) {
    if (physiologicallyWell) {
      // falls through to green
    } else {
      const hasEnoughHistory = history.length >= 7;
      const recoveryIsLow = recovery_pct !== null && recovery_pct < 67;
      if (hasEnoughHistory && recoveryIsLow) {
        return { state: 'red_trend', confidence: 'high' };
      }
      return { state: 'amb_trend', confidence: 'medium' };
    }
  }

  if (
    strain_z !== null && strain_z > 1.0 &&
    !workout_logged &&
    (nas_z !== null && nas_z > 1.0)
  ) {
    return { state: 'red_strain', confidence: 'high' };
  }

  if (rec_z !== null && rec_z < -0.8 && sleep_suff >= 0.85) {
    return { state: 'red_psych', confidence: 'medium' };
  }

  if (hrvDeclining && strain_z < 0.5 && !physiologicallyWell) {
    const hasEnoughHistory = history.length >= 7;
    const recoveryIsLow = recovery_pct !== null && recovery_pct < 67;
    if (hasEnoughHistory && recoveryIsLow) {
      return { state: 'red_trend', confidence: 'medium' };
    }
    return { state: 'amb_trend', confidence: 'low' };
  }

  if (
    rec_z !== null && rec_z > 0.5 &&
    hrv_z !== null && hrv_z >= 0.0 &&
    rhr_z !== null && rhr_z < 0.0
  ) {
    return { state: 'grn_thriving', confidence: 'high' };
  }

  if (
    rec_z !== null && rec_z > 0.3 &&
    recRising &&
    daily.length > dayIndex + 2 &&
    daily[dayIndex + 2] && daily[dayIndex + 2].recovery_pct != null &&
    zScore(daily[dayIndex + 2].recovery_pct, baselines.recovery_mean, baselines.recovery_sd) < -0.3
  ) {
    return { state: 'grn_bounce', confidence: 'high' };
  }

  const consecutiveGreen = last3rec.filter(r => r >= 67).length;
  if (consecutiveGreen >= 3) {
    return { state: 'grn_streak', confidence: 'high' };
  }

  if (physiologicallyWell) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }

  if (rec_z !== null && rec_z > 0.5) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }

  if (hrvVolatility && hrvVolatility.volatile_high) {
    return { state: 'amb_volatile', confidence: 'medium' };
  }

  return { state: null, confidence: 'low' };
}

function computeExplorationScore(dayIndex, daily, todayScored, baselines) {
  const history = daily.slice(dayIndex + 1);
  let score = 0;
  const { rec_z, hrv_z, strain_z, nas_z, sleep_suff, sleep_debt_7d, sleep_stress, workout_logged } = todayScored;
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

// -- scoreDay: score any day at `dayIndex` in `daily` (newest-first) --
// Returns everything needed to build a daily_state row + arc_series entry.
function scoreDay(dayIndex, daily, baselines) {
  const day = daily[dayIndex];
  if (!day) return null;

  // For today (dayIndex 0), today's cycle may still be open (mid-day).
  // Use yesterday's completed strain for scoring. Past days are already complete.
  const scoringStrain = dayIndex === 0
    ? (daily[1]?.day_strain ?? day.day_strain ?? null)
    : (day.day_strain ?? null);

  // Per-day 7-day sleep debt looking back from this day
  const window7 = daily.slice(dayIndex, dayIndex + 7);
  const sleep_debt_7d = window7.reduce((acc, d) => {
    if (d.sleep_need_hours && d.sleep_hours) return acc + Math.max(0, d.sleep_need_hours - d.sleep_hours);
    return acc;
  }, 0);

  const scored = {
    ...day,
    day_strain: scoringStrain,
    rec_z:    zScore(day.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
    hrv_z:    zScore(day.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
    rhr_z:    zScore(day.rhr_bpm, baselines.rhr_mean, baselines.rhr_sd),
    strain_z: zScore(scoringStrain, baselines.strain_mean, baselines.strain_sd),
    nas_z: null,
    sleep_debt_7d,
  };

  const hrvVolatility = computeHRVVolatility(dayIndex, daily);
  const { state: baseState, confidence: baseConfidence } =
    scoreSignalState(dayIndex, daily, scored, baselines, hrvVolatility);
  const compositeLoad = computeCompositeLoad(dayIndex, daily, scored);
  const { state, confidence } =
    applyStateEscalation(dayIndex, daily, baseState, baseConfidence, compositeLoad, scored);
  const exploration_score = computeExplorationScore(dayIndex, daily, scored, baselines);

  const isGreen = state && state.startsWith('grn_');
  const hrv_volatility_flag = isGreen && hrvVolatility.volatile && !hrvVolatility.volatile_high;

  return {
    scored,
    state,
    confidence,
    compositeLoad,
    hrvVolatility,
    hrv_volatility_flag,
    exploration_score,
    sleep_debt_7d,
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  let { access_token, mid } = body;

  let userId = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    try {
      const jwt = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub || null;
    } catch (_) {}
  }

  if (!access_token && process.env.SUPABASE_URL) {
    const lookup = userId
      ? `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?user_id=eq.${userId}&select=access_token,refresh_token,expires_at,whoop_member_id&limit=1`
      : mid
      ? `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}&select=access_token,refresh_token,expires_at,whoop_member_id&limit=1`
      : null;

    if (!lookup) {
      return new Response(JSON.stringify({ error: 'No WHOOP connection found -- please connect your WHOOP', data_source: 'error' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const connRes = await fetch(lookup, {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_KEY
        }
      });
      const rows = await connRes.json();
      if (rows.length) {
        mid = rows[0].whoop_member_id || mid;
        access_token = rows[0].access_token;

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
            const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
                apikey: process.env.SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token,
                expires_at: expiresAt
              })
            });
          }
        }
      }
    } catch (e) {
      console.error('Supabase lookup error:', e.message);
    }
  }

  if (!access_token) {
    return new Response(JSON.stringify({ error: 'Missing access_token -- please reconnect WHOOP', data_source: 'error' }), {
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

    // -- TODAY'S OPEN CYCLE (for still-climbing strain) --
    const openCycle = cycles.find(c => !c.end) || null;
    const today_strain_so_far = openCycle?.score?.strain ?? null;

    const workoutDates = new Set(workouts.map(w => w.start?.split('T')[0]).filter(Boolean));

    const daily = recoveries.map(rec => {
      const recScore = rec.score || {};
      const date = rec.created_at?.split('T')[0];
      const cycle = cycleById[rec.cycle_id] || {};
      const cycleScore = cycle.score || {};
      const sleep = sleeps.find(s => s.cycle_id === rec.cycle_id && !s.nap) || sleeps.find(s => s.cycle_id === rec.cycle_id);
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
        recovery_pct: recScore.recovery_score ?? null,
        hrv_ms: recScore.hrv_rmssd_milli ?? null,
        rhr_bpm: recScore.resting_heart_rate ?? null,
        day_strain: cycleScore.strain ?? null,
        sleep_hours: hoursSlept,
        sleep_need_hours: sleepNeed,
        sleep_perf_pct: sleepScore.sleep_performance_percentage ?? null,
        sleep_stress: sleepStress,
        rr_bpm: sleepScore.respiratory_rate ?? null,
        sleep_onset_hour: (() => {
          const startTime = sleep?.start;
          if (!startTime) return null;
          const d = new Date(startTime);
          return d.getHours() + d.getMinutes() / 60;
        })(),
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

    const sortedWorkoutDates = [...workoutDates].sort().reverse();
    const lastWorkoutDate = sortedWorkoutDates[0] || null;
    const todayStr = new Date().toISOString().split('T')[0];
    const lastWorkoutDaysAgo = lastWorkoutDate
      ? Math.round((new Date(todayStr) - new Date(lastWorkoutDate)) / 86400000)
      : null;

    // Baselines computed over everything except today (historicalDays).
    // Applied as the *same* baseline for every arc day (Phase 1 decision:
    // current-window baselines. Phase 2 cron will use rolling per-day baselines.)
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
      nas_mean: 0,
      nas_sd: 1,
    };

    // Score today (dayIndex 0) and the 6 preceding days for the arc + daily_state.
    const arcDaysToScore = Math.min(7, daily.length);
    const scoredDays = [];
    for (let i = 0; i < arcDaysToScore; i++) {
      const result = scoreDay(i, daily, baselines);
      if (result) scoredDays.push({ dayIndex: i, ...result });
    }

    // Today is dayIndex 0. Response fields that used to come from `todayScored`:
    const todayResult = scoredDays[0];
    const today = daily[0];
    const yesterday = daily[1] || null;
    const scoringStrain = yesterday?.day_strain ?? today.day_strain ?? null;
    const todayScored = todayResult.scored;
    const state = todayResult.state;
    const confidence = todayResult.confidence;
    const compositeLoad = todayResult.compositeLoad;
    const hrvVolatility = todayResult.hrvVolatility;
    const hrv_volatility_flag = todayResult.hrv_volatility_flag;
    const exploration_score = todayResult.exploration_score;
    const sleep_debt_7d = todayResult.sleep_debt_7d;

    // -- WRITE TO daily_state (batch of up to 7 rows) --
    // Await the write. Fire-and-forget is unreliable in Edge runtime -- the
    // function terminates when the response is returned, which can cancel
    // pending fetches. See https://vercel.com/docs/.../waitUntil
    if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const dailyStateRows = scoredDays.map(({ dayIndex, scored, state, confidence, compositeLoad, hrvVolatility, exploration_score, sleep_debt_7d }) => {
        const d = daily[dayIndex];
        return {
          user_id:           userId,
          date:              d.date,
          recovery_pct:      d.recovery_pct   !== null ? Math.round(d.recovery_pct)   : null,
          hrv_ms:            d.hrv_ms          !== null ? parseFloat(d.hrv_ms.toFixed(1)) : null,
          rhr_bpm:           d.rhr_bpm          !== null ? Math.round(d.rhr_bpm)          : null,
          day_strain:        d.day_strain       !== null ? parseFloat(d.day_strain.toFixed(1)) : null,
          sleep_perf_pct:    d.sleep_perf_pct   !== null ? Math.round(d.sleep_perf_pct)  : null,
          sleep_hours:       d.sleep_hours      !== null ? parseFloat(d.sleep_hours.toFixed(2)) : null,
          respiratory_rate:  d.rr_bpm           !== null ? parseFloat((d.rr_bpm).toFixed(2)) : null,
          workout_logged:    d.workout_logged   || false,
          sleep_suff:        d.sleep_suff       !== null ? parseFloat(d.sleep_suff.toFixed(3)) : null,
          signal_state:      state || null,
          signal_confidence: confidence || null,
          rec_z:             scored.rec_z      !== null ? parseFloat(scored.rec_z.toFixed(3))  : null,
          hrv_z:             scored.hrv_z      !== null ? parseFloat(scored.hrv_z.toFixed(3))  : null,
          strain_z:          scored.strain_z   !== null ? parseFloat(scored.strain_z.toFixed(3)) : null,
          composite_load:    parseFloat(compositeLoad.composite.toFixed(3)),
          impaired_signals:  compositeLoad.impaired_count,
          hrv_cv:            hrvVolatility.cv_pct,
          exploration_score: exploration_score,
          sleep_debt_7d:     parseFloat(sleep_debt_7d.toFixed(2)),
          days_of_history:   daily.length - 1 - dayIndex,
        };
      });

      try {
        const writeRes = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/daily_state`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              apikey: process.env.SUPABASE_SERVICE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(dailyStateRows)
          }
        );
        if (!writeRes.ok) {
          const txt = await writeRes.text().catch(() => '');
          console.error('daily_state write failed:', writeRes.status, txt);
        } else {
          console.log('daily_state wrote', dailyStateRows.length, 'rows for user', userId);
        }
      } catch (e) {
        console.error('daily_state write error:', e.message);
      }
    }

    // Build arc_series with per-day signal state
    // scoredDays is newest-first (index 0 = today). Reverse for oldest-first display.
    const arc_series = scoredDays.slice().reverse().map(({ dayIndex, state, confidence }) => {
      const d = daily[dayIndex];
      return {
        date:              d.date,
        recovery_pct:      d.recovery_pct,
        hrv_ms:            d.hrv_ms,
        day_strain:        d.day_strain,
        signal_state:      state || null,
        signal_confidence: confidence || null,
      };
    });

    const response = {
      recovery:          today.recovery_pct,
      hrv:               today.hrv_ms ? parseFloat(today.hrv_ms.toFixed(1)) : null,
      strain:            scoringStrain !== null ? parseFloat(scoringStrain.toFixed(1)) : null,
      yesterday_strain:     yesterday?.day_strain !== null && yesterday?.day_strain !== undefined ? parseFloat(yesterday.day_strain.toFixed(1)) : null,
      today_strain_so_far:  today_strain_so_far !== null ? parseFloat(today_strain_so_far.toFixed(1)) : null,
      sleep_hours:       today.sleep_hours ? parseFloat(today.sleep_hours.toFixed(1)) : null,
      rhr:               today.rhr_bpm,
      sleep_score:       today.sleep_perf_pct,
      sleep_need:        today.sleep_need_hours ? parseFloat(today.sleep_need_hours.toFixed(1)) : null,
      sleep_stress:      today.sleep_stress,
      workout_logged:    today.workout_logged,
      last_workout_days_ago: lastWorkoutDaysAgo,
      hrv_baseline:      parseFloat(baselines.hrv_mean.toFixed(1)),
      recovery_baseline: parseFloat(baselines.recovery_mean.toFixed(1)),
      strain_baseline:   parseFloat(baselines.strain_mean.toFixed(1)),
      rec_z:             todayScored.rec_z ? parseFloat(todayScored.rec_z.toFixed(2)) : null,
      hrv_z:             todayScored.hrv_z ? parseFloat(todayScored.hrv_z.toFixed(2)) : null,
      strain_z:          todayScored.strain_z ? parseFloat(todayScored.strain_z.toFixed(2)) : null,
      sleep_debt_7d:     parseFloat(sleep_debt_7d.toFixed(1)),
      exploration_score,
      signal_state:      state,
      signal_confidence: confidence,
      days_trend:        daily.slice(0, 7).map(d => d.hrv_ms).filter(Boolean),
      recovery_trend:    daily.slice(0, 7).map(d => d.recovery_pct).filter(Boolean),
      arc_series,
      date:              today.date,
      data_source:       'whoop_live',
      days_of_history:   historicalDays.length,
      composite_load:    parseFloat(compositeLoad.composite.toFixed(2)),
      impaired_signals:  compositeLoad.impaired_count,
      sleep_consistency_sd_mins: compositeLoad.sleep_consistency_sd_mins,
      rr_score:          parseFloat(compositeLoad.rr_score.toFixed(2)),
      hrv_cv:            hrvVolatility.cv_pct,
      hrv_volatility_score: hrvVolatility.volatility_score,
      hrv_volatility_flag,
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
