/**
 * /api/whoop-auth.js
 * Vercel Edge Function — WHOOP OAuth 2.0 handler
 *
 * ?action=connect   → redirects user to WHOOP OAuth
 * ?action=callback  → exchanges code for token, stores in Supabase, redirects cleanly
 * ?action=refresh   → refreshes an expired token
 */

export const config = { runtime: 'edge' };

const WHOOP_BASE     = 'https://api.prod.whoop.com';
const REDIRECT_URI   = 'https://reframe-mission-1.vercel.app/api/whoop-auth?action=callback';
const CALLBACK_PAGE  = 'https://reframe-mission-1.vercel.app/whoop-callback.html';

export default async function handler(req) {
  const url    = new URL(req.url);
  const action = url.searchParams.get('action');

  // ── CONNECT: redirect to WHOOP OAuth ────────────────────────────
  if (action === 'connect') {
    const state = crypto.randomUUID();
    const authUrl = new URL(`${WHOOP_BASE}/oauth/oauth2/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.WHOOP_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'offline read:recovery read:sleep read:workout read:body_measurement read:cycles read:profile');
    authUrl.searchParams.set('state', state);

    return Response.redirect(authUrl.toString(), 302);
  }

  // ── CALLBACK: exchange code, store in Supabase, redirect cleanly ─
  if (action === 'callback') {
    const code  = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error || !code) {
      return Response.redirect(`${CALLBACK_PAGE}?error=${encodeURIComponent(error || 'no_code')}`, 302);
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(`${WHOOP_BASE}/oauth/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  REDIRECT_URI,
          client_id:     process.env.WHOOP_CLIENT_ID,
          client_secret: process.env.WHOOP_CLIENT_SECRET,
        })
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return Response.redirect(`${CALLBACK_PAGE}?error=${encodeURIComponent('token_exchange_failed')}`, 302);
      }

      const tokens = await tokenRes.json();
      const { access_token, refresh_token, expires_in } = tokens;
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

      // Get WHOOP member ID
      const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const profile = profileRes.ok ? await profileRes.json() : {};
      const whoopMemberId = String(profile.user_id || profile.id || 'unknown');

      // Store in Supabase using service key
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Prefer':        'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            whoop_member_id: whoopMemberId,
            access_token,
            refresh_token:   refresh_token || '',
            expires_at:      expiresAt,
            scope:           tokens.scope || '',
            updated_at:      new Date().toISOString(),
          })
        });
      }

      // Redirect cleanly — NO tokens in URL
      return Response.redirect(CALLBACK_PAGE, 302);

    } catch (err) {
      return Response.redirect(`${CALLBACK_PAGE}?error=${encodeURIComponent(err.message)}`, 302);
    }
  }

  // ── REFRESH: refresh an expired token ───────────────────────────
  if (action === 'refresh') {
    const refreshToken = url.searchParams.get('refresh_token');
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'Missing refresh_token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const tokenRes = await fetch(`${WHOOP_BASE}/oauth/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: refreshToken,
          client_id:     process.env.WHOOP_CLIENT_ID,
          client_secret: process.env.WHOOP_CLIENT_SECRET,
        })
      });

      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: 'Refresh failed' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }

      const tokens = await tokenRes.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Update Supabase
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections?refresh_token=eq.${encodeURIComponent(refreshToken)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            access_token:  tokens.access_token,
            refresh_token: tokens.refresh_token || refreshToken,
            expires_at:    expiresAt,
            updated_at:    new Date().toISOString(),
          })
        });
      }

      return new Response(JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken,
        expires_at:    expiresAt,
      }), {
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Invalid action. Use ?action=connect, ?action=callback, or ?action=refresh', {
    status: 400
  });
}
