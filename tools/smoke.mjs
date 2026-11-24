// Plays the built game headlessly and fails on any error. Serves <dir> itself (default: the repo).
//   node tools/smoke.mjs [dir]
// Boots to the title, starts a new game, fights in the galleries and on the Spans with autoplay (which answers
// through the same press() path as the keys), walks into the arena and wins the duel, walks on through the far door
// into the second zone, then checks the save, and that a save from before the zones still loads.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
const step = (s) => console.log('· ' + s);
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__cadence && document.getElementById('ver').textContent, null, { timeout: 15000 });
  step('title, ' + (await page.textContent('#ver')));
  await page.click('#btnNew');
  await page.waitForFunction(() => window.__cadence.scene === 'world');
  step('new game');

  // a fight in the galleries
  await page.evaluate(() => { const w = window.__cadence.world; w.autoplay = true; w.p.x = 66 * 32; w.p.y = 42 * 32; });
  await page.waitForFunction(() => window.__cadence.save.echoes > 0, null, { timeout: 30000 });
  ok(!(await page.evaluate(() => window.__cadence.world.p.dead)), 'player died in the galleries');
  step('galleries: enemy killed, ' + (await page.evaluate(() => window.__cadence.save.echoes)) + ' echoes');

  // the ambush: two attackers at once
  await page.evaluate(() => { const g = window.__cadence; g.world.spawn('b2'); const w = g.world; w.autoplay = true; w.p.x = 160 * 32; w.p.y = 34 * 32; });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__cadence.world.attackers().length === 2, null, { timeout: 15000 });
  await page.waitForTimeout(4000);
  step('spans: two attackers, player hp ' + Math.round(await page.evaluate(() => window.__cadence.world.p.hp)));

  // the arena: walk in, then the duel
  await page.evaluate(() => { const g = window.__cadence; g.autoplay = true; const w = g.world; w.spawn('b3'); const D = w.L.bossDoor; w.p.x = D.x - 40; w.p.y = D.y1; });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__cadence.scene === 'boss', null, { timeout: 10000 });
  step('walked into the arena');
  await page.waitForFunction(() => { const b = window.__cadence.boss; if (b && b.mode === 'play') b.bossPost = Math.max(b.bossPost, 99); return window.__cadence.save.bosses.includes(1); }, null, { timeout: 60000, polling: 200 });
  await page.waitForFunction(() => window.__cadence.scene === 'world' && document.getElementById('menuPanel').innerText.includes('SECTOR CLEARED'), null, { timeout: 10000 });
  const s = await page.evaluate(() => window.__cadence.save);
  ok(s.upgrades.crescent === 0, 'no Crescent after the boss');
  step('duel won, Crescent taken, ' + s.echoes + ' echoes');

  // on through the far door into the Sunken Relay
  await page.evaluate(() => { const g = window.__cadence; g.closeMenu(); g.autoplay = false; const w = g.world; w.p.x = w.L.exits[0].x0 - 50; w.p.y = w.L.arena.floor; });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__cadence.world.zone.id === 2 && !window.__cadence.fade, null, { timeout: 10000 });
  ok(await page.evaluate(() => window.__cadence.save.zone === 2), 'zone not saved');
  step('walked on into ' + (await page.evaluate(() => window.__cadence.world.zone.name)));

  // the save survives a reload
  await page.reload();
  await page.waitForFunction(() => window.__cadence);
  ok(await page.isVisible('#btnContinue'), 'no Continue after reload');
  ok(await page.evaluate(() => window.__cadence.save.bosses.includes(1)), 'save lost on reload');
  step('save kept');

  // a save from before the twelve zones
  await page.evaluate(() => localStorage.setItem('cadence-save-v1', JSON.stringify({ v: 1, stats: { vit: 10, guard: 8, str: 9, fin: 8, focus: 8 }, echoes: 50, upgrades: { arming: 1, crescent: 0 }, equipped: 'arming', flasks: 2, flasksMax: 4, lit: ['b1', 'b2', 'b3'], beacon: 'b2', taken: ['shard1'], gateOpen: true, bossDead: true, shade: { x: 6900, y: 1088, amount: 300 }, hints: true, deaths: 3, kills: 9 })));
  await page.reload();
  await page.waitForFunction(() => window.__cadence && window.__cadence.world);
  const m = await page.evaluate(() => { const s = window.__cadence.save; return { v: s.v, gates: s.gates, bosses: s.bosses, shade: s.shade, zone: window.__cadence.world.zone.id }; });
  ok(m.v === 2 && m.gates[0] === 'gate1' && m.bosses[0] === 1 && m.shade === null && m.zone === 1, 'old save not carried over: ' + JSON.stringify(m));
  step('a save from before the zones carries over');
  ok(!errors.length, 'page errors:\n' + errors.join('\n'));
  console.log('smoke: ok');
} catch (e) {
  console.error('smoke: FAILED: ' + e.message + (errors.length ? '\npage errors:\n' + errors.join('\n') : ''));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
