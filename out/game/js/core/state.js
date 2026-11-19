// Central game state: one mutable object every system reads and writes.

import { WORLD_W, WORLD_H } from '../data/city-map.js';

export const G = {
  mode: 'title',            // title | play | paused | gameover-ish overlays
  time: 0,                  // seconds since play started
  viewW: 1280, viewH: 720,

  player: null,
  vehicles: [],
  peds: [],
  cops: [],                 // police cars
  footCops: [],
  bullets: [],
  particles: [],
  skids: [],

  wanted: 0,                // 0..5
  wantedHeat: 0,            // float decay meter
  money: 250,
  weapons: { fists: { ammo: Infinity } },
  weapon: 'pistol',
  armour: 0,

  mission: null,            // active mission state from systems/missions.js
  missionsDone: [],
  sideJob: null,
  dialogue: null,           // {who, text, until}

  objective: 'Welcome to Sol Dorado',
  missionTimer: 0,

  stats: { kills: 0, carsStolen: 0, racesWon: 0 },
  cheatFly: false,

  shake: 0,
  hitFlash: 0,
  colourGrade: 1,

  spawnedShots: 0,
};

export function clampWorld(p) {
  p.x = Math.max(8, Math.min(WORLD_W - 8, p.x));
  p.y = Math.max(8, Math.min(WORLD_H - 8, p.y));
}

export function setDialogue(who, text, secs = 4) {
  G.dialogue = { who, text, until: G.time + secs };
}

export function addShake(n) { G.shake = Math.min(24, G.shake + n); }
