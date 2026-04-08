const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');

  try {
    // ── Get member_id from request body ─────────────────────────────────
    const { mid } = req.body || {};
    if (!mid) return res.status(400).json({ error: 'Missing mid', data_source: 'error' });

    // ── Look up WHOOP connection from Supabase by member_id ─────────────
    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}&select=access_token,refresh_token,expires_at,user_id&limit=1`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
    );
    const connections = await connRes.json();
    if (!connections.length) {
      return res.status(404).json({ error: 'No WHOOP connection found — please reconnect', data_source: 'error' });
    }

    let { access_token, refresh_token, expires_at, user_id } = connections[0];

    // ── Refresh token if expired ─────────────────────────────────────────
    if (new Date(expires_at) <= new Date()) {
      const refreshed = await refreshWhoopToken(refresh_token, mid, user_id);
      if (!refreshed) return res.status(401).json({ error: 'Token expired — please reconnect WHOOP', data_source: 'error' });
      access_token = refreshed;
    }

    // ── Fetch WHOOP data ─────────────────────────────────────────────────
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 28);
    const startStr = startDate.toISOString().split('T')[0];

    const headers = { Authorization: `Bearer ${access_token}` };

    const [recoveryRes, cycleRes, sleepRes, workoutRes] = await Promise.all([
      fetch(`${WHOOP_API_BASE}/recovery?start=${startStr}&end=${endStr}&limit=28`, { headers }),
      fetch(`${WHOOP_API_BASE}/cycle?start=${startStr}&end=${endStr}&limit=28`, { headers }),
      fetch(`${WHOOP_API_BASE}/activity/sleep?start=${startStr}&end=${endStr}&limit=28`, { headers }),
      fetch(`${WHOOP_API_BASE}/activity/workout?start=${startStr}&end=${endStr}&limit=10`, { headers })
    ]);

    // If WHOOP returns 401, token is actually expired — refresh and retry
    if (recoveryRes.status === 401) {
      const refreshed = await refreshWhoopToken(refresh_token, mid, user_id);
      if (!refreshed) return res.status(401).json({ error: 'Token expired — please reconnect WHOOP', data_source: 'error' });
      access_token = refreshed;
      return res.status(503).json({ error: 'Token refreshed — please retry', data_source: 'retry' });
    }

    const [recoveryData, cycleData, sleepData, workoutData] = await Promise.all([
      recoveryRes.json(),
      cycleRes.json(),
      sleepRes.json(),
      workoutRes.json()
    ]);

    const recoveries = recoveryData.records || [];
    const cycles = cycleData.records || [];
    const sleeps = (sleepData.records || []).filter(s => !s.nap);
    const workouts = workoutData.records || [];

    if (!recoveries.length) {
      return res.status(404).json({ error: 'No recovery data yet today', data_source: 'error' });
    }

    // ── Today's metrics ──────────────────────────────────────────────────
    const latest = recoveries[0];
    const score = latest.score || {};
    const recoveryScore = Math.round(score.recovery_score || 0);
    const hrv = parseFloat((score.hrv_rmssd_milli || 0).toFixed(1));
    const rhr = Math.round(score.resting_heart_rate || 0);

    const todayCycle = cycles[0];
    const strain = parseFloat((todayCycle?.score?.strain || 0).toFixed(1));

    const todaySleep = sleeps[0];
    const sleepHours = parseFloat(((todaySleep?.score?.stage_summary?.total_in_bed_time_milli || 0) / 3600000).toFixed(1));
    const sleepNeed = parseFloat(((todaySleep?.score?.sleep_needed?.baseline_milli || 0) / 3600000).toFixed(1));
    const sleepPerf = Math.round(todaySleep?.score?.sleep_performance_percentage || 0);
    const sleepStress = todaySleep?.score?.sleep_performance_percentage >= 85 ? 'optimal' :
                        todaySleep?.score?.sleep_performance_percentage >= 70 ? 'sufficient' : 'poor';

    // ── Last workout ─────────────────────────────────────────────────────
    const workoutDates = workouts.map(w => w.start?.split('T')[0]).filter(Boolean).sort().reverse();
    const lastWorkoutDate = workoutDates[0] || null;
    const todayStr = endStr;
    const lastWorkoutDaysAgo = lastWorkoutDate
      ? Math.round((new Date(todayStr) - new Date(lastWorkoutDate)) / 86400000)
      : null;
    const workoutLogged = lastWorkoutDate === todayStr;

    // ── 28-day baselines ─────────────────────────────────────────────────
    const hrvValues = recoveries.map(r => r.score?.hrv_rmssd_milli || 0).filter(v => v > 0);
    const recValues = recoveries.map(r => r.score?.recovery_score || 0).filter(v => v > 0);
    const strainValues = cycles.map(c => c.score?.strain || 0).filter(v => v > 0);

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const std = arr => {
      const m = avg(arr);
      return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length) || 1;
    };

    const hrvBaseline = parseFloat(avg(hrvValues).toFixed(1));
    const recBaseline = parseFloat(avg(recValues).toFixed(1));
    const strainBaseline = parseFloat(avg(strainValues).toFixed(1));

    const recZ = parseFloat(((recoveryScore - recBaseline) / std(recValues)).toFixed(2));
    const hrvZ = parseFloat(((hrv - hrvBaseline) / std(hrvValues)).toFixed(2));
    const strainZ = parseFloat(((strain - strainBaseline) / std(strainValues)).toFixed(2));

    // ── HRV trend (last 4 days) ──────────────────────────────────────────
    const daysTrend = recoveries.slice(0, 4).map(r => r.score?.hrv_rmssd_milli || 0).reverse();
    const recTrend = recoveries.slice(0, 4).map(r => r.score?.recovery_score || 0).reverse();
    const hrvDeclining = daysTrend.length >= 3 &&
      daysTrend[daysTrend.length - 1] < daysTrend[daysTrend.length - 2] &&
      daysTrend[daysTrend.length - 2] < daysTrend[daysTrend.length - 3];

    // ── Sleep debt ───────────────────────────────────────────────────────
    const last7sleeps = sleeps.slice(0, 7);
    const sleepDebt7d = parseFloat(last7sleeps.reduce((acc, s) => {
      const need = (s.score?.sleep_needed?.baseline_milli || 0) / 3600000;
      const got = (s.score?.stage_summary?.total_in_bed_time_milli || 0) / 3600000;
      return acc + Math.max(0, need - got);
    }, 0).toFixed(1));

    // ── Signal scoring ───────────────────────────────────────────────────
    let explorationScore = 0;
    let signalState = 'grn_thriving';
    let signalConfidence = 'medium';

    // RED patterns
    if (recZ < -0.8 && sleepPerf >= 85 && !workoutLogged) {
      signalState = 'red_psych'; signalConfidence = 'high'; explorationScore += 3;
    } else if (hrvDeclining && hrvZ < -0.7) {
      signalState = 'red_trend'; signalConfidence = 'medium'; explorationScore += 2;
    } else if (strainZ > 1.0 && !workoutLogged) {
      signalState = 'red_strain'; signalConfidence = 'high'; explorationScore += 3;
    }
    // AMBER patterns
    else if (recZ < -0.5 && recZ >= -0.8) {
      signalState = 'amb_attention'; signalConfidence = 'medium'; explorationScore += 1;
    } else if (hrvZ < -0.5 && !hrvDeclining) {
      signalState = 'amb_building'; signalConfidence = 'low'; explorationScore += 1;
    } else if (recZ > 0 && recTrend.length >= 2 && recTrend[recTrend.length - 2] < recBaseline) {
      signalState = 'amb_returning'; signalConfidence = 'medium';
    }
    // GREEN patterns
    else if (recZ > 0.5 && hrvZ > 0) {
      const streak = recValues.filter(v => v > recBaseline).length;
      signalState = streak >= 3 ? 'grn_streak' : 'grn_thriving';
      signalConfidence = 'high';
    } else if (recZ > 0 && recTrend.length >= 2 && recTrend[0] < recBaseline) {
      signalState = 'grn_bounce'; signalConfidence = 'medium';
    }

    // ── Save to daily_state ──────────────────────────────────────────────
    if (user_id) {
      fetch(`${SUPABASE_URL}/rest/v1/daily_state`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id,
          date: todayStr,
          recovery: recoveryScore,
          hrv_ms: hrv,
          rhr_bpm: rhr,
          sleep_hours: sleepHours,
          sleep_need_hours: sleepNeed,
          sleep_efficiency: sleepPerf,
          day_strain: strain,
          flags: { rec_z: recZ, hrv_z: hrvZ, hrv_baseline: hrvBaseline, rec_baseline: recBaseline, exploration_score: explorationScore, signal_state: signalState }
        })
      }).catch(e => console.error('daily_state save error:', e.message));
    }

    return res.status(200).json({
      recovery: recoveryScore,
      hrv,
      rhr,
      strain,
      sleep_score: sleepPerf,
      sleep_hours: sleepHours,
      sleep_need: sleepNeed,
      sleep_stress: sleepStress,
      workout_logged: workoutLogged,
      last_workout_days_ago: lastWorkoutDaysAgo,
      hrv_baseline: hrvBaseline,
      recovery_baseline: recBaseline,
      strain_baseline: strainBaseline,
      rec_z: recZ,
      hrv_z: hrvZ,
      strain_z: strainZ,
      sleep_debt_7d: sleepDebt7d,
      exploration_score: explorationScore,
      signal_state: signalState,
      signal_confidence: signalConfidence,
      days_trend: daysTrend,
      recovery_trend: recTrend,
      date: todayStr,
      data_source: 'whoop_live',
      days_of_history: recoveries.length
    });

  } catch (err) {
    console.error('whoop-data error:', err);
    return res.status(500).json({ error: err.message, data_source: 'error' });
  }
};

// ── Helper: refresh WHOOP token ──────────────────────────────────────────────
async function refreshWhoopToken(refreshToken, memberId, userId) {
  try {
    const r = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET
      })
    });
    const tokens = await r.json();
    if (!tokens.access_token) return null;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/whoop_connections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        whoop_member_id: memberId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt
      })
    });
    return tokens.access_token;
  } catch (_) {
    return null;
  }
}
