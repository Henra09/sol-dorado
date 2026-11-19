// Traffic AI: civilian cars driving the road grid, stopping at intersections,
// avoiding cars ahead, and turning at junctions.

import { G } from '../core/state.js';
import { ROADS_V, ROADS_H, ROAD_W, TILE, MW, MH } from '../data/city-map.js';
import { createVehicle } from '../entities/vehicle.js';

const LANE_OFFSET = 8;

// A car drives along a road (axis + coordinate) in a direction, picking new
// roads at intersections. right-hand traffic: offset to the right of centre.
export function createTrafficCar(world, spawnNear, radius) {
  const spot = pickLaneSpot(spawnNear, radius);
  if (!spot) return null;
  const kinds = ['sedan', 'sedan', 'sport', 'taxi', 'van', 'sedan'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const v = createVehicle(spot.x, spot.y, spot.angle, kind, { ai: spot.ai });
  v.driver = 'ai';
  v.speed = 120 + Math.random() * 60;
  return v;
}

function pickLaneSpot(near, radius) {
  const roads = [];
  for (const r of ROADS_V) roads.push({ axis: 'v', c: (r + ROAD_W / 2) * TILE });
  for (const r of ROADS_H) roads.push({ axis: 'h', c: (r + ROAD_W / 2) * TILE });
  const candidates = roads.filter(rd => rd.axis === 'v'
    ? Math.abs(rd.c - near.x) < radius
    : Math.abs(rd.c - near.y) < radius);
  for (let i = 0; i < 12; i++) {
    const rd = candidates[Math.floor(Math.random() * candidates.length)];
    if (!rd) return null;
    if (rd.axis === 'v') {
      const dir = Math.random() < 0.5 ? 1 : -1;    // +1 down, -1 up
      const y = near.y + (Math.random() * 2 - 1) * radius * 0.5;
      if (y < TILE * 2 || y > 94 * TILE) continue;
      const x = rd.c + dir * -1 * LANE_OFFSET;     // right-hand side
      return { x, y, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, ai: { axis: 'v', roadC: rd.c, dir, lane: LANE_OFFSET } };
    } else {
      const dir = Math.random() < 0.5 ? 1 : -1;    // +1 right, -1 left
      const x = near.x + (Math.random() * 2 - 1) * radius * 0.5;
      if (x < TILE * 2 || x > 90 * TILE) continue;
      const y = rd.c + dir * LANE_OFFSET;
      return { x, y, angle: dir > 0 ? 0 : Math.PI, ai: { axis: 'h', roadC: rd.c, dir, lane: LANE_OFFSET } };
    }
  }
  return null;
}

const INTERSECTIONS = [];
for (const rv of ROADS_V) for (const rh of ROADS_H) INTERSECTIONS.push({ x: (rv + ROAD_W / 2) * TILE, y: (rh + ROAD_W / 2) * TILE });

export function updateTraffic(dt, world) {
  for (const v of G.vehicles) {
    if (v.driver !== 'ai' || v.wrecked) continue;
    const ai = v.ai;
    if (v.pinned && v.ai) {
      // staged cars: hold lane and cruise
      if (v.ai.axis === 'v') v.y += v.ai.dir * v.speed * dt;
      else v.x += v.ai.dir * v.speed * dt;
      continue;
    }
    if (!ai) continue;

    const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
    const sensorDist = 46 + Math.abs(v.speed) * 0.22;
    const sx = v.x + fx * sensorDist, sy = v.y + fy * sensorDist;

    // Car ahead?
    let blocked = false;
    for (const o of G.vehicles) {
      if (o === v || o.wrecked && false) continue;
      if (o === v) continue;
      const dx = o.x - v.x, dy = o.y - v.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(dx * fy - dy * fx);
      if (along > 0 && along < sensorDist && side < 16) { blocked = true; break; }
    }
    // Player car / player on foot ahead?
    const p = G.player;
    if (p && p.inCar !== v) {
      const dx = p.x - v.x, dy = p.y - v.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(dx * fy - dy * fx);
      if (along > 0 && along < sensorDist && side < 16) blocked = true;
    }

    // Traffic light logic: stop before intersections alternating NS/EW by a global phase.
    let lightStop = false;
    const near = nearestIntersection(v.x, v.y, 60);
    if (near) {
      const phase = Math.floor(G.time / 6) % 2;
      const goAxis = phase === 0 ? 'v' : 'h';
      if (ai.axis !== goAxis) {
        const distToCentre = ai.axis === 'v' ? Math.abs(v.y - near.y) : Math.abs(v.x - near.x);
        if (distToCentre > 46 && distToCentre < 66) lightStop = true;
      }
    }

    if (blocked || lightStop) {
      v.speed = Math.max(0, v.speed - 320 * dt);
      v.brake = true;
    } else {
      v.brake = false;
      const cruise = 150 + (v.id % 5) * 20;
      v.speed = Math.min(cruise, v.speed + 140 * dt);
    }

    // Keep to lane centre.
    if (ai.axis === 'v') {
      const targetX = ai.roadC - ai.dir * ai.lane;
      const err = targetX - v.x;
      v.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      v.x += err * Math.min(1, dt * 4);
    } else {
      const targetY = ai.roadC + ai.dir * ai.lane;
      const err = targetY - v.y;
      v.angle = ai.dir > 0 ? 0 : Math.PI;
      v.y += err * Math.min(1, dt * 4);
    }

    // Advance along road.
    const spd = v.speed;
    if (ai.axis === 'v') v.y += ai.dir * spd * dt; else v.x += ai.dir * spd * dt;
    v.vx = fx * spd; v.vy = fy * spd;

    // Turn at intersections occasionally.
    if (near && Math.random() < dt * 0.5 && !blocked) {
      tryTurn(v, ai, near);
    }

    // Recycle far away cars.
    if (spawnFarFromPlayer(v)) v.respawn = true;
  }
}

function nearestIntersection(x, y, maxDist) {
  let best = null, bd = maxDist * maxDist;
  for (const it of INTERSECTIONS) {
    const d = (it.x - x) ** 2 + (it.y - y) ** 2;
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

function tryTurn(v, ai, near) {
  // Choose a new axis/direction, snap to the new lane.
  const goVert = ai.axis === 'h';
  const newDir = Math.random() < 0.5 ? 1 : -1;
  if (goVert) {
    ai.axis = 'v'; ai.dir = newDir; ai.roadC = near.x; ai.lane = LANE_OFFSET;
    v.y = near.y;
  } else {
    ai.axis = 'h'; ai.dir = newDir; ai.roadC = near.y; ai.lane = LANE_OFFSET;
    v.x = near.x;
  }
}

function spawnFarFromPlayer(v) {
  const p = G.player;
  if (!p) return false;
  const t = p.inCar || p;
  return Math.hypot(v.x - t.x, v.y - t.y) > 1500;
}
