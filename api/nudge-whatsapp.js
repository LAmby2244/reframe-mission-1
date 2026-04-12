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

const stateMap = {
  'red_psych': 'something non-physical is running',
  'red_trend': 'something has been accumulating',
  'red_strain': "your body logged something you haven't named",
  'amb_load': 'something is asking for attention',
  'amb_trend': 'something has been quietly building',
  'amb_recovery': "you're coming back - take it gently",
  'amb_volatile': 'your system has been unsettled',
  'grn_thriving': 'your system is running well',
  'grn_bounce': 'something shifted',
  'grn_streak': 'something is working - name it'
};

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

      // Get today's body signal entry only (not stale data)
      const signalRes = await fetch(
        `${SUPABASE_URL}/rest/v1/wearable_entries?user_id=eq.${setting.user_id}&created_at=gte.${today}T00:00:00&select=recovery,hrv,mode,pattern_id&order=created_at.desc&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
      );
      const signals = await signalRes.json();
      const entry = signals && signals.length ? signals[0] : null;

      // Only include signal line if we have today's data
      let signalLine = '';
      if (entry && entry.recovery !== null) {
        const parts = [];
        if (entry.recovery != null) parts.push(`Recovery ${entry.recovery}%`);
        if (entry.hrv != null) parts.push(`HRV ${entry.hrv}ms`);
        const stateDesc = entry.pattern_id ? stateMap[entry.pattern_id] : null;
        signalLine = `\nYour body today: ${parts.join(', ')}${stateDesc ? ` - ${stateDesc}` : ''}.\n`;
      }

      const message = `*Time to get on the balcony.*${signalLine}\nYour body is sending a signal. Open Body Signal to read it and reflect:\n\nhttps://app.purposefulchange.co.uk/wearable.html`;

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
