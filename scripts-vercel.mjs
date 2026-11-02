import { cpSync, mkdirSync, rmSync } from 'node:fs';

/* Assemble the static site Vercel serves: the app shell plus built assets and images. */
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
cpSync('home.php', 'dist/index.html');
cpSync('assets/build', 'dist/assets/build', { recursive: true });
cpSync('assets/img', 'dist/assets/img', { recursive: true });
