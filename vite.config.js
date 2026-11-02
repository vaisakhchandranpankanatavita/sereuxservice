import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* In dev, serve the app shell for the site's *.php URLs (login.php, shop.php, …). */
const phpShell = {
  name: 'php-shell',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || '').split('?')[0];
      if (path.endsWith('.php')) req.url = '/index.html';
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), phpShell],
  build: {
    outDir: 'assets/build',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'app.css' : 'assets/[name][extname]',
      },
    },
  },
});
