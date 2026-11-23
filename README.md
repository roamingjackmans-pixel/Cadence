# Cadence

A neon 2D souls-like where every enemy fights to its own rhythm. Play it at **https://josephjackman.com/Cadence/**.

Every strike is one of three, and each has two answers:

| Strike | Colour | Answer |
| :- | :- | :- |
| Slash | red | duck or block |
| Sweep | yellow | jump or block |
| Slam | purple | step aside or block |

Your guard can't take two strikes closer than a quarter second, so fast pairs make you mix a block with a duck, a
jump or a step (jump the first sweep, block the second on the way down). Answers fill the enemy's poise; fill it and
finish it with a lethal strike. Back away and its poise drains.

The first area, the Verdant Circuit, ends in a third-person duel with the Twin Dancer.

## Controls

| | Keyboard | Gamepad |
| :- | :- | :- |
| Move, aim | A / D | left stick |
| Jump | W, Space | A |
| Duck | S | RB |
| Block | J | LB |
| Step aside | L, Shift | LT |
| Strike | K | X |
| Heal | H | Y |
| Interact | E | A |
| Pause | Esc | Start |
| Answer hints | I | Back |

With an attacker on each side, hold the stick toward the one you block. Duck, jump and step work against both.

## Running it locally

Plain ES modules, no build step:

```powershell
npm run serve
```

then open http://localhost:8765. Run `npm install` once for the tools (Playwright).

## Deploying

Push to `main`. [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs `npm test` (the conductor fuzz
test), builds `_site/` with `tools/stamp.mjs` (a version stamp and `?v=<commit>` on every URL, so browsers never mix a
cached file with a new one), plays that build headlessly with `tools/smoke.mjs`, and only then publishes it to
https://josephjackman.com/Cadence/. `/games/cadence/` and `/cadence/` redirect there.

`tools/perf*.mjs` are the frame-time benchmarks and `tools/shots.mjs` screenshots a few scenes.

See [docs/DESIGN.md](docs/DESIGN.md) for the rules and the decisions behind them.
