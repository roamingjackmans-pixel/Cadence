# Cadence: design

The game as it is now. The owner's answers that shaped the first draft (2026-11-23) are marked **(owner)**.

## Feel

A 2D side-scrolling souls-like in the mould of Salt and Sanctuary, with the combat of the Blade Cadence prototype:
the fight is a dance, a rhythm between the enemy and you. Tron look: black, neon lines, green to start. Red, yellow and
purple belong to the attacks only, so the world never uses them **(owner)**.

## Strikes

| Strike | Colour | Valid answers | Shape on the pip |
| :- | :- | :- | :- |
| Slash | red `#ff3b4e` | duck, block | line high |
| Sweep | yellow `#ffd83a` | jump, block | line low |
| Slam | purple `#b44dff` | step aside, block | arrow down |

No thrust (the prototype's stab is gone) **(owner)**. Every enemy uses all three.

- Block is a tap with a timing window, not a hold **(owner)**. Perfect = deflect, good = block (fills your poise).
- The guard can't take two strikes closer than `FAST_PAIR` = 0.25 s. In the air only a block works. A jump keeps you up
  `JUMP_AIR` = 0.6 s. So two fast sweeps = jump the first, block the second coming down **(owner)**.
- Step aside in the side view is a depth step into the background plane: you keep your spacing **(owner)**.
- Pressing with nothing to answer: blocks lock you for 0.2 s (no spamming the guard).

## Reading the rhythm

Cadence pips **(owner)**: each attacker has a track above its head; pips for its next strikes slide toward the beat
marker nearest you and arrive as the strike lands (1.5 s lead). The blade also glows the strike's colour through the
wind-up. `I` toggles answer hints (on by default).

## Two attackers

At most one attacker on each side of you; everyone else hangs back **(owner)**. A conductor (`src/combat.js`) fits
every phrase in so the merged strikes from both sides can always be answered perfectly: no two strikes closer than
0.2 s, and some sequence of answers exists under the air and fast-pair rules (`survivable`). When it can't fit a
phrase it slides it later, then softens sweeps and slams into slashes.

Block faces the attacker the stick (or A/D) points at; duck, jump and step work against both **(owner)**.

## Poise and death

Sekiro rules **(owner)**: your strikes in an enemy's opening (the recovery after each phrase) take health; your answers
fill its poise (deflect 7.5, perfect evade 9.75, block 2.5, evade 3.25, a whole phrase perfect +10 and it is thrown
back). Full poise, or no health left, breaks it: a lethal strike kills a regular enemy outright. The boss needs three.
Poise drains after 1.6 s without gains, and fast when you back away **(owner)**.

Striking an enemy outside its opening is guarded: a little poise for it, more for you, and it may punish.

You have no stamina, only poise **(owner)**: blocks and guarded hits fill it; full poise stuns you for 0.9 s.

## RPG

Levels and stats **(owner)**: echoes (dropped by enemies) buy levels at beacons. Stats: Vitality (+9 health), Guard
(blocks fill your poise 4% less), Strength and Finesse (damage scaling), Focus (timing windows 1.5% wider). Die and your
echoes stay where you fell; reach them to take them back, die first and they are gone. Resting at a beacon heals,
refills flasks (3, plus one per Lumen Shard) and brings every enemy back. Beacons let you travel between them.

Swords **(owner)**: each class has block windows per strike and evade windows per move (`src/data.js` WEAPONS):

| Sword | Class | Strong at | Weak at |
| :- | :- | :- | :- |
| Arming Sword | Longsword | even | nothing |
| Monolith | Greatsword | blocking sweeps and slams; blocks cost less poise | ducking, jumping, stepping |
| Twin Fangs | Twinblades | ducking, jumping, stepping; perfect evades sharpen focus | blocking |
| Nightedge | Katana | perfect deflects (wide window), riposte | sweeps and slams a little |
| Crescent | Sabre (boss reward) | blocking slashes, jumping | blocking sweeps |

Each can be reforged to +3 with echoes.

## The first area

The Verdant Circuit: Boot Chamber, Sentinel Walk (a shortcut gate that opens from the far side), Lower Galleries,
the Monolith vault, Junction, the Spans (an ambush from behind), the Undercroft, the Antechamber. Enemies: Grid
Sentinel, Shardling, Mirror Duelist, Hammerframe. Built from rectangles in `src/level.js`.

## The boss

The Twin Dancer **(owner)**. At the arena door you walk in, the screen flashes, and the view moves behind you for the
1v1, as in the prototype: incoming strikes fly in from behind her as coloured blades showing their path. Three phases,
each faster; a lethal strike ends each. No music chart: her timing is her own **(owner)**. A/D (or LT with the stick)
step left and right.

## Controls

Gamepad: the combat buttons are LT step, LB block, RB duck, A jump, X strike **(owner)**; Y heals, the left stick moves and aims. A also interacts (beacons, doors) when nothing is attacking you. RT is a small jump, a fixed hop just onto a block, and answers a sweep like any jump **(owner)**. The tall jump is only for getting around: in a fight, or within about 15 ft (155 px) of a living enemy, every jump is the small one **(owner)**. The step is a planted lean back, not a hop **(owner)**.

A new game opens with a quick tutorial in the Boot Chamber **(owner)**: move, jump, then a harmless training echo throws slashes, sweeps and slams until each is answered twice in a row, a fast pair of sweeps (jump, then block on the way down), and a poise break ending in a lethal strike. Walking past the chamber or Skip in the pause menu ends it.
Keyboard: A/D move, W/Space jump, S duck, J block, K strike, L/Shift step, H heal, E interact.

## Sound

Synthesised: a moody synthwave loop while exploring, a driving track for the boss that builds each phase, effects for
every answer.

## Performance

Measured with `tools/perf.mjs` (Playwright, CPU throttled). Rules that keep it fast:

- Nothing big is drawn scaled or at a sub-pixel offset: level chunks, the backdrop and the vignette are cached at the
  exact device scale and copied at whole-pixel offsets (the camera zoom `Z` = 1.375 keeps chunk sizes whole).
- Static caches become `ImageBitmap`s; drawing a canvas makes Chrome snapshot it each time.
- No `shadowBlur` while playing; glows are cached sprites or wide translucent strokes.
- Translucent full-screen layers are avoided: the far backdrop is opaque, the vignette only touches the edges.
- Particles come from a fixed pool. The canvas is frozen while a menu covers it.
- Resolution drops a step on its own if frames run long (Pause > Resolution to choose).

First build vs now, software canvas (no GPU), 4x CPU throttle, 1.5x resolution: about 100 ms a frame vs 17 ms.
