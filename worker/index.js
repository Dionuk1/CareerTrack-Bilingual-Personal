// Cloudflare Worker: Sign in with Freebuff, the CareerTrack API and the SPA.
import { createFreebuffAuth } from '@freebuff/auth';
import { handleApi } from './api.js';

let auth = null;
let wrapped = null;

function build(env) {
  if (wrapped) return wrapped;
  if (!env.FREEBUFF_CLIENT_ID) return null;

  // `allowInsecureLocalhost` exists only for the loopback development client;
  // the deployed origin is always https.
  const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_ORIGIN || '');

  auth = createFreebuffAuth({
    clientId: env.FREEBUFF_CLIENT_ID,
    issuer: env.FREEBUFF_ISSUER,
    baseUrl: env.APP_ORIGIN,
    ...(loopback ? { allowInsecureLocalhost: true } : {}),
  });

  const instance = auth;
  // `wrap` serves /auth/freebuff/*, keeps the session cookie fresh and makes
  // getUser() available to everything inside it.
  wrapped = instance.wrap(async (request, workerEnv) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, workerEnv, instance);
    }

    return workerEnv.ASSETS.fetch(request);
  });

  return wrapped;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Without auth configuration (e.g. a plain static preview) the app runs in
    // local-only mode and never calls the API.
    if (!env.FREEBUFF_CLIENT_ID) {
      if (url.pathname === '/api/health') {
        return Response.json(
          { cloud: false, db: Boolean(env.DB) },
          { headers: { 'cache-control': 'no-store' } }
        );
      }
      if (url.pathname.startsWith('/api/')) {
        return Response.json({ error: 'auth not configured' }, { status: 501 });
      }
      return env.ASSETS.fetch(request);
    }

    const app = build(env);
    return app(request, env);
  },
};
