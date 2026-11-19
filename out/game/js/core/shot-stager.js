// Stager: deterministic scenes for screenshot capture via ?shot=<name>.
// Renders the REAL game with forced state (positions, wanted level, mission),
// advanced a fixed number of frames so traffic/particles settle.

import { G, clampWorld } from './state.js';
import { createPlayer, giveWeapon } from '../entities/player.js';
import { enterCar } from '../entities/player.js';
import { createVehicle } from '../entities/vehicle.js';
import { createPed } from '../entities/pedestrian.js';
import { PLACES, TILE, tileCenter } from '../data/city-map.js';
import { raiseWanted } from '../systems/police.js';
import { startMission } from '../systems/missions.js';

const SHOTS = {
  cover: {
    setup(world, game) {
      // Sunlit coast boulevard: player driving south, sea to the right, cops behind.
      const px = (74 + 1.5) * TILE, py = 56 * TILE;
      const p = createPlayer(px, py);
      G.player = p;
      const car = createVehicle(px, py - 120, Math.PI / 2, 'sport', { color: '#e8b23c' });
      G.vehicles.push(car);
      enterCar(p, car);
      car.speed = 210;
      car.justStolen = false;
      car.pinned = false;
      car.ai = { axis: 'v', roadC: 74 * TILE + TILE * 1.5, dir: 1, lane: 10 };
      // keep the shot's player car rolling: no throttle input arrives, so stage a cruise flag
      car.cruise = true;
      // three pursuers in trail, lane-locked straight south so the shot stays composed
      const copLane = { axis: 'v', roadC: 74 * TILE + TILE * 1.5, dir: 1, lane: 10 };
      for (let i = 0; i < 3; i++) {
        const cop = createVehicle(copLane.roadC - 10, py - 180 - i * 130, Math.PI / 2, 'police');
        cop.driver = 'police'; cop.siren = true; cop.speed = 190;
        cop.pinned = true;
        G.vehicles.push(cop); G.cops.push(cop);
      }
      // traffic ahead in the same lanes
      for (let i = 0; i < 4; i++) {
        const t2 = createVehicle(px, py + 280 + i * 180, Math.PI / 2, i % 2 ? 'taxi' : 'sedan');
        t2.driver = 'ai'; t2.speed = 130;
        t2.pinned = true;
        G.vehicles.push(t2);
      }
      const cross = createVehicle(70 * TILE, 53 * TILE + 14, 0, 'sedan');
      cross.driver = 'ai'; cross.speed = 120; G.vehicles.push(cross);
      seedTrafficAndPeds(world, { x: px, y: py + 150 });
      G.wanted = 3; G.wantedHeat = 1;
      G.money = 4820;
      G.objective = 'Reach the marina drop before the Del Oro crew finds the car';
      G.dialogue = { who: 'ROSALIA', text: 'Three cars behind you. Do not stop for anyone.', until: G.time + 999 };
      G.time = 200;
      G.weapon = 'smg';
      G.weapons.smg = { ammo: 74 };
      p.health = 78; G.armour = 55;
      return { camAt: { x: px + 130, y: py - 20 }, frames: 90 };
    },
  },
  'on-foot': {
    setup(world, game) {
      const spot = PLACES.diner;
      const p = createPlayer(spot.x * TILE + 60, spot.y * TILE + 60);
      G.player = p;
      p.aimAngle = -0.3;
      giveWeapon('pistol', 48);
      seedTrafficAndPeds(world, spot);
      G.time = 140;
      return { camAt: { x: p.x + 40, y: p.y }, frames: 60 };
    },
  },
  mission: {
    setup(world, game) {
      const def = STORY_AT(1);
      const spot = PLACES[def.giver];
      const p = createPlayer(spot.x * TILE + 120, spot.y * TILE + 20);
      G.player = p;
      giveWeapon('pistol', 48);
      seedTrafficAndPeds(world, spot);
      startMission(def);
      // jump dialogue ahead so one line is showing
      G.dialogue = { who: 'ROSALIA', text: 'Three deadbeats owe the diner money. They suddenly love the beach.', until: G.time + 999 };
      G.time = 300;
      return { camAt: { x: p.x, y: p.y }, frames: 60 };
    },
  },
};

function STORY_AT(i) {
  // avoid circular import of STORY list at module init; re-fetch lazily
  return window.__storyList ? window.__storyList[i] : null;
}

function seedTrafficAndPeds(world, spot) {
  // Ask the spawner to fill the area: simulate spawn ticks by direct calls.
  const { spawnBatchForShot } = window.__spawnerHooks || {};
  if (spawnBatchForShot) spawnBatchForShot({ x: spot.x * TILE, y: spot.y * TILE }, world);
}

export function applyShotParam(game, world) {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot');
  if (!name || !SHOTS[name]) return null;
  // Give missions access to story data without circular imports at load.
  import('../data/missions.js').then(m => { window.__storyList = m.STORY; });
  const cfg = SHOTS[name];
  // run setup synchronously after story list is available
  return new Promise(resolve => {
    import('../data/missions.js').then(m => {
      window.__storyList = m.STORY;
      const r = cfg.setup(world, game) || {};
      resolve(r);
    });
  });
}
