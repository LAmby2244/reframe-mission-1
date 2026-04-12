/**
 * /api/nudge-whatsapp.js
 * Vercel Cron Job — WhatsApp Balcony Practice Nudge
 * Called by Vercel cron job every minute to check scheduled nudges
 * Uses Twilio WhatsApp Sandbox API
 * Updated: 12 Apr 2026
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

function signalSummary(entry) {
  if (!entry) return null;
  const parts = [];
  if (entry.recovery !== null && entry.recovery !== undefined) parts.push(`Recovery ${entry.recovery}%`);
  if (entry.hrv !== null && entry.hrv !== undefined) parts.push(`HRV ${entry.hrv}ms`);
  const stateMap = {
    'red_psych': 'something non-physical is running',
    'red_trend': 'something has been accumulating',
    'red_strain': 'your body logged something you haven\'t named',
    'amb_load': 'something is asking for attention',
    'amb_trend': 'something has been quietly building',
    'amb_recovery': 'you\'re coming back - take it gently',
    'amb_volatile': 'your system has been unsettled',
    'grn_thriving': 'your system is running well',
    'grn_bounce': 'something shifted',
    'grn_streak': 'something is working - name it'
  };
  const signal = entry.mode ? stateMap[entry.pattern_id] || null : null;
  return { metrics: parts.join(', '), signal };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const currentTime = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
    const today = now.toISOString().split('T')[0];

    // Get users whose nudge time matches now
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rewrite_nudge_settings?nudge_time=eq.${currentTime}&select=user_id,whatsapp_number`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
    );
    const settings = await settingsRes.json();
    if (!settings.length) return res.status(200).json({ sent: 0, checked: 0 });

    let sent = 0;
    for (const setting of settings) {
      // Skip if already completed today
      const diaryRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rewrite_diary?user_id=eq.${setting.user_id}&looked_back=not.is.null&created_at=gte.${today}T00:00:00&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
      );
      const diary = await diaryRes.json();
      if (diary.length) continue;

      // Get their declaration
      const treeRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rewrite_trees?user_id=eq.${setting.user_id}&status=eq.active&select=declaration&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
      );
      const trees = await treeRes.json();
      const declaration = trees[0]?.declaration || 'the person you are choosing to become';

      // Get their most recent body signal entry
      const signalRes = await fetch(
        `${SUPABASE_URL}/rest/v1/wearable_entries?user_id=eq.${setting.user_id}&select=recovery,hrv,mode,pattern_id,pattern_title&order=created_at.desc&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
      );
      const signals = await signalRes.json();
      const latestSignal = signals && signals.length ? signals[0] : null;
      const signal = signalSummary(latestSignal);

      // Build message
      let signalLine = '';
      if (signal && signal.metrics) {
        signalLine = `\nYour body today: ${signal.metrics}${signal.signal ? ` - ${signal.signal}` : ''}.\n`;
      }

      const message = `*Time to get on the balcony.*${signalLine}\n"${declaration}"\n\nTwo questions before the day closes:\n\n1. Where did you act from the more whole version of yourself today?\n\n2. What do you appreciate about how you showed up?\n\nOpen Body Signal to reflect:\nhttps://app.purposefulchange.co.uk/wearable.html`;

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
          },
          body: new URLSearchParams({
            From: TWILIO_WHATSAPP_FROM,
            To: `whatsapp:${setting.whatsapp_number}`,
            Body: message
          }).toString()
        }
      );

      const twilioData = await twilioRes.json();
      if (twilioRes.ok) {
        sent++;
        console.log(`Nudge sent to ${setting.user_id}, SID: ${twilioData.sid}`);
      } else {
        console.error(`Nudge failed for ${setting.user_id}: code=${twilioData.code} msg=${twilioData.message} status=${twilioData.status}`);
      }
    }

    return res.status(200).json({ sent, checked: settings.length });

  } catch (err) {
    console.error('nudge-whatsapp error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
