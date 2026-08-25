// TAMU HOSA site editor — GitHub OAuth relay.
// The Decap CMS admin panel (admin/) can't safely hold a GitHub client secret in the
// browser, so this tiny Cloudflare Worker does the token exchange on its behalf.
// Deploy steps live in SETUP.md.

function randomState() {
  return crypto.randomUUID();
}

function htmlResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/html' } });
}

async function handleAuth(request, env) {
  const state = randomState();
  const redirectUri = new URL('/callback', request.url).toString();
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo,user');
  authorizeUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Max-Age=600; SameSite=Lax`
    }
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie') || '';
  const cookieState = (cookie.match(/oauth_state=([^;]+)/) || [])[1];

  if (!code || !state || state !== cookieState) {
    return htmlResponse('<p>Login failed: invalid or expired state. Close this window and try again.</p>');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL('/callback', request.url).toString()
    })
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return htmlResponse('<p>Login failed: GitHub did not return a token. ' + (tokenData.error_description || '') + '</p>');
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: 'github' });

  var script = "(function(){" +
    "function receiveMessage(e){" +
    "window.opener.postMessage('authorization:github:success:" + payload + "', e.origin);" +
    "window.removeEventListener('message', receiveMessage, false);" +
    "}" +
    "window.addEventListener('message', receiveMessage, false);" +
    "window.opener.postMessage('authorizing:github', '*');" +
    "})();";

  return htmlResponse(
    '<!DOCTYPE html><html><body><script>' + script + '</script>Login complete - you can close this window.</body></html>'
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/auth') return handleAuth(request, env);
    if (url.pathname === '/callback') return handleCallback(request, env);
    return new Response('TAMU HOSA OAuth relay. Nothing to see at this path.', { status: 404 });
  }
};
