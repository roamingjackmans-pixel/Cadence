// Frame-time benchmark. Plays scripted scenes with the CPU throttled and prints update/render costs.
//   node tools/perf.mjs [url] [throttle]
// Uses the Playwright install in C:\dev\DungeonJoe (or PLAYWRIGHT_DIR).
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8765/';
const throttle = +(process.argv[3] || 4);
const soft = process.argv.includes('--soft');
const browser = await chromium.launch({ args: soft ? ['--disable-gpu', '--disable-accelerated-2d-canvas'] : ['--use-gl=angle', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
const cdp = await page.context().newCDPSession(page);
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__cadence);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scene(name, setup, ms = 6000) {
  await page.evaluate(setup);
  await sleep(800);
  await page.evaluate(() => window.__cadence.perf(true));
  await sleep(ms);
  const p = await page.evaluate(() => window.__cadence.perf());
  console.log(`${name.padEnd(22)} update ${String(p.update.avg).padStart(5)}ms (p95 ${p.update.p95})  render ${String(p.render.avg).padStart(5)}ms (p95 ${p.render.p95})  frame ${p.frame.avg}ms (p95 ${p.frame.p95})  q=${p.q} parts=${p.particles}`);
  return p;
}

console.log(`CPU throttle ${throttle}x, 1280x720 @1.5x`);
await scene('title', () => {});
await scene('explore (walk right)', () => {
  const g = window.__cadence; g.newGame(); const w = g.world;
  w.enemies.forEach((e) => { e.dead = true; });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
});
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })));
await scene('fight, galleries', () => {
  const g = window.__cadence; g.world.spawn('b1'); const w = g.world; w.autoplay = true;
  w.p.x = 66 * 32; w.p.y = 42 * 32;
}, 8000);
await scene('fight, two-sided', () => {
  const g = window.__cadence; g.world.spawn('b2'); const w = g.world; w.autoplay = true;
  w.p.x = 163 * 32; w.p.y = 34 * 32;
}, 8000);
await scene('boss duel', () => {
  const g = window.__cadence; g.autoplay = true; g.world.p.x = 214 * 32; g.world.p.y = 34 * 32; g.startBoss(); g.boss.skipIntro = true;
}, 10000);
await browser.close();
