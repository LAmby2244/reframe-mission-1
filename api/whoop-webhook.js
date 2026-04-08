const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';

module.exports = async (req, res) => {
  // ── Webhook verification (GET) ───────────────────────────────────────────
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    if (challenge) return res.status(200).send(challenge);
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const event = req.body;
    const eventType = event?.type || '';
    const userId = event?.user_id ? String(event.user_id) : null;

    // Only process recovery and sleep events
    if (!userId || (!eventType.includes('recovery') && !eventType.includes('sleep'))) {
      return res.status(200).json({ received: true, processed: false });
    }

    // Look up stored connection by whoop_member_id
    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${userId}&select=access_token,refresh_token,expires_at,user_id&limit=1`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
    );
    const connections = await connRes.json();
    if (!connections.length) return res.status(200).json({ received: true, error: 'No connection found' });

    let { access_token, refresh_token, expires_at, user_id: supabaseUserId } = connections[0];

    // Refresh token if expired
    if (new Date(expires_at) <= new Date()) {
      const refreshed = await refreshWhoopToken(refresh_token, userId, supabaseUserId);
      if (!refreshed) return res.status(200).json({ received: true, error: 'Token refresh failed' });
      access_token = refreshed;
    }

    // Fetch today's data from WHOOP
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 28);
    const startStr = startDate.toISOString().split('T')[0];

    const [recoveryRes, cycleRes, sleepRes] = await Promise.all([
      fetch(`${WHOOP_API_BASE}/recovery?start=${startStr}&end=${endStr}&limit=28`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      fetch(`${WHOOP_API_BASE}/cycle?start=${startStr}&end=${endStr}&limit=28`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      fetch(`${WHOOP_API_BASE}/activity/sleep?start=${startStr}&end=${endStr}&limit=28`, {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    ]);

    const [recoveryData, cycleData, sleepData] = await Promise.all([
      recoveryRes.json(),
      cycleRes.json(),
      sleepRes.json()
    ]);

    const recoveries = recoveryData.records || [];
    const cycles = cycleData.records || [];
    const sleeps = (sleepData.records || []).filter(s => !s.nap);

    if (!recoveries.length) return res.status(200).json({ received: true, processed: false, reason: 'No recovery data' });

    // Get today's recovery
    const latest = recoveries[0];
    const score = latest.score || {};

    const recoveryScore = Math.round(score.recovery_score || 0);
    const hrv = parseFloat((score.hrv_rmssd_milli || 0).toFixed(1));
    const rhr = Math.round(score.resting_heart_rate || 0);

    // Get today's cycle for strain
    const todayCycle = cycles[0];
    const strain = parseFloat((todayCycle?.score?.strain || 0).toFixed(1));

    // Get today's sleep
    const todaySleep = sleeps[0];
    const sleepHours = parseFloat(((todaySleep?.score?.stage_summary?.total_in_bed_time_milli || 0) / 3600000).toFixed(1));
    const sleepNeed = parseFloat(((todaySleep?.score?.sleep_needed?.baseline_milli || 0) / 3600000).toFixed(1));
    const sleepPerf = Math.round(todaySleep?.score?.sleep_performance_percentage || 0);

    // Compute 28-day baselines from history
    const hrvValues = recoveries.map(r => r.score?.hrv_rmssd_milli || 0).filter(v => v > 0);
    const recValues = recoveries.map(r => r.score?.recovery_score || 0).filter(v => v > 0);
    const strainValues = cycles.map(c => c.score?.strain || 0).filter(v => v > 0);

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const std = arr => { const m = avg(arr); return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length); };

    const hrvBaseline = parseFloat(avg(hrvValues).toFixed(1));
    const recBaseline = parseFloat(avg(recValues).toFixed(1));
    const strainBaseline = parseFloat(avg(strainValues).toFixed(1));
    const hrvStd = std(hrvValues) || 1;
    const recStd = std(recValues) || 1;

    const recZ = parseFloat(((recoveryScore - recBaseline) / recStd).toFixed(2));
    const hrvZ = parseFloat(((hrv - hrvBaseline) / hrvStd).toFixed(2));

    // Simple exploration score
    let explorationScore = 0;
    if (recZ < -0.8 && sleepPerf >= 85) explorationScore += 3;
    if (hrvValues.length >= 3) {
      const last3hrv = recoveries.slice(0, 3).map(r => r.score?.hrv_rmssd_milli || 0);
      if (last3hrv[0] < last3hrv[1] && last3hrv[1] < last3hrv[2]) explorationScore += 2;
    }
    if (recZ < -0.5) explorationScore += 1;

    // Save to daily_state
    await fetch(`${SUPABASE_URL}/rest/v1/daily_state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: supabaseUserId,
        date: endStr,
        recovery: recoveryScore,
        hrv_ms: hrv,
        rhr_bpm: rhr,
        sleep_hours: sleepHours,
        sleep_need_hours: sleepNeed,
        sleep_efficiency: sleepPerf,
        day_strain: strain,
        flags: {
          rec_z: recZ,
          hrv_z: hrvZ,
          hrv_baseline: hrvBaseline,
          rec_baseline: recBaseline,
          strain_baseline: strainBaseline,
          exploration_score: explorationScore
        }
      })
    });

    return res.status(200).json({ received: true, processed: true, date: endStr, recovery: recoveryScore });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};

// ── Helper: refresh token and update Supabase ────────────────────────────────
async function refreshWhoopToken(refreshToken, memberId, supabaseUserId) {
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
        user_id: supabaseUserId,
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
