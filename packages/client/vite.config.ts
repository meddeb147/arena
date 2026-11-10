import { defineConfig } from 'vite';

const GAME_SERVER = process.env.GAME_SERVER ?? 'http://localhost:8080';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set BASE_PATH there. Locally it is '/'.
  base: process.env.BASE_PATH ?? '/',
  server: {
    port: 5173,
    // in dev the page talks to the local game server through the Vite proxy (same origin)
    proxy: {
      '/ws': { target: GAME_SERVER.replace(/^http/, 'ws'), ws: true },
      '/health': GAME_SERVER,
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
