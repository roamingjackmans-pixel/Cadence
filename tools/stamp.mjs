// Builds the published site: copies the game into <dir>, stamps the version, and makes every file URL unique to the
// build. GitHub Pages lets browsers reuse files for about 10 minutes, so without this a player could load a new
// main.js with an old world.js. With ?v=<commit> on the stylesheet, the entry script and every import, a new build
// is all-new URLs.
//   node tools/stamp.mjs <dir> [commit]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || '_site');
let commit = process.argv[3];
if (!commit) try { commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim(); } catch { commit = 'dev'; }
const v = commit.slice(0, 7);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'style.css', '.nojekyll']) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });

// the page: the stylesheet and the entry script
const page = path.join(out, 'index.html');
let html = fs.readFileSync(page, 'utf8');
let n = 0;
html = html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")((?!https?:|data:|\/\/)[^"?#]+\.(?:js|css))(")/g, (m, a, url, b) => { n++; return `${a}${url}?v=${v}${b}`; });
fs.writeFileSync(page, html);

// every relative import, static or dynamic
let m = 0;
for (const f of fs.readdirSync(path.join(out, 'src'))) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(out, 'src', f);
  let src = fs.readFileSync(p, 'utf8');
  src = src.replace(/((?:\bfrom|\bimport)\s*\(?\s*['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g, (all, a, url, b) => { m++; return `${a}${url}?v=${v}${b}`; });
  if (f === 'main.js') src = src.replace(/export const VERSION = '[^']*';/, `export const VERSION = '${pkg.version} · ${v}';`);
  fs.writeFileSync(p, src);
}
if (!fs.readFileSync(path.join(out, 'src', 'main.js'), 'utf8').includes(`'${pkg.version} · ${v}'`)) throw new Error('VERSION not stamped');
console.log(`stamped v${pkg.version} (${v}) into ${path.relative(root, out) || out}: ${n} page assets, ${m} imports`);
