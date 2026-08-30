import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr';
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // The `server.allowedHosts` block that stood here listed a developer's
  // personal ngrok subdomain, committed to a public repo. It was added for a
  // one-off demo tunnel that is no longer in use (owner confirmed 2026-08-30).
  //
  // Dev-server only — `server.*` never reaches a production build, and the
  // hostname was verified absent from dist/ before removal. If a tunnel is
  // needed again, drive it from an env var rather than hardcoding a hostname:
  //   server: { allowedHosts: [process.env.VITE_DEV_ALLOWED_HOST].filter(Boolean) }
  // See CLAUDE.md CF-48.
})
