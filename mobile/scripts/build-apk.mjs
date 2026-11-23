/* Build a standalone APK locally with Gradle (no EAS).
 *
 *   node scripts/build-apk.mjs            # signed release build
 *   node scripts/build-apk.mjs --debug    # debug build, signed with the Android debug key (faster, no keystore)
 *
 * Needs: Android SDK (ANDROID_HOME or %LOCALAPPDATA%/Android/Sdk) and a JDK 17+ (JAVA_HOME, or Android Studio's bundled one).
 * The JS bundle and the API URLs below are baked into the APK. Output: dist/Fixzy.apk (or dist/Fixzy-debug.apk)
 * The signing key lives in release.keystore + keystore.properties (git-ignored). BACK THEM UP: every future update of the
 * app must be signed with the same key or it will not install over the old one. */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const debug = process.argv.includes('--debug');
const variant = debug ? 'debug' : 'release';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://fixzy-api.vercel.app/api';
const ASSET_URL = process.env.EXPO_PUBLIC_ASSET_URL || 'https://fixzy-tau.vercel.app';

// A release APK is handed to real devices off this network — a leftover local/emulator URL in the
// environment (e.g. from a dev session) would ship a build that can only talk to your own machine.
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:|\/|$)/i;
if (!debug) {
  const bad = [['EXPO_PUBLIC_API_URL', API_URL], ['EXPO_PUBLIC_ASSET_URL', ASSET_URL]].filter(([, url]) => LOCAL_HOST.test(url));
  if (bad.length) throw new Error(`Refusing to build a release APK pointed at a local/dev address:\n${bad.map(([k, v]) => `  ${k}=${v}`).join('\n')}\nUnset it in your shell/.env so the public default above is used, point it at the public deployment, or pass --debug for a local test build.`);
}

const firstExisting = (...p) => p.filter(Boolean).find((x) => existsSync(x));
const sdk = firstExisting(process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), process.env.HOME && join(process.env.HOME, 'Android', 'Sdk'), process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk'));
const jdk = firstExisting(process.env.JAVA_HOME, 'C:/Program Files/Android/Android Studio/jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr');
if (!sdk) throw new Error('Android SDK not found. Set ANDROID_HOME.');
if (!jdk) throw new Error('JDK not found. Set JAVA_HOME (JDK 17+).');
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '45317582109-v4tct8cvs90ijfnnmo5k7o6q757s0mh6.apps.googleusercontent.com'; // web OAuth client: the ID token audience the API verifies
const env = { ...process.env, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: GOOGLE_WEB_CLIENT_ID, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: jdk, EXPO_PUBLIC_API_URL: API_URL, EXPO_PUBLIC_ASSET_URL: ASSET_URL, NODE_ENV: 'production', CI: '1', JAVA_TOOL_OPTIONS: '-Djava.net.preferIPv4Stack=true' };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: win && /\.(bat|cmd)$|^npx$/.test(cmd), ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
};

console.log(`Variant: ${variant}\nAPI: ${API_URL}\nAssets: ${ASSET_URL}\nSDK: ${sdk}\nJDK: ${jdk}\n`);

// 1. Native project (generated from app.json; /android is git-ignored).
if (!existsSync(join(root, 'android'))) run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
writeFileSync(join(root, 'android', 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);

// 1b. Version: take versionName/versionCode from app.json and show it in the app name (rewritten every build).
{
  const expoCfg = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const gradlePath = join(root, 'android', 'app', 'build.gradle');
  const gradleTxt = readFileSync(gradlePath, 'utf8')
    .replace(/versionCode \d+/, `versionCode ${expoCfg.android?.versionCode ?? 1}`)
    .replace(/versionName "[^"]*"/, `versionName "${expoCfg.version}"`);
  writeFileSync(gradlePath, gradleTxt);
  const stringsPath = join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  writeFileSync(stringsPath, readFileSync(stringsPath, 'utf8').replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">Fixzy ${expoCfg.version}</string>`));
  console.log(`Version: ${expoCfg.version} (code ${expoCfg.android?.versionCode ?? 1})`);
}

if (!debug) {
  // 2. Release signing key (created once).
  const ksFile = join(root, 'release.keystore');
  const propsFile = join(root, 'keystore.properties');
  if (!existsSync(ksFile) || !existsSync(propsFile)) {
    const pass = randomBytes(18).toString('base64url');
    execFileSync(join(jdk, 'bin', win ? 'keytool.exe' : 'keytool'), ['-genkeypair', '-v', '-storetype', 'PKCS12', '-keystore', ksFile, '-alias', 'fixzy', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', pass, '-keypass', pass, '-dname', 'CN=Fixzy, O=Fixzy, C=IN'], { stdio: 'ignore' });
    writeFileSync(propsFile, `storeFile=${ksFile.replace(/\\/g, '/')}\nstorePassword=${pass}\nkeyAlias=fixzy\nkeyPassword=${pass}\n`);
    console.log('Created release.keystore + keystore.properties. Back both up somewhere safe.');
  }

  // 3. Wire release signing into the generated Gradle project (idempotent).
  const gradleFile = join(root, 'android', 'app', 'build.gradle');
  let g = readFileSync(gradleFile, 'utf8');
  if (!g.includes('keystore.properties')) {
    g = g.replace('android {', `def keystoreProps = new Properties()\nfile('${propsFile.replace(/\\/g, '/')}').withInputStream { keystoreProps.load(it) }\n\nandroid {`)
      .replace('signingConfigs {', `signingConfigs {\n        release {\n            storeFile file(keystoreProps['storeFile'])\n            storePassword keystoreProps['storePassword']\n            keyAlias keystoreProps['keyAlias']\n            keyPassword keystoreProps['keyPassword']\n        }`)
      .replace(/(release \{\s*\/\/ Caution[^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
    writeFileSync(gradleFile, g);
  }
}

// Drop x86 ABIs to shrink the APK (both variants).
const propsGradle = join(root, 'android', 'gradle.properties');
writeFileSync(propsGradle, readFileSync(propsGradle, 'utf8').replace(/^reactNativeArchitectures=.*$/m, 'reactNativeArchitectures=armeabi-v7a,arm64-v8a'));

// The wrapper's default 10 s timeout is too short to fetch the Gradle distribution on slow connections.
const wrapperProps = join(root, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
let wp = readFileSync(wrapperProps, 'utf8').replace(/^networkTimeout=.*$/m, 'networkTimeout=180000');
// If Java cannot reach services.gradle.org (some networks), download the zip another way and set GRADLE_DIST_ZIP=<path>.
if (process.env.GRADLE_DIST_ZIP) wp = wp.replace(/^distributionUrl=.*$/m, `distributionUrl=file\\:///${resolve(process.env.GRADLE_DIST_ZIP).replace(/\\/g, '/').replace(':', '\\:')}`);
writeFileSync(wrapperProps, wp);

// 4. Build.
const task = debug ? 'assembleDebug' : 'assembleRelease';
run(win ? join(root, 'android', 'gradlew.bat') : './gradlew', [task, '--no-daemon'], { cwd: join(root, 'android') });

const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`);
if (!existsSync(apk)) throw new Error(`Build finished but app-${variant}.apk was not found.`);
mkdirSync(join(root, 'dist'), { recursive: true });
const outName = debug ? 'Fixzy-debug.apk' : 'Fixzy.apk';
copyFileSync(apk, join(root, 'dist', outName));
console.log(`\nDone: dist/${outName}`);
