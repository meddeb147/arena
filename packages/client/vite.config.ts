import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set BASE_PATH there. Locally it is '/'.
  base: process.env.BASE_PATH ?? '/',
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: true },
});
