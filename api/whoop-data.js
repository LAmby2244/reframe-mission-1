/**
 * /api/whoop-data.js
 * Vercel Edge Function -- WHOOP Data + Scoring Engine
 * Validated against WHOOP AI and HRV research literature
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

// -- HRV VOLATILITY (COEFFICIENT OF VARIATION) --
// Measures night-to-night instability in HRV, independent of absolute level or trend.
// CV = SD / mean x 100. Normalises instability relative to the person's own baseline.
// Requires minimum 5 days of HRV data to fire.
//
// Thresholds (per HRV literature):
//   CV < 10%  = very stable (no flag)
//   CV 10-20% = normal variation (no flag)
//   CV 20-30% = moderate instability -> hrv_volatility_flag: true (green preserved)
//   CV > 30%, 5+ days sustained -> amb_volatile state
//
// Per WHOOP AI validation: volatility alone cannot trigger red -- needs a second signal.
function computeHRVVolatility(history) {
  const hrvValues = history.slice(0, 7).map(d => d.hrv_ms).filter(Boolean);

  if (hrvValues.length < 5) {
    return { cv_pct: null, volatility_score: 0, volatile: false, volatile_high: false };
  }

  const m = mean(hrvValues);
  if (m === 0) return { cv_pct: null, volatility_score: 0, volatile: false, volatile_high: false };

  const s = sd(hrvValues);
  const cv_pct = (s / m) * 100;

  // Score on 0-1 scale for composite use
  let volatility_score = 0;
  if (cv_pct > 30) volatility_score = 1.0;
  else if (cv_pct > 20) volatility_score = 0.6;
  else if (cv_pct > 10) volatility_score = 0.2;

  // moderate: flag only (green preserved)
  const volatile = cv_pct > 20;

  // high + sustained over 5+ days of data: can trigger amb_volatile
  const volatile_high = cv_pct > 30 && hrvValues.length >= 5;

  return {
    cv_pct: parseFloat(cv_pct.toFixed(1)),
    volatility_score: parseFloat(volatility_score.toFixed(2)),
    volatile,
    volatile_high
  };
}

function zScore(value, baseline_mean, baseline_sd) {
  if (value === null || value === undefined) return null;
  return (value - baseline_mean) / baseline_sd;
}


// -- COMPOSITE LOAD INDEX --
// Weights: HRV 40% / Recovery 25% / Sleep consistency 20% / RR 15%
// Per WHOOP AI validation, April 2026
function computeCompositeLoad(todayScored, baselines, history) {
  const { hrv_z, rec_z, rr_bpm, recovery_pct } = todayScored;

  // HRV component (40%) -- z-score below baseline = load
  let hrv_score = 0;
  if (hrv_z !== null) {
    if (hrv_z < -1.0) hrv_score = 1.0;
    else if (hrv_z < -0.5) hrv_score = 0.6;
    else if (hrv_z < 0) hrv_score = 0.3;
  }

  // Recovery component (25%) -- below 67% = load
  let rec_score = 0;
  if (rec_z !== null) {
    if (rec_z < -1.0) rec_score = 1.0;
    else if (rec_z < -0.5) rec_score = 0.6;
    else if (rec_z < 0) rec_score = 0.3;
  }

  // Sleep consistency component (20%)
  // >60 min SD in sleep onset over 3+ days = meaningful signal
  const onsetHours = history.slice(0, 6)
    .map(d => d.sleep_onset_hour)
    .filter(h => h !== null && h !== undefined);
  let consistency_score = 0;
  if (onsetHours.length >= 3) {
    const m = onsetHours.reduce((a, b) => a + b, 0) / onsetHours.length;
    const variance = onsetHours.reduce((a, b) => a + Math.pow(b - m, 2), 0) / onsetHours.length;
    const sd_hours = Math.sqrt(variance);
    const sd_minutes = sd_hours * 60;
    if (sd_minutes > 90) consistency_score = 1.0;
    else if (sd_minutes > 60) consistency_score = 0.7;
    else if (sd_minutes > 45) consistency_score = 0.4;
  }

  // RR component (15%)
  // >1.0 breaths/min above baseline sustained 2+ nights = meaningful
  let rr_score = 0;
  const last2rr = history.slice(0, 2).map(d => d.rr_bpm).filter(Boolean);
  const rr_baseline = history.slice(2, 14).map(d => d.rr_bpm).filter(Boolean);
  if (rr_bpm && rr_baseline.length >= 3) {
    const rr_mean = rr_baseline.reduce((a, b) => a + b, 0) / rr_baseline.length;
    const rr_elevation = rr_bpm - rr_mean;
    const prev_elevated = last2rr.length >= 1 && last2rr.every(r => r > rr_mean + 0.8);
    if (rr_elevation > 1.5 && prev_elevated) rr_score = 1.0;
    else if (rr_elevation > 1.0 && prev_elevated) rr_score = 0.7;
    else if (rr_elevation > 1.0) rr_score = 0.4;
  }

  // Weighted composite (0-1 scale)
  const composite = (hrv_score * 0.40) + (rec_score * 0.25) +
                    (consistency_score * 0.20) + (rr_score * 0.15);

  // Count how many signals are impaired (>=0.5 threshold per signal)
  const impaired_count = [hrv_score, rec_score, consistency_score, rr_score]
    .filter(s => s >= 0.5).length;

  return {
    composite,
    impaired_count,
    hrv_score,
    rec_score,
    consistency_score,
    rr_score,
    sleep_consistency_sd_mins: (() => {
      if (onsetHours.length < 3) return null;
      const m = onsetHours.reduce((a, b) => a + b, 0) / onsetHours.length;
      const variance = onsetHours.reduce((a, b) => a + Math.pow(b - m, 2), 0) / onsetHours.length;
      return parseFloat((Math.sqrt(variance) * 60).toFixed(1));
    })()
  };
}

// -- STATE ESCALATION --
// Per WHOOP AI: 2+ signals impaired -> escalate one level
// Sleep consistency alone does NOT override green guardrail
// Exception: chronic poor consistency (5+ days) + borderline signal -> allow amber
function applyStateEscalation(state, confidence, compositeLoad, todayScored, history) {
  const { impaired_count, consistency_score, composite } = compositeLoad;
  const { recovery_pct, hrv_z } = todayScored;

  // If already red, no escalation needed
  if (state && state.startsWith('red_')) return { state, confidence };

  // 2+ signals impaired -> escalate amber to red, null to amber
  if (impaired_count >= 2) {
    if (state && state.startsWith('amb_')) {
      // Amber -> red_psych (most likely psychological load pattern)
      return { state: 'red_psych', confidence: 'medium' };
    }
    if (!state || state === null) {
      return { state: 'amb_load', confidence: 'medium' };
    }
  }

  // Sleep consistency exception: chronic poor consistency (5+ days) + borderline
  // CAN push through green guardrail to amber_preload
  if (consistency_score >= 0.7) {
    const chronicDays = history.slice(0, 5)
      .filter(d => {
        if (!d.sleep_onset_hour) return false;
        return true; // if we have 5 days of data with onset hours, chronic is possible
      }).length;
    const borderlineSignal = hrv_z !== null && hrv_z < -0.2;
    if (chronicDays >= 5 && borderlineSignal && state && state.startsWith('grn_')) {
      return { state: 'amb_load', confidence: 'low' };
    }
  }

  return { state, confidence };
}

function scoreSignalState(today, baselines, history, hrvVolatility) {
  const {
    rec_z, hrv_z, rhr_z, strain_z, nas_z,
    sleep_suff, sleep_debt_7d, sleep_stress,
    workout_logged, recovery_pct, hrv_ms, strain
  } = today;

  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];

  const last3rec = history.slice(0, 3).map(d => d.recovery_pct).filter(Boolean);
  const recRising = last3rec.length >= 2 && last3rec[0] > last3rec[last3rec.length - 1];

  // -- SCIENTIFIC GUARDRAIL (WHOOP AI + HRV literature validated) --
  // If recovery >= 67% AND HRV >= baseline AND strain is low-moderate:
  // the system is physiologically well-resourced. Block all amber/red trend
  // states -- score green instead. (Elevated HRV = parasympathetic dominance
  // = positive adaptation signal, regardless of short-term drift.)
  const hrvAtOrAboveBaseline = hrv_z !== null && hrv_z >= 0;
  const recoveryIsGreen = recovery_pct !== null && recovery_pct >= 67;
  const strainIsLowMod = strain_z === null || strain_z < 1.0;
  const physiologicallyWell = recoveryIsGreen && hrvAtOrAboveBaseline && strainIsLowMod;

  // -- RED: psychological depletion --
  // red_psych: low recovery despite good sleep and low strain
  if (
    rec_z !== null && rec_z < -0.8 &&
    sleep_suff !== null && sleep_suff >= 0.85 &&
    strain_z !== null && strain_z < 0.3 &&
    (sleep_stress === 'poor' || (hrv_z !== null && hrv_z < -0.5))
  ) {
    return { state: 'red_psych', confidence: 'high' };
  }

  // red_trend: HRV declining multi-day, not physical
  // GUARDS:
  //   1. Block if physiologically well (recovery green + HRV >= baseline + low strain)
  //   2. Require >=7 days of history (< 7 days = within normal HRV variance)
  //   3. Block if recovery >= 67% (high recovery overrides HRV trend concern)
  if (
    hrvDeclining &&
    hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) &&
    strain_z !== null && strain_z < 0.5
  ) {
    if (physiologicallyWell) {
      // System is well -- route to green, not amber
      // (falls through to green scoring below)
    } else {
      const hasEnoughHistory = history.length >= 7;
      const recoveryIsLow = recovery_pct !== null && recovery_pct < 67;
      if (hasEnoughHistory && recoveryIsLow) {
        return { state: 'red_trend', confidence: 'high' };
      }
      return { state: 'amb_trend', confidence: 'medium' };
    }
  }

  // red_strain: high strain with no workout logged
  if (
    strain_z !== null && strain_z > 1.0 &&
    !workout_logged &&
    (nas_z !== null && nas_z > 1.0)
  ) {
    return { state: 'red_strain', confidence: 'high' };
  }

  // -- RED medium confidence --
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

  // -- GREEN --
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
    history.length >= 2 &&
    history[1].rec_z < -0.3
  ) {
    return { state: 'grn_bounce', confidence: 'high' };
  }

  const consecutiveGreen = last3rec.filter(r => r >= 67).length;
  if (consecutiveGreen >= 3) {
    return { state: 'grn_streak', confidence: 'high' };
  }

  // Physiologically well but not strongly green -- still score green
  if (physiologicallyWell) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }

  if (rec_z !== null && rec_z > 0.5) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }

  // -- AMBER: HRV volatility (sustained high CV, no stronger signal) --
  // CV >30% over 5+ days with no green/amber/red state already firing.
  // Green states are handled via hrv_volatility_flag instead (state preserved).
  if (hrvVolatility && hrvVolatility.volatile_high) {
    return { state: 'amb_volatile', confidence: 'medium' };
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

    const today = daily[0];
    const sleep_debt_7d = daily.slice(0, 7).reduce((acc, d) => {
      if (d.sleep_need_hours && d.sleep_hours) return acc + Math.max(0, d.sleep_need_hours - d.sleep_hours);
      return acc;
    }, 0);

    const todayScored = {
      ...today,
      rec_z:    zScore(today.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z:    zScore(today.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
      rhr_z:    zScore(today.rhr_bpm, baselines.rhr_mean, baselines.rhr_sd),
      strain_z: zScore(today.day_strain, baselines.strain_mean, baselines.strain_sd),
      nas_z: null,
      sleep_debt_7d,
    };

    const history = daily.slice(1).map(d => ({
      ...d,
      rec_z: zScore(d.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z: zScore(d.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
    }));

    const hrvVolatility = computeHRVVolatility(history);
    const { state: baseState, confidence: baseConfidence } = scoreSignalState(todayScored, baselines, history, hrvVolatility);
    const compositeLoad = computeCompositeLoad(todayScored, baselines, history);
    const { state, confidence } = applyStateEscalation(baseState, baseConfidence, compositeLoad, todayScored, history);
    const exploration_score = computeExplorationScore(todayScored, baselines, history);

    // hrv_volatility_flag: moderate instability (CV 20-30%) while state is green.
    // State is preserved -- Lumen adds a secondary observation rather than leading with it.
    const isGreen = state && state.startsWith('grn_');
    const hrv_volatility_flag = isGreen && hrvVolatility.volatile && !hrvVolatility.volatile_high;

    // -- WRITE TO daily_state --
    // Fire-and-forget -- never block the response on a DB write.
    // Uses upsert via Prefer: resolution=merge-duplicates so re-loading the page
    // today just updates the row rather than erroring on a unique constraint.
    if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const dailyStateRow = {
        user_id:           userId,
        date:              today.date,
        recovery_pct:      today.recovery_pct   !== null ? Math.round(today.recovery_pct)   : null,
        hrv_ms:            today.hrv_ms          !== null ? parseFloat(today.hrv_ms.toFixed(1)) : null,
        rhr_bpm:           today.rhr_bpm          !== null ? Math.round(today.rhr_bpm)          : null,
        day_strain:        today.day_strain       !== null ? parseFloat(today.day_strain.toFixed(1)) : null,
        sleep_perf_pct:    today.sleep_perf_pct   !== null ? Math.round(today.sleep_perf_pct)  : null,
        sleep_hours:       today.sleep_hours      !== null ? parseFloat(today.sleep_hours.toFixed(2)) : null,
        respiratory_rate:  today.rr_bpm           !== null ? parseFloat((today.rr_bpm).toFixed(2)) : null,
        workout_logged:    today.workout_logged   || false,
        sleep_suff:        today.sleep_suff       !== null ? parseFloat(today.sleep_suff.toFixed(3)) : null,
        signal_state:      state || null,
        signal_confidence: confidence || null,
        rec_z:             todayScored.rec_z      !== null ? parseFloat(todayScored.rec_z.toFixed(3))  : null,
        hrv_z:             todayScored.hrv_z      !== null ? parseFloat(todayScored.hrv_z.toFixed(3))  : null,
        strain_z:          todayScored.strain_z   !== null ? parseFloat(todayScored.strain_z.toFixed(3)) : null,
        composite_load:    parseFloat(compositeLoad.composite.toFixed(3)),
        impaired_signals:  compositeLoad.impaired_count,
        hrv_cv:            hrvVolatility.cv_pct,
        exploration_score: exploration_score,
        sleep_debt_7d:     parseFloat(sleep_debt_7d.toFixed(2)),
        days_of_history:   historicalDays.length,
      };
      fetch(
        `${process.env.SUPABASE_URL}/rest/v1/daily_state`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            apikey: process.env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(dailyStateRow)
        }
      ).catch(e => console.error('daily_state write error:', e.message));
    }

    const response = {
      recovery:          today.recovery_pct,
      hrv:               today.hrv_ms ? parseFloat(today.hrv_ms.toFixed(1)) : null,
      strain:            today.day_strain ? parseFloat(today.day_strain.toFixed(1)) : null,
      rhr:               today.rhr_bpm,
      sleep_score:       today.sleep_perf_pct,
      sleep_hours:       today.sleep_hours ? parseFloat(today.sleep_hours.toFixed(1)) : null,
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
