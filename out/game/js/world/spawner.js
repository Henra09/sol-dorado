// Spawner: keeps traffic and pedestrians alive around the player, recycles
// distant ones. Also places mission crews.

import { G } from '../core/state.js';
import { createTrafficCar } from './traffic.js';
import { createPed, pickSidewalkPoint } from '../entities/pedestrian.js';

const MAX_CARS = 18;
const MAX_PEDS = 46;

export function updateSpawner(dt, world) {
  const p = G.player;
  if (!p) return;
  const t = p.inCar || p;

  // remove wrecked/far vehicles
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v === p.inCar) continue;
    const far = Math.hypot(v.x - t.x, v.y - t.y) > 1500;
    if (v.respawn || far || (v.wrecked && Math.random() < dt * 0.4)) G.vehicles.splice(i, 1);
  }
  // remove far peds and corpses
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    const far = Math.hypot(ped.x - t.x, ped.y - t.y) > 1300;
    if (ped.dead && G.time - (ped.deadTime || 0) > 12) { G.peds.splice(i, 1); continue; }
    if (far && !ped.missionPed) G.peds.splice(i, 1);
  }

  // spawn
  const civCars = G.vehicles.filter(v => v.driver === 'ai').length;
  if (civCars < MAX_CARS && Math.random() < dt * 6) {
    const v = createTrafficCar(world, t, 900);
    if (v && !onTopOfVehicle(v)) G.vehicles.push(v);
  }
  const livePeds = G.peds.filter(pp => !pp.dead && !pp.gang).length;
  if (livePeds < MAX_PEDS && Math.random() < dt * 9) {
    const pt = pickSidewalkPoint(t, world, 800);
    if (pt && Math.hypot(pt.x - t.x, pt.y - t.y) > 260) G.peds.push(createPed(pt.x, pt.y));
  }
}

function onTopOfVehicle(v) {
  return G.vehicles.some(o => Math.hypot(o.x - v.x, o.y - v.y) < 50);
}
