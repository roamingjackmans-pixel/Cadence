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
back). Full poise, or no health left, breaks it and opens it to a power strike **(owner)**: every cut of one swing at
four times its damage (`powerDmg` in `src/data.js`), so heavier and better swords hit harder. Health left after it and
the foe staggers and recovers with no poise; none and it dies, or a warden's phase ends. At the start the Monolith
ends a phase of the Twin Dancer in one power strike, the Twin Fangs and the Arming Sword in about two.
Poise drains after 1.6 s without gains, and fast when you back away **(owner)**.

After each opening the next combo follows quickly **(owner)**: the pause before it is a little over half of each
foe's rest (`COMBO_REST` in `src/data.js`).

Striking an enemy outside its opening is guarded: a little poise for it, more for you, and it may punish.

You have no stamina, only poise **(owner)**: blocks and guarded hits fill it; full poise stuns you for 0.9 s.

## RPG

Levels and stats **(owner)**: echoes (dropped by enemies) buy levels at beacons. Stats: Vitality (+9 health), Guard
(blocks fill your poise 4% less), Strength and Finesse (damage scaling), Focus (timing windows 1.5% wider). Die and your
echoes stay where you fell; reach them to take them back, die first and they are gone. Resting at a beacon heals,
refills flasks (none to start with: one per Lumen Shard) and brings every enemy back. Beacons let you travel between them.

Swords **(owner)**: each class has block windows per strike and evade windows per move (`src/data.js` WEAPONS):

| Sword | Class | Strong at | Weak at |
| :- | :- | :- | :- |
| Arming Sword | Longsword | even | nothing |
| Monolith | Greatsword | blocking sweeps and slams; blocks cost less poise | ducking, jumping, stepping |
| Twin Fangs | Twinblades | ducking, jumping, stepping; perfect evades sharpen focus | blocking |
| Nightedge | Katana | perfect deflects (wide window), riposte | sweeps and slams a little |
| Crescent | Sabre (boss reward) | blocking slashes, jumping | blocking sweeps |

Each warden after the first drops a sword of its own (Undertow, Glasspin, Anvilheart, Rimefangs, Cobalt Verdict,
Ashen Thread, Saint's Mercy, Thornbrand, Sovereign Pair, Hollow Crown, The First Measure). Each sword can be reforged
to +5 with echoes.

## The zones

Twelve zones, each ending in a warden, each warden harder than the last **(owner)**. They run in a line: beat a
warden and a second door at the far side of its arena opens onto a passage into the next zone; the passage at a zone's
start leads back. Beacons in every zone you have lit are on the travel list. Each zone has its own neon (greens,
teals, blues and whites: never red, yellow or purple), its own skyline, its own key and tempo for the music, and its
own enemies, which hit harder and come a little faster zone by zone (`foeDef` in `src/zones.js`).

| | Zone | Warden |
| :- | :- | :- |
| 1 | The Verdant Circuit | The Twin Dancer |
| 2 | The Sunken Relay | The Drowned Herald |
| 3 | The Glasswork Spires | The Glass Duchess |
| 4 | The Hollow Foundry | The Forge Colossus |
| 5 | The Frostline Array | The Frost Regent |
| 6 | The Cobalt Depths | The Cobalt Executioner |
| 7 | The Ashen Lattice | The Ashen Weaver |
| 8 | The Tidewater Cloister | The Cloister Saint |
| 9 | The Overgrowth | The Thorned Knight |
| 10 | The Azure Reach | The Azure Sovereign |
| 11 | The Null Expanse | The Hollow King |
| 12 | The Heart of the Circuit | The Conductor |

The Verdant Circuit is the largest **(owner: much larger)**: the first part as drawn by hand (Boot Chamber, Sentinel
Walk with its shortcut gate, Lower Galleries, the Monolith vault, Junction, the Spans and the Undercroft), then the
Overpass, Signal Gardens, the Deep Relay, Relay Depths and the Lantern Stair before the Antechamber. The other zones are
lists of named areas in `src/zones.js`, each built from segments in `src/level.js` (corridors, stairs, pits, climbs,
drops, a vault above the corridor, a passage under it, an ambush ledge). The segments keep the movement rules: ledges
3 rows apart, 1-tile steps, 3-wide pits, no enemy within 8 tiles of a pit (near an enemy every jump is a hop).
`tools/check-levels.mjs` (part of `npm test`) walks every zone and fails if any beacon, item, arena or passage can't
be reached from the zone's first beacon, or can't be left again.

Enemies: Grid Sentinel, Shardling, Mirror Duelist, Hammerframe, and beyond the first zone the Spire Lancer (long
reach, slams), Flicker (fast pairs), Bastion Warden (heavy) and Echo Blademaster (long phrases).

## The wardens

At the arena door you walk in and stop, and the camera takes over with no cut or fade **(owner)**: the opening shot
starts on the very frame you were looking at, then the play area turns away like a stage flat while the neon arena
comes up around you both. Over about six seconds the camera turns slowly from side-on, keeping you in frame, until it
is behind you with the warden ahead, and lands on the 1v1 view as in the prototype (A, X or E skips it). Incoming
strikes fly in from behind the warden as coloured blades showing their path. Each phase ends when its health is gone: power strikes after poise breaks do most of it. No music
chart: each warden's timing is its own **(owner)**. A/D (or LT with the stick) step left and right.

The Twin Dancer (first written by hand) has three phases. Each later warden gets more health and poise, hits harder,
and has faster beats, longer phrases with more fast follow-ups, shorter openings and less warning before each strike
(`bossDef` in `src/zones.js`); wardens 8 to 11 have four phases and the Conductor five. Each favours some strikes
(the Herald slams, the Duchess slashes, the Regent sweeps). Their phrases are made from a seed, and every one is
checked to be answerable on its own.

## Controls

The run is a ninja sprint **(owner: faster, as lively as the step)**: leaned hard forward, the blade trailing low
behind, four keys blended smoothly at 2.4 strides a second, and a short streak of afterimages at speed. The jump is a split
leap: a small rise and the legs thrown into the splits, with the step's afterimages; so is the duck.

Gamepad: the combat buttons are LT step, LB block, RB duck, A jump, X strike **(owner)**; Y heals, the left stick moves and aims. A also interacts (beacons, doors) when nothing is attacking you. RT is a small jump, a fixed hop just onto a block, and answers a sweep like any jump **(owner)**. The tall jump is only for getting around: in a fight, or within about 15 ft (155 px) of a living enemy, every jump is the small one **(owner)**. The step is a planted lean back, not a hop **(owner)**.

You can't push enemies around **(owner)**: they close to their fighting distance and hold their ground, walking into one only stops you, and a FLAWLESS phrase staggers the attacker in place (open, with bonus poise) instead of knocking it back.

A new game opens with a quick tutorial in the Boot Chamber **(owner)**: move, jump, then a harmless training echo throws slashes, sweeps and slams until each is answered twice in a row, a fast pair of sweeps (jump, then block on the way down), and a poise break ending in a power strike. Walking past the chamber or Skip in the pause menu ends it.
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
