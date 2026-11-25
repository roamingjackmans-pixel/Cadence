# Cadence

A neon 2D souls-like where every enemy fights to its own rhythm. Play it at **https://josephjackman.com/games/Cadence/**.

Every strike is one of three, and each has two answers:

| Strike | Colour | Answer |
| :- | :- | :- |
| Slash | red | duck or block |
| Sweep | yellow | jump or block |
| Slam | purple | step aside or block |

Your guard can't take two strikes closer than a quarter second, so fast pairs make you mix a block with a duck, a
jump or a step (jump the first sweep, block the second on the way down). Answers fill the enemy's poise; fill it and
finish it with a power strike, which hits harder the heavier and better your sword. Once an enemy is close enough to strike you are locked in until the fight ends: no running away.

Twelve zones, from the Verdant Circuit to the Heart of the Circuit, each end in a third-person duel with a warden,
each harder than the last. Beat one and the way on to the next zone opens beyond its arena.

## Controls

| | Keyboard | Gamepad |
| :- | :- | :- |
| Move, aim | A / D | left stick |
| Jump | W, Space | A |
| Small jump | tap W | RT |
| Drop through a floor | S + W | down + A |
| Duck | S | RB |
| Block | J | LB |
| Step aside | L, Shift | LT |
| Strike | K | X |
| Heal | H | Y |
| Interact | E | A |
| Pause | Esc | Start |
| Answer hints | I | Back |

In a fight, or within about 15 ft of an enemy, every jump is the small one. With an attacker on each side, hold the stick toward the one you block. Duck, jump and step work against both.

## Running it locally

Plain ES modules, no build step:

```powershell
npm run serve
```

then open http://localhost:8765. Run `npm install` once for the tools (Playwright).

## Deploying

Push to `main`. [.github/workflows/ready.yml](.github/workflows/ready.yml) runs `npm test` (the conductor fuzz
test and `tools/check-levels.mjs`, which walks every zone and fails if anything can't be reached), builds `_site/` with `tools/stamp.mjs` (a version stamp and `?v=<commit>` on every URL, so browsers never mix a
cached file with a new one), plays that build headlessly with `tools/smoke.mjs`, and only then moves the `ready`
branch to that commit. The games site ([roamingjackmans-pixel/games](https://github.com/roamingjackmans-pixel/games))
picks up new `ready` commits within 10 minutes, builds them with `tools/stamp-build.mjs` and publishes them at
https://josephjackman.com/games/Cadence/. `/Cadence/`, `/cadence/` and `/games/cadence/` redirect there.

`tools/perf*.mjs` are the frame-time benchmarks and `tools/shots.mjs` screenshots a few scenes.

See [docs/DESIGN.md](docs/DESIGN.md) for the rules and the decisions behind them.
