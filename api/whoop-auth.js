/**
 * /api/whoop-auth.js
 * Vercel Edge Function — WHOOP OAuth 2.0 handler
 *
 * ?action=connect          → redirects user to WHOOP OAuth
 * ?action=callback         → exchanges code for token, stores in Supabase,
 *                            redirects to /whoop-callback.html?mid=MEMBER_ID
 * ?action=fetch&mid=ID     → returns token for a given member ID (server-side only)
 * ?action=refresh          → refreshes an expired token
 */

export const config = { runtime: 'edge' };

const WHOOP_BASE    = 'https://api.prod.whoop.com';
const REDIRECT_URI  = 'https://reframe-mission-1.vercel.app/api/whoop-auth?action=callback';
const CALLBACK_PAGE = 'https://reframe-mission-1.vercel.app/whoop-callback.html';

export default async function handler(req) {
  const url    = new URL(req.url);
  const action = url.searchParams.get('action');

  // ── CONNECT ──────────────────────────────────────────────────────
  if (action === 'connect') {
    const state = crypto.randomUUID();
    const authUrl = new URL(`${WHOOP_BASE}/oauth/oauth2/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id',     process.env.WHOOP_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
    authUrl.searchParams.set('scope', 'offline read:recovery read:sleep read:workout read:body_measurement read:cycles read:profile');
    authUrl.searchParams.set('state', state);
    return Response.redirect(authUrl.toString(), 302);
  }

  // ── CALLBACK ─────────────────────────────────────────────────────
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
        return Response.redirect(`${CALLBACK_PAGE}?error=token_exchange_failed`, 302);
      }

      const tokens = await tokenRes.json();
      const { access_token, refresh_token, expires_in } = tokens;
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

      // Get WHOOP member ID
      const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      const profile = profileRes.ok ? await profileRes.json() : {};
      const whoopMemberId = String(profile.user_id || profile.id || crypto.randomUUID());

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

      // Redirect with just the member ID (not the token) so the
      // callback page can fetch the token from Supabase via the fetch action
      return Response.redirect(`${CALLBACK_PAGE}?mid=${encodeURIComponent(whoopMemberId)}`, 302);

    } catch (err) {
      return Response.redirect(`${CALLBACK_PAGE}?error=${encodeURIComponent(err.message)}`, 302);
    }
  }

  // ── FETCH: callback page calls this to get token by member ID ────
  // This keeps the actual token off the URL entirely
  if (action === 'fetch') {
    const mid = url.searchParams.get('mid');
    if (!mid) {
      return new Response(JSON.stringify({ error: 'Missing mid' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${encodeURIComponent(mid)}&select=access_token,refresh_token,expires_at`,
        {
          headers: {
            'apikey':        process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          }
        }
      );
      const rows = await res.json();
      if (!rows.length) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(rows[0]), {
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

  // ── REFRESH ───────────────────────────────────────────────────────
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
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/whoop_connections?refresh_token=eq.${encodeURIComponent(refreshToken)}`,
          {
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
          }
        );
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

  return new Response('Invalid action. Use ?action=connect, ?action=callback, ?action=fetch, or ?action=refresh', {
    status: 400
  });
}
