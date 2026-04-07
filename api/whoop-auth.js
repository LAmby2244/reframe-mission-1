/**
 * /api/whoop-auth.js
 * Vercel Edge Function — WHOOP OAuth 2.0
 *
 * GET /api/whoop-auth?action=connect           → redirects to WHOOP auth
 * GET /api/whoop-auth?action=callback&code=X   → exchanges code for tokens, saves to Supabase
 *
 * Environment variables required (set in Vercel dashboard):
 *   WHOOP_CLIENT_ID       — from developer.whoop.com
 *   WHOOP_CLIENT_SECRET   — from developer.whoop.com
 *   SUPABASE_URL          — your Supabase project URL
 *   SUPABASE_SERVICE_KEY  — service role key (not anon — needed to write tokens)
 *   APP_BASE_URL          — e.g. https://reframe-mission-1.vercel.app
 */

export const config = { runtime: 'edge' };

const WHOOP_AUTH_URL   = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL  = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_SCOPE      = 'offline read:recovery read:sleep read:workout read:body_measurement read:cycles read:profile';

export default async function handler(req) {
  const url    = new URL(req.url);
  const action = url.searchParams.get('action');

  // ── STEP 1: CONNECT → redirect to WHOOP ──────────────
  if (action === 'connect') {
    const authUrl = new URL(WHOOP_AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.WHOOP_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${process.env.APP_BASE_URL}/api/whoop-auth?action=callback`);
    authUrl.searchParams.set('scope', WHOOP_SCOPE);
    authUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

    return Response.redirect(authUrl.toString(), 302);
  }

  // ── STEP 2: CALLBACK → exchange code for tokens ──────
  if (action === 'callback') {
    const code  = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error || !code) {
      return new Response(`WHOOP auth error: ${error || 'no code'}`, { status: 400 });
    }

    // Exchange code for access + refresh tokens
    const tokenRes = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
        redirect_uri:  `${process.env.APP_BASE_URL}/api/whoop-auth?action=callback`,
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return new Response(`Token exchange failed: ${err}`, { status: 500 });
    }

    const tokens = await tokenRes.json();
    // tokens = { access_token, refresh_token, expires_in, token_type, scope }

    // Get WHOOP member profile to find their member_id
    const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    const profile = profileRes.ok ? await profileRes.json() : {};

    // Save tokens to Supabase whoop_connections table
    // Use service role key so we can write without user session
    const supaRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/whoop_connections`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        whoop_member_id: profile.user_id?.toString() || 'unknown',
        access_token:    tokens.access_token,
        refresh_token:   tokens.refresh_token,
        expires_at:      new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope:           tokens.scope,
      })
    });

    if (!supaRes.ok) {
      const err = await supaRes.text();
      console.error('Supabase write failed:', err);
      // Still redirect — tokens saved in URL hash for client-side pickup
    }

    // Redirect back to wearable page with token in query params
    // Page picks these up, stores in localStorage, then fetches live data
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    const redirectUrl = new URL(`${process.env.APP_BASE_URL}/wearable.html`);
    redirectUrl.searchParams.set('whoop_connected', '1');
    redirectUrl.searchParams.set('whoop_token', tokens.access_token);
    redirectUrl.searchParams.set('whoop_refresh', tokens.refresh_token || '');
    redirectUrl.searchParams.set('whoop_expires', expiresAt.toString());
    redirectUrl.searchParams.set('whoop_member', profile.user_id?.toString() || '');
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // ── STEP 3: REFRESH → get new access token ───────────
  if (action === 'refresh') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const body = await req.json().catch(() => ({}));
    const refreshToken = body.refresh_token;
    if (!refreshToken) return new Response('Missing refresh_token', { status: 400 });

    const tokenRes = await fetch(WHOOP_TOKEN_URL, {
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
      return new Response('Refresh failed', { status: 401 });
    }

    const tokens = await tokenRes.json();
    return new Response(JSON.stringify(tokens), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Invalid action. Use ?action=connect, ?action=callback, or ?action=refresh', { status: 400 });
}
