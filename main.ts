// Hand-in script for this entry.
//
// What an entry is: game/ holds the playable game as plain static files (game/index.html at the
// root, its scripts and assets, any library vendored under game/) and screenshots/ holds the PNG
// or JPEG renders, first by name being the cover. This script stages both into the hand-in
// directory and asks the vendored make.fun library to build dossier.json, the summary the scorer
// reads. Plain TypeScript on Node 22: no flags, no build, no install.
//
// The grader runs this with /output as the destination; anywhere else, point MAKEFUN_OUTPUT_DIR
// there. Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file sits; game/ and screenshots/ are staged from beside it.
const root = fileURLToPath(new URL('.', import.meta.url));

// The grader's stand-in for /output.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });

// Stage the game itself.
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });

// Stage the screenshots when the repo has any (buildDossier refuses an entry without them).
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, straight from its gate (reference/gate.json). Only text_max_bytes shapes the
// dossier's bytes; the rest refuse here what the scorer would refuse there:
//   - at most 4 screenshots, each at most 256 KiB
//   - at most 993 entries under game/ (the platform caps /output at 1000 entries and game/ counts
//     alongside screenshots/ and dossier.json) totalling at most 48 MiB
//   - no path under game/ longer than 1000 bytes
const gate = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1000,
} as const;

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, gate));
console.log('handed in: ' + outDir);
