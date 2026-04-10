/**
 * /api/whoop-refresh.js
 * Vercel Cron Job — proactively refresh all WHOOP tokens
 * Runs every 45 minutes via vercel.json cron config
 * Refreshes any token expiring within the next 60 minutes
 */

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Verify this is a legitimate cron call (Vercel adds this header)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch all tokens expiring within the next 60 minutes
    const cutoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/whoop_connections?expires_at=lt.${cutoff}&select=whoop_member_id,refresh_token,expires_at`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY
        }
      }
    );

    const rows = await res.json();
    console.log(`Token refresh cron: found ${rows.length} tokens to refresh`);

    if (!rows.length) {
      return new Response(JSON.stringify({ refreshed: 0, message: 'No tokens need refreshing' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh each token
    const results = await Promise.allSettled(
      rows.map(row => refreshToken(row.whoop_member_id, row.refresh_token))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - succeeded;

    console.log(`Token refresh cron: ${succeeded} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({
      refreshed: succeeded,
      failed,
      total: rows.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Token refresh cron error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function refreshToken(memberId, refreshTok) {
  try {
    const r = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTok,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET
      })
    });

    const tokens = await r.json();
    if (!tokens.access_token) {
      console.error(`Refresh failed for member ${memberId}:`, JSON.stringify(tokens));
      return false;
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    await fetch(
      `${SUPABASE_URL}/rest/v1/whoop_connections?whoop_member_id=eq.${memberId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt
        })
      }
    );

    console.log(`Refreshed token for member ${memberId}, new expiry: ${expiresAt}`);
    return true;

  } catch (err) {
    console.error(`Refresh error for member ${memberId}:`, err.message);
    return false;
  }
}
