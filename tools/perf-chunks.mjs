// Time to paint level chunks (software canvas, no throttle): node tools/perf-chunks.mjs [url]
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-accelerated-2d-canvas'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.argv[2] || 'http://127.0.0.1:8765/');
await page.waitForFunction(() => window.__cadence);
const r = await page.evaluate(() => {
  const g = window.__cadence; g.newGame(); const a = g.world.art; const out = {};
  for (const q of [1, 1.5]) {
    a.q = 0; a.setScale(q);
    const t0 = performance.now(); let n = 0;
    for (let j = 0; j < a.chh; j++) for (let i = 0; i < a.cw; i++) { const c = a.chunk(i, j); if (c && c !== 'solid') n++; }
    const ms = performance.now() - t0;
    // force rasterisation of the recorded drawing by reading one pixel of each canvas
    const t1 = performance.now();
    for (const c of a.chunks.values()) if (c && c !== 'solid') c.getContext('2d').getImageData(0, 0, 1, 1);
    out[q] = { canvases: n, recordMs: +ms.toFixed(1), rasterMs: +(performance.now() - t1).toFixed(1), perChunk: +((ms + performance.now() - t1) / n).toFixed(2) };
  }
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
