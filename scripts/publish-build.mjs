/* Publish a build into docs/ so docs/apps.html offers it for download.
 *
 *   node scripts/publish-build.mjs customer mobile/dist/Fixzy.apk 1.0.1
 *   node scripts/publish-build.mjs pro      <path-to-apk> 1.0.0
 *   node scripts/publish-build.mjs admin                      # builds admin/ and zips admin/dist (version from admin/package.json)
 *
 * Copies the file to docs/downloads/ and records it in docs/builds.js (read by apps.html, works from file://).
 * Send the whole docs/ folder to the client. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const downloads = join(docs, 'downloads');
const NAMES = { customer: 'Fixzy-Customer', pro: 'Fixzy-Pro', admin: 'Fixzy-Admin' };

const [app, srcArg, versionArg] = process.argv.slice(2);
if (!NAMES[app]) { console.error('Usage: publish-build.mjs <customer|pro|admin> [file] [version]'); process.exit(1); }

let src = srcArg && resolve(srcArg);
let version = versionArg;

if (app === 'admin' && !src) {
  const adminDir = join(root, 'admin');
  const win = process.platform === 'win32';
  const b = spawnSync(win ? 'npx.cmd' : 'npx', ['vite', 'build'], { cwd: adminDir, stdio: 'inherit', shell: win });
  if (b.status !== 0) { console.error('Admin build failed.'); process.exit(1); }
  src = join(adminDir, 'dist.zip');
  rmSync(src, { force: true });
  const z = spawnSync('tar', ['-a', '-c', '-f', src, '-C', join(adminDir, 'dist'), '.'], { stdio: 'inherit' });
  if (z.status !== 0) { console.error('Zipping admin/dist failed.'); process.exit(1); }
  version ??= JSON.parse(readFileSync(join(adminDir, 'package.json'), 'utf8')).version;
}
if (!src || !existsSync(src)) { console.error(`Build file not found: ${src}`); process.exit(1); }
version ??= '1.0.0';

mkdirSync(downloads, { recursive: true });
// Drop this app's previous download so the folder only holds the latest build of each.
for (const f of readdirSync(downloads)) if (f.startsWith(NAMES[app] + '-')) rmSync(join(downloads, f));
const fileName = `${NAMES[app]}-${version}${extname(src)}`;
copyFileSync(src, join(downloads, fileName));

const dataFile = join(docs, 'builds.json');
const builds = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : {};
builds[app] = { version, file: `downloads/${fileName}`, builtOn: new Date().toISOString().slice(0, 10), sizeMB: +(statSync(src).size / 1048576).toFixed(1) };
writeFileSync(dataFile, JSON.stringify(builds, null, 2) + '\n');
writeFileSync(join(docs, 'builds.js'), `window.BUILDS = ${JSON.stringify(builds, null, 2)};\n`);
console.log(`Published ${app} ${version} -> docs/downloads/${fileName} (${builds[app].sizeMB} MB). apps.html is up to date.`);
