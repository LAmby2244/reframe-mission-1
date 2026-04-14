/**
 * /api/nudge-whatsapp.js
 * Vercel Cron Job -- WhatsApp Nudge
 * Runs every minute. Fires two types of nudge:
 * 1. Balcony reminder (from rewrite_nudge_settings)
 * 2. Planned moment nudges (from rewrite_planned_moments)
 * Updated: 14 Apr 2026
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

async function sendWhatsApp(to, body) {
  return fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
      },
      body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: `whatsapp:${to}`, Body: body }).toString()
    }
  );
}

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`,
    { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
  );
  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const now = new Date();
    const currentTime = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
    const today = now.toISOString().split('T')[0];
    const currentDayOfWeek = now.getUTCDay();
    let sent = 0;

    // -- 1. BALCONY NUDGES --
    const settings = await supabaseGet(`rewrite_nudge_settings?nudge_time=eq.${currentTime}&select=user_id,whatsapp_number`);
    for (const setting of (settings || [])) {
      const diary = await supabaseGet(`rewrite_diary?user_id=eq.${setting.user_id}&looked_back=not.is.null&created_at=gte.${today}T00:00:00&limit=1`);
      if (diary && diary.length) continue;

      const signals = await supabaseGet(`wearable_entries?user_id=eq.${setting.user_id}&created_at=gte.${today}T00:00:00&select=recovery,hrv,pattern_id&order=created_at.desc&limit=1`);
      const entry = signals && signals.length ? signals[0] : null;
      let signalLine = '';
      if (entry && entry.recovery !== null) {
        const parts = [];
        if (entry.recovery != null) parts.push(`Recovery ${entry.recovery}%`);
        if (entry.hrv != null) parts.push(`HRV ${entry.hrv}ms`);
        const stateDesc = entry.pattern_id ? stateMap[entry.pattern_id] : null;
        signalLine = `\nYour body today: ${parts.join(', ')}${stateDesc ? ` - ${stateDesc}` : ''}.\n`;
      }

      const message = `*Time to get on the balcony.*${signalLine}\nYour body is sending a signal. Open Body Signal to read it and reflect:\n\nhttps://app.purposefulchange.co.uk/wearable.html`;
      const twilioRes = await sendWhatsApp(setting.whatsapp_number, message);
      if (twilioRes.ok) {
        sent++;
        console.log(`Balcony nudge sent to ${setting.user_id}`);
      } else {
        const err = await twilioRes.json();
        console.error(`Balcony nudge failed for ${setting.user_id}: ${err.message}`);
      }
    }

    // -- 2. PLANNED MOMENT NUDGES --
    const weekStart = (() => {
      const d = new Date(now);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      d.setUTCDate(diff);
      return d.toISOString().split('T')[0];
    })();

    const moments = await supabaseGet(`rewrite_planned_moments?nudge_enabled=eq.true&nudge_time=eq.${currentTime}&week_start=eq.${weekStart}&select=id,user_id,action,nudge_message,frequency,frequency_days`);
    for (const moment of (moments || [])) {
      let shouldFire = false;
      if (moment.frequency === 'daily') {
        shouldFire = true;
      } else if (moment.frequency === 'once') {
        shouldFire = true;
      } else if (moment.frequency === 'custom' && moment.frequency_days) {
        shouldFire = moment.frequency_days.includes(currentDayOfWeek);
      }
      if (!shouldFire) continue;

      const userSettings = await supabaseGet(`rewrite_nudge_settings?user_id=eq.${moment.user_id}&select=whatsapp_number&limit=1`);
      if (!userSettings || !userSettings.length || !userSettings[0].whatsapp_number) continue;

      const nudgeMsg = moment.nudge_message || moment.action;
      const message = `*${nudgeMsg}*\n\nhttps://app.purposefulchange.co.uk/rewrite.html`;
      const twilioRes = await sendWhatsApp(userSettings[0].whatsapp_number, message);
      if (twilioRes.ok) {
        sent++;
        console.log(`Moment nudge sent to ${moment.user_id} for: ${moment.action.substring(0,40)}`);
      } else {
        const err = await twilioRes.json();
        console.error(`Moment nudge failed for ${moment.user_id}: ${err.message}`);
      }
    }

    return res.status(200).json({ sent, balcony_checked: (settings || []).length, moments_checked: (moments || []).length });

  } catch (err) {
    console.error('nudge-whatsapp error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
