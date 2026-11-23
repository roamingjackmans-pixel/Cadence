// The games site (roamingjackmans-pixel/games, deploy/assemble.mjs) builds every game with
//   node tools/stamp-build.mjs <publish dir> <commit>
// run in a fresh clone of the `ready` branch, then puts <publish dir> online at /games/Cadence/.
// Cadence's build is tools/stamp.mjs, which takes the same arguments.
import './stamp.mjs';
