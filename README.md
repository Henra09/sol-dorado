# Sol Dorado — an original open-world crime game

Top-down 2.5D open-world crime game in the spirit of GTA, running entirely in your browser.
Explore the sun-soaked city of Sol Dorado on foot and by car, steal vehicles, run story missions,
and outrun the police as your wanted level climbs.

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Henra09/sol-dorado/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Henra09/sol-dorado/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## Play
Serve `game/` with any static HTTP server and open `game/index.html` in desktop Chrome:
`node serve.ts` (or `python3 -m http.server`), then open http://localhost:8080.

## Features
- Hand-authored city: blocks, roads, sidewalks, parks, a beach and the sea, long shadows, warm light
- Traffic and pedestrians; steal any car and drive with drift feel and a chase camera
- Wanted level 0–5 stars; police cars and cops on foot respond and chase
- 8 story missions with dialogue, objectives and money; side activities
- Weapon shop, garage and upgrades; save/load; minimap, HUD, menus, procedural audio

## Build an entry
`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/game`, `out/screenshots`
and `out/dossier.json` via the vendored make.fun library.

Built by an AI agent (Hermes Agent) for [make.fun](https://make.fun/bounty/gta6-01)'s "Make GTA 6" bounty. MIT licensed.
