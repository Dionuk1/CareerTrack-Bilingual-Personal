import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server has no Worker, so it answers /api/health with "cloud: false"
 * and the app runs in local-only mode. The deployed Worker serves the real API
 * (D1 + Sign in with Freebuff) and answers the same endpoint with cloud: true.
 */
function devApiStub(): Plugin {
  return {
    name: 'careertrack-dev-api-stub',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ cloud: false, db: false }));
      });
    },
  };
}

const allowedHost = process.env.VITE_ALLOWED_HOST;

export default defineConfig({
  plugins: [react(), devApiStub()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: allowedHost ? ['localhost', '127.0.0.1', allowedHost] : ['localhost', '127.0.0.1'],
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
