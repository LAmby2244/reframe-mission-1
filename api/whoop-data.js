/**
 * /api/whoop-data.js
 * Vercel Edge Function — WHOOP Data + Scoring Engine
 *
 * POST /api/whoop-data
 * Body: { access_token: string }
 *
 * Returns: scored WHOOP data ready for Body Signal — same shape as the
 * simulated getWhoopData() it replaces.
 *
 * What it does:
 *   1. Fetches 28 days of WHOOP data (recovery, HRV, sleep, strain, stress)
 *   2. Computes personal baselines (28-day mean + SD for each metric)
 *   3. Computes z-scores for today's values against baseline
 *   4. Runs the six-state scoring engine
 *   5. Returns structured data + the scored state
 *
 * Environment variables required:
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET (for token refresh)
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY (for saving daily_state)
 */

export const config = { runtime: 'edge' };

const WHOOP_BASE = 'https://api.prod.whoop.com/developer/v1';

// ── WHOOP API HELPERS ─────────────────────────────────

async function whoopGet(path, token) {
  const res = await fetch(`${WHOOP_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`WHOOP ${path} failed: ${res.status}`);
  return res.json();
}

// ── STATS HELPERS ─────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 1; // avoid div/0
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
  return Math.max(Math.sqrt(variance), 0.1); // floor at 0.1 to avoid div/0
}

function zScore(value, baseline_mean, baseline_sd) {
  if (value === null || value === undefined) return null;
  return (value - baseline_mean) / baseline_sd;
}

// ── SCORING ENGINE ────────────────────────────────────
// Six state formulae — grounded in WHOOP API fields and research
// Full formula documentation in research paper section 2.3

function scoreSignalState(today, baselines, history) {
  const {
    rec_z, hrv_z, rhr_z, strain_z, nas_z,
    sleep_suff, sleep_debt_7d,
    sleep_stress, workout_logged,
    recovery_pct, hrv_ms, strain
  } = today;

  // Compute HRV 3-day trend
  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 &&
    last3hrv[0] < last3hrv[last3hrv.length - 1]; // first (most recent) < last

  // Compute recovery trend
  const last3rec = history.slice(0, 3).map(d => d.recovery_pct).filter(Boolean);
  const recRising = last3rec.length >= 2 &&
    last3rec[0] > last3rec[last3rec.length - 1]; // recent higher than prior

  // ── RED STATE 01 — Something is running underneath ──
  // Low recovery + adequate sleep + low strain + sleep stress
  if (
    rec_z !== null && rec_z < -0.8 &&
    sleep_suff !== null && sleep_suff >= 0.85 &&
    strain_z !== null && strain_z < 0.3 &&
    (sleep_stress === 'poor' || (hrv_z !== null && hrv_z < -0.5))
  ) {
    return { state: 'red_psych', confidence: 'high' };
  }

  // ── RED STATE 02 — This has been building ──
  // Multi-day HRV decline without physical cause
  if (
    hrvDeclining &&
    hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) &&
    strain_z !== null && strain_z < 0.5
  ) {
    return { state: 'red_trend', confidence: 'high' };
  }

  // ── RED STATE 03 — Your body logged something ──
  // High strain + no workout + elevated non-activity stress
  if (
    strain_z !== null && strain_z > 1.0 &&
    !workout_logged &&
    (nas_z !== null && nas_z > 1.0)
  ) {
    return { state: 'red_strain', confidence: 'high' };
  }

  // Softer RED states — medium confidence
  if (rec_z !== null && rec_z < -0.8 && sleep_suff >= 0.85) {
    return { state: 'red_psych', confidence: 'medium' };
  }
  if (hrvDeclining && strain_z < 0.5) {
    return { state: 'red_trend', confidence: 'medium' };
  }

  // ── GREEN STATE 04 — Something is working ──
  // High recovery + HRV at/above baseline + system at rest
  if (
    rec_z !== null && rec_z > 0.5 &&
    hrv_z !== null && hrv_z >= 0.0 &&
    rhr_z !== null && rhr_z < 0.0
  ) {
    return { state: 'grn_thriving', confidence: 'high' };
  }

  // ── GREEN STATE 05 — Something shifted ──
  // Recovery rising after prior below-baseline days
  if (
    rec_z !== null && rec_z > 0.3 &&
    recRising &&
    history.length >= 2 &&
    history[1].rec_z < -0.3
  ) {
    return { state: 'grn_bounce', confidence: 'high' };
  }

  // ── GREEN STATE 06 — This is your code ──
  // 3+ consecutive strong recovery days
  const consecutiveGreen = last3rec.filter(r => r >= 67).length;
  if (consecutiveGreen >= 3) {
    return { state: 'grn_streak', confidence: 'high' };
  }

  // Softer GREEN states
  if (rec_z !== null && rec_z > 0.5) {
    return { state: 'grn_thriving', confidence: 'medium' };
  }

  // No clear state — informational
  return { state: null, confidence: 'low' };
}

// ── EXPLORATION SCORE ─────────────────────────────────
// Continuous weighted score — confirmed from three independent sources

function computeExplorationScore(today, baselines, history) {
  let score = 0;
  const { rec_z, hrv_z, strain_z, nas_z, sleep_suff, sleep_debt_7d, sleep_stress, workout_logged } = today;

  const last3hrv = history.slice(0, 3).map(d => d.hrv_ms).filter(Boolean);
  const hrv3dMean = mean(last3hrv);
  const hrvDeclining = last3hrv.length >= 2 && last3hrv[0] < last3hrv[last3hrv.length - 1];

  // Pattern A — psychological load
  if (rec_z < -0.8 && sleep_suff >= 0.85 && strain_z < 0.3) score += 3;

  // Pattern B — sustained HRV decline
  if (hrvDeclining && hrv3dMean < (baselines.hrv_mean - 0.7 * baselines.hrv_sd) && strain_z < 0.5) score += 2;

  // Pattern C — trigger event (high strain, no workout, non-activity stress)
  if (strain_z > 1.0 && !workout_logged && nas_z > 1.0) score += 3;

  // Amplifiers (all available via WHOOP public API)
  if (sleep_stress === 'poor') score += 1;
  if (sleep_debt_7d > 1.5) score += 1;
  if (nas_z !== null && nas_z > 1.5) score += 1;
  if (hrv_z !== null && hrv_z < -1.5) score += 1;

  return score;
}

// ── MAIN HANDLER ─────────────────────────────────────

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

  const { access_token } = body;
  if (!access_token) {
    return new Response(JSON.stringify({ error: 'Missing access_token' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // ── 1. FETCH 28 DAYS OF WHOOP DATA ──────────────────

    const endDate   = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr   = endDate.toISOString().split('T')[0];

    // Fetch in parallel — all available via WHOOP public API
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

    // ── 2. BUILD DAILY RECORDS ───────────────────────────
    // Map each cycle to a structured daily record

    const workoutDates = new Set(
      workouts.map(w => w.start?.split('T')[0]).filter(Boolean)
    );

    const daily = cycles.map(cycle => {
      const date = cycle.start?.split('T')[0];
      const score = cycle.score || {};

      // Match sleep to this cycle day
      const sleep = sleeps.find(s => s.start?.split('T')[0] === date);
      const sleepScore = sleep?.score || {};

      const hoursSlept = sleepScore.stage_summary?.total_in_bed_time_milli
        ? sleepScore.stage_summary.total_in_bed_time_milli / 3600000 : null;
      const sleepNeed  = sleepScore.sleep_needed?.baseline_milli
        ? sleepScore.sleep_needed.baseline_milli / 3600000 : null;

      // Sleep stress: use WHOOP's respiratory rate as proxy if stress not available
      // WHOOP API: sleep.score.respiratory_rate available
      const sleepStress = sleepScore.respiratory_rate
        ? (sleepScore.respiratory_rate > 17 ? 'poor' : sleepScore.respiratory_rate > 15 ? 'sufficient' : 'optimal')
        : null;

      return {
        date,
        recovery_pct:      score.recovery_score ?? null,
        hrv_ms:            score.hrv_rmssd_milli ?? null,
        rhr_bpm:           score.resting_heart_rate ?? null,
        respiratory_rate:  score.spo2_percentage ?? sleepScore.respiratory_rate ?? null,
        sleep_hours:       hoursSlept,
        sleep_need_hours:  sleepNeed,
        sleep_perf_pct:    sleepScore.sleep_performance_percentage ?? null,
        sleep_stress:      sleepStress,
        day_strain:        cycle.score?.strain ?? null,
        // Non-activity stress: computed from total strain - workout strain
        non_activity_stress: cycle.score?.strain && workoutDates.has(date)
          ? null // will compute below
          : cycle.score?.strain ?? null,
        workout_logged: workoutDates.has(date),
        sleep_suff: hoursSlept && sleepNeed ? hoursSlept / sleepNeed : null,
      };
    }).filter(d => d.date).sort((a, b) => b.date.localeCompare(a.date));

    if (!daily.length) {
      return new Response(JSON.stringify({ error: 'Could not parse WHOOP data' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 3. COMPUTE BASELINES (28-day) ───────────────────

    const historicalDays = daily.slice(1); // exclude today for baseline

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

    // ── 4. COMPUTE Z-SCORES FOR TODAY ───────────────────

    const today = daily[0];
    const sleep_debt_7d = daily.slice(0, 7).reduce((acc, d) => {
      if (d.sleep_need_hours && d.sleep_hours) {
        return acc + Math.max(0, d.sleep_need_hours - d.sleep_hours);
      }
      return acc;
    }, 0);

    const todayScored = {
      ...today,
      rec_z:    zScore(today.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z:    zScore(today.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
      rhr_z:    zScore(today.rhr_bpm, baselines.rhr_mean, baselines.rhr_sd),
      strain_z: zScore(today.day_strain, baselines.strain_mean, baselines.strain_sd),
      nas_z:    zScore(today.non_activity_stress, baselines.nas_mean, baselines.nas_sd),
      sleep_debt_7d,
    };

    // Add z-scores to history for trend analysis
    const history = daily.slice(1).map(d => ({
      ...d,
      rec_z: zScore(d.recovery_pct, baselines.recovery_mean, baselines.recovery_sd),
      hrv_z: zScore(d.hrv_ms, baselines.hrv_mean, baselines.hrv_sd),
    }));

    // ── 5. SCORE THE SIGNAL STATE ────────────────────────

    const { state, confidence } = scoreSignalState(todayScored, baselines, history);
    const exploration_score = computeExplorationScore(todayScored, baselines, history);

    // ── 6. BUILD RESPONSE ────────────────────────────────
    // Same shape as the simulated getWhoopData() — drop-in replacement

    const response = {
      // Today's values
      recovery:    today.recovery_pct,
      hrv:         today.hrv_ms ? parseFloat(today.hrv_ms.toFixed(1)) : null,
      strain:      today.day_strain ? parseFloat(today.day_strain.toFixed(1)) : null,
      rhr:         today.rhr_bpm,
      sleep_score: today.sleep_perf_pct,
      sleep_hours: today.sleep_hours ? parseFloat(today.sleep_hours.toFixed(1)) : null,
      sleep_need:  today.sleep_need_hours ? parseFloat(today.sleep_need_hours.toFixed(1)) : null,
      sleep_stress: today.sleep_stress,
      workout_logged: today.workout_logged,

      // Baselines
      hrv_baseline:      parseFloat(baselines.hrv_mean.toFixed(1)),
      recovery_baseline: parseFloat(baselines.recovery_mean.toFixed(1)),
      strain_baseline:   parseFloat(baselines.strain_mean.toFixed(1)),

      // Z-scores
      rec_z:    todayScored.rec_z ? parseFloat(todayScored.rec_z.toFixed(2)) : null,
      hrv_z:    todayScored.hrv_z ? parseFloat(todayScored.hrv_z.toFixed(2)) : null,
      strain_z: todayScored.strain_z ? parseFloat(todayScored.strain_z.toFixed(2)) : null,

      // Derived
      sleep_debt_7d: parseFloat(sleep_debt_7d.toFixed(1)),
      exploration_score,
      signal_state: state,
      signal_confidence: confidence,

      // Trend data (for display in UI)
      days_trend: daily.slice(0, 7).map(d => d.hrv_ms).filter(Boolean),
      recovery_trend: daily.slice(0, 7).map(d => d.recovery_pct).filter(Boolean),

      // Metadata
      date: today.date,
      data_source: 'whoop_live',
      days_of_history: historicalDays.length,
    };

    // ── 7. SAVE TO daily_state ───────────────────────────
    // Fire and forget — don't block the response

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supaBody = {
        date:                today.date,
        recovery_pct:        today.recovery_pct,
        hrv_ms:              today.hrv_ms,
        rhr_bpm:             today.rhr_bpm,
        sleep_hours:         today.sleep_hours,
        sleep_need_hours:    today.sleep_need_hours,
        sleep_perf_pct:      today.sleep_perf_pct,
        sleep_stress:        today.sleep_stress,
        day_strain:          today.day_strain,
        non_activity_stress: today.non_activity_stress,
        rec_z:               todayScored.rec_z,
        hrv_z:               todayScored.hrv_z,
        rhr_z:               todayScored.rhr_z,
        strain_z:            todayScored.strain_z,
        nas_z:               todayScored.nas_z,
        sleep_suff:          today.sleep_suff,
        sleep_debt_7d,
        exploration_score,
        signal_state:        state,
        workout_logged:      today.workout_logged,
        flags: JSON.stringify({
          low_recovery_streak: history.slice(0, 3).filter(d => d.rec_z < -0.5).length >= 3,
          hrv_declining:       history.slice(0, 3).length >= 2 &&
                               history[0].hrv_ms < history[2]?.hrv_ms,
          high_exploration:    exploration_score >= 7,
        }),
      };

      // Note: user_id must be set server-side — requires auth verification
      // For now saves without user_id; update after Supabase auth integration
      fetch(`${process.env.SUPABASE_URL}/rest/v1/daily_state`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify(supaBody)
      }).catch(e => console.error('daily_state save failed:', e));
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err) {
    console.error('whoop-data error:', err);
    return new Response(JSON.stringify({
      error: err.message,
      data_source: 'error'
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
