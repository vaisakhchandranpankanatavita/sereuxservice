import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* `npm run dev:live` sends /api to the deployed server instead of a backend on this PC. */
const LIVE_API = 'https://techiova.serieux.in';

export default defineConfig(({ mode }) => {
  const live = mode === 'live';
  if (live) console.warn(`
  LIVE API: ${LIVE_API}. Anything you add, edit or delete changes real data.
`);
  const api = live ? { target: LIVE_API, changeOrigin: true } : 'http://localhost:4000';
  return {
  plugins: [react()],
  server: { proxy: { '/api': api } },
  build: {
    outDir: 'assets/build',
    emptyOutDir: true,
    cssCodeSplit: false, // one app.css, which shell.html links directly
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]',
      },
    },
  },
};
});
