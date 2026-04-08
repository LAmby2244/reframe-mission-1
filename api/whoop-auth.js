const WHOOP_CLIENT_ID     = process.env.WHOOP_CLIENT_ID;
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY= process.env.SUPABASE_SERVICE_KEY;
const APP_BASE_URL        = 'https://app.purposefulchange.co.uk';
const REDIRECT_URI        = `${APP_BASE_URL}/api/whoop-auth?action=callback`;
const WHOOP_AUTH_URL      = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL     = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_SCOPES        = 'offline read:recovery read:sleep read:workout read:cycles read:body_measurement read:profile';

// Known user IDs — server-side fallback when session token unavailable
const KNOWN_MEMBERS = {
  '36136954': 'b34d797c-80b7-4c15-94ac-159ef813e202', // Simon
  '34690349': null // Melinda — user_id to be set after first connect
};

module.exports = async (req, res) => {
  const action = req.query.action;

  // ── CONNECT ──────────────────────────────────────────────────────────────
  if (action === 'connect') {
    const authHeader = req.headers.authorization || '';
    const supabaseToken = authHeader.replace('Bearer ', '').trim();
    const state = Buffer.from(JSON.stringify({
      t: supabaseToken || '',
      r: req.query.next || '/wearable.html'
    })).toString('base64url');

    const params = new URLSearchParams({
      client_id:     WHOOP_CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         WHOOP_SCOPES,
      state
    });
    return res.redirect(`${WHOOP_AUTH_URL}?${params}`);
  }

  // ── CALLBACK ─────────────────────────────────────────────────────────────
  if (action === 'callback') {
    const { code, state: rawState, error } = req.query;

    if (error) return res.status(400).send(`WHOOP auth error: ${error}`);
    if (!code) return res.status(400).send('Missing authorisation code from WHOOP');

    // Decode state
    let supabaseToken = '', returnPath = '/wearable.html';
    try {
      const decoded = JSON.parse(Buffer.from(rawState || '', 'base64url').toString());
      supabaseToken = decoded.t || '';
      returnPath    = decoded.r || '/wearable.html';
    } catch (_) {}

    // Exchange code for tokens
    let tokens;
    try {
      const tokenRes = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  REDIRECT_URI,
          client_id:     WHOOP_CLIENT_ID,
          client_secret: WHOOP_CLIENT_SECRET
        })
      });
      const text = await tokenRes.text();
      tokens = JSON.parse(text);
      if (!tokens.access_token) {
        console.error('Token exchange failed:', text.substring(0, 300));
        return res.status(500).send('Token exchange failed: ' + text.substring(0, 200));
      }
    } catch (err) {
      console.error('Token exchange error:', err.message);
      return res.status(500).send('Token exchange error: ' + err.message);
    }

    // Get WHOOP member ID
    let memberId = '';
    try {
      const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const profile = await profileRes.json();
      memberId = String(profile.user_id || profile.id || '');
    } catch (err) {
      console.error('Profile fetch error:', err.message);
    }

    // Resolve user_id — try session token first, then known members map, then existing DB row
    let userId = KNOWN_MEMBERS[memberId] || null;

    if (!userId && supabaseToken) {
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${supabaseToken}`,
            apikey: process.env.SUPABASE_ANON_KEY
          }
        });
        const userData = await userRes.json();
        userId = userData.id || null;
      } catch (_) {}
    }

    if (!userId && memberId) {
      try {
        const existingRes = await fetch(
          `${SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${memberId}&select=user_id&limit=1`,
          { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
        );
        const existing = await existingRes.json();
        userId = existing[0]?.user_id || null;
      } catch (_) {}
    }

    // Store in Supabase
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    try {
      const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/whoop_connections`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey:        SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer:        'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id:         userId,
          whoop_member_id: memberId,
          access_token:    tokens.access_token,
          refresh_token:   tokens.refresh_token,
          expires_at:      expiresAt
        })
      });
      if (!storeRes.ok) {
        const errText = await storeRes.text();
        console.error('Supabase store failed:', storeRes.status, errText.substring(0, 200));
      }
    } catch (err) {
      console.error('Supabase store error:', err.message);
    }

    return res.redirect(`${APP_BASE_URL}/whoop-callback.html?mid=${memberId}`);
  }

  // ── FETCH ─────────────────────────────────────────────────────────────────
  if (action === 'fetch') {
    const { mid } = req.query;
    if (!mid) return res.status(400).json({ error: 'Missing mid' });

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${mid}&select=access_token,refresh_token,expires_at,user_id&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
      );
      const rows = await r.json();
      if (!rows.length) return res.status(404).json({ error: 'No connection found' });

      const row = rows[0];
      if (new Date(row.expires_at) <= new Date()) {
        const refreshed = await refreshToken(row.refresh_token, mid, row.user_id);
        if (refreshed) return res.json({ access_token: refreshed, member_id: mid });
        return res.status(401).json({ error: 'Token expired and refresh failed' });
      }
      return res.json({ access_token: row.access_token, member_id: mid });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── REFRESH ───────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    const { refresh_token, mid } = req.body || {};
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });
    const newToken = await refreshToken(refresh_token, mid, null);
    if (!newToken) return res.status(401).json({ error: 'Refresh failed' });
    return res.json({ access_token: newToken });
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
};

async function refreshToken(refreshTok, memberId, userId) {
  try {
    const r = await fetch(process.env.WHOOP_TOKEN_URL || 'https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshTok,
        client_id:     process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET
      })
    });
    const tokens = await r.json();
    if (!tokens.access_token) return null;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        apikey:        process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer:        'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId, whoop_member_id: memberId,
        access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: expiresAt
      })
    });
    return tokens.access_token;
  } catch (_) { return null; }
}
