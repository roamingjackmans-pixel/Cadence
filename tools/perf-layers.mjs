// Which layer of the side view costs the most to rasterise? Turns layers off one at a time (software canvas).
//   node tools/perf-layers.mjs [url] [throttle]
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || 'C:/dev/DungeonJoe') + '/package.json');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-accelerated-2d-canvas'] });
const hi = process.argv.includes('--hi');
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: hi ? 1.5 : 1 });
const cdp = await page.context().newCDPSession(page);
await page.goto(url + (hi ? '#hi' : ''));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cadence-settings', JSON.stringify({ quality: location.hash === '#hi' ? 'high' : 'low' })); });
await page.reload();
await page.waitForFunction(() => window.__cadence);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[3] || 4) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.evaluate(() => { const g = window.__cadence; g.newGame(); const w = g.world; w.p.x = 30 * 32; w.p.y = 30 * 32; w.enemies.forEach((e) => { if (e.type !== 'sentinel') e.dead = true; }); });
async function run(name, js) {
  await page.evaluate(js);
  await sleep(600); await page.evaluate(() => window.__cadence.perf(true)); await sleep(3000);
  const p = await page.evaluate(() => window.__cadence.perf());
  console.log(`${name.padEnd(16)} frame ${String(p.frame.avg).padStart(6)}ms  js ${(p.update.avg + p.render.avg).toFixed(2)}ms`);
}
await run('all', () => {});
await run('no beams', () => { const a = window.__cadence.world.art; const c = document.createElement('canvas'); c.width = 1; c.height = 1; a.pylons.forEach((p) => { p._b = p.beam; p.beam = c; }); });
await run('no pylons', () => { const a = window.__cadence.world.art; a._py = a.pylons; a.pylons = []; });
await run('far as fill', () => { const a = window.__cadence.world.art; a.pylons = a._py; a._far = a.far; const c = document.createElement('canvas'); c.width = 4; c.height = 4; a.far = c; a.drawBGx = a.drawBG; a.drawBG = function (ctx, x, y) { ctx.fillStyle = '#021008'; ctx.fillRect(0, 0, 1920, 1080); const f = this.far; this.far = { width: 1e9 }; try { this.drawBGx(ctx, x, y); } catch (e) {} this.far = f; }; });
await run('no bg', () => { const a = window.__cadence.world.art; a._bg = a.drawBG; a.drawBG = (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720); }; });
await run('no bg, tiles', () => { const a = window.__cadence.world.art; a._t = a.drawTiles; a.drawTiles = () => {}; });
await run('no bg,tiles,vig', () => { const a = window.__cadence.world.art; a._v = a.vig; a.vig = document.createElement('canvas'); });
await run('+ no figures', () => { const w = window.__cadence.world; w.drawPlayer = () => {}; w.drawEnemy = () => {}; });
await run('+ no hud', () => { const w = window.__cadence.world; w.drawHUD = () => {}; });
await browser.close();
