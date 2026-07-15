import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/city-of-influence/ in production, but
// from the root in dev — so the base path only applies to builds.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/city-of-influence/' : '/',
  plugins: [react()],
  server: { port: 6969 },
}));
