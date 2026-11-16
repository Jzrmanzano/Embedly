import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative asset paths, so dist/ works from any folder: GitHub Pages
// (https://<user>.github.io/board_3d/), Netlify, Vercel or a local file server.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The 3D bench (three.js and React Three Fiber) is one chunk of about 960 kB that loads only when a mission opens,
  // so the home page does not wait for it. Warn only if it grows well past that.
  build: { chunkSizeWarningLimit: 1100 },
});
