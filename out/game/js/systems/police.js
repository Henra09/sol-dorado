// Police system: wanted level, patrol spawns, pursuit AI, cops on foot,
// busted/wasted states, and heat decay when hidden.

import { G, setDialogue } from '../core/state.js';
import { createVehicle } from '../entities/vehicle.js';
import { createGangPed } from '../entities/pedestrian.js';
import { TILE, ROADS_V, ROADS_H, ROAD_W } from '../data/city-map.js';
import { cam } from '../render/camera.js';

export function raiseWanted(n, reason) {
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + n);
  G.wantedHeat = 1;
  if (G.wanted > before) {
    if (reason) setDialogue('POLICE', reason, 2.5);
    G.objective = G.objective.startsWith('LOOSE') ? G.objective : `LOOSE THE HEAT (${G.wanted}\u2605) \u2014 hide until calm`;
  }
}

export function clearWanted() {
  G.wanted = 0; G.wantedHeat = 0;
  for (const c of G.cops) c.retreat = true;
  for (const c of G.footCops) c.retreat = true;
}

export function updatePolice(dt, world) {
  const p = G.player;
  if (!p) return;
  const t = p.inCar || p;

  // Heat decay: when no cop is nearby, wanted falls over time.
  if (G.wanted > 0) {
    const anyCopNear = [...G.cops, ...G.footCops].some(c => Math.hypot(c.x - t.x, c.y - t.y) < 620);
    if (!anyCopNear) {
      G.wantedHeat -= dt * 0.085;
      if (G.wantedHeat <= 0) {
        G.wanted--;
        G.wantedHeat = 1;
        if (G.wanted === 0) {
          clearWanted();
          if (G.mission && G.mission.waiting === 'survive') G.mission.stepDone = true;
          G.objective = G.mission ? G.mission.objectiveText : 'Roam Sol Dorado';
        }
      }
    } else {
      G.wantedHeat = Math.min(1, G.wantedHeat + dt * 0.25);
    }
  }

  // Spawn cops to match wanted level.
  const desiredCars = Math.min(6, G.wanted);
  const activeCops = G.cops.filter(c => !c.wrecked && !c.retreat);
  if (activeCops.length < desiredCars && Math.random() < dt * (0.6 + G.wanted * 0.25)) {
    spawnPoliceCar(world, t);
  }

  updatePoliceCars(dt, world);
  updateFootCops(dt, world);

  // Busted: player on foot near a stopped cop car with cops close and wanted>=1.
  if (!p.inCar && G.wanted >= 1) {
    const busted = G.footCops.some(c => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 26);
    if (busted) bustedScreen();
  }
  // Wasted handled by health system (combat).
}

function spawnPoliceCar(world, target) {
  // Spawn on a road off-screen toward the player.
  const ang = Math.random() * Math.PI * 2;
  const dist = 620;
  let x = target.x + Math.cos(ang) * dist, y = target.y + Math.sin(ang) * dist;
  // snap to nearest road
  let bestX = x, bestY = y;
  for (const r of ROADS_V) { const c = (r + ROAD_W / 2) * TILE; if (Math.abs(c - x) < Math.abs(bestX - x)) bestX = c; }
  for (const r of ROADS_H) { const c = (r + ROAD_W / 2) * TILE; if (Math.abs(c - y) < Math.abs(bestY - y)) bestY = c; }
  x = Math.abs(bestX - x) < Math.abs(bestY - y) ? bestX : x;
  y = x === bestX ? y : bestY;
  const v = createVehicle(x, y, Math.atan2(target.y - y, target.x - x), 'police');
  v.driver = 'police';
  v.siren = true;
  v.maxSpeed = 400;
  G.cops.push(v);
}

function updatePoliceCars(dt, world) {
  const p = G.player;
  const t = p.inCar || p;
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const v = G.cops[i];
    if (v.wrecked) continue;
    if (v.retreat || G.wanted === 0) {
      v.speed = Math.max(0, v.speed - 200 * dt);
      if (v.speed < 5) { G.vehicles.splice(G.vehicles.indexOf(v), 1); G.cops.splice(i, 1); continue; }
    }
    if (v.pinned) {
      // staged chase: pure kinematic trail, no collision pile-ups
      const gap = 150;
      const ahead = G.cops[G.cops.indexOf(v) - 1] || t;
      const targetY = (ahead === t ? t.y : ahead.y) - gap;
      const targetX = t.x - 10;
      v.y += Math.max(-260, Math.min(260, (targetY - v.y) * 3));
      v.x += (targetX - v.x) * Math.min(1, dt * 5);
      v.angle = Math.PI / 2;
      v.vx = 0; v.vy = 240;
      continue;
    }
    // Pursuit steering (real physics so collisions and draw stay in sync).
    const dx = t.x - v.x, dy = t.y - v.y;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 3));

    const dist = Math.hypot(dx, dy);
    const desired = dist > 60 ? v.maxSpeed : Math.max(60, dist * 2);
    const throttle = v.speed < desired ? 1 : -0.6;

    if (window.__updateVehiclePhysics) {
      window.__updateVehiclePhysics(v, dt, world, { throttle, steer, brake: false });
    } else {
      v.angle += steer * 2.6 * dt;
      v.speed = Math.max(0, Math.min(v.maxSpeed, v.speed + 240 * throttle * dt));
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;
    }

    // ram damage to player car
    if (p.inCar && dist < 40) {
      damagePlayerCar(12 * dt * 8);
    }
    // back off when nosed into the target
    if (dist < 34) {
      const back = Math.atan2(-(t.y - v.y), -(t.x - v.x));
      if (window.__updateVehiclePhysics) window.__updateVehiclePhysics(v, dt, world, { throttle: -0.8, steer: Math.sin(G.time * 3) * 0.6, brake: false });
      else v.x += Math.cos(back) * 40 * dt;
    }

    // cops shoot from car at 3+ stars
    if (G.wanted >= 3 && dist < 300 && Math.random() < dt * 1.2) {
      if (window.__spawnBullet) {
        window.__spawnBullet(v.x + Math.cos(targetAngle) * 20, v.y + Math.sin(targetAngle) * 20, targetAngle, 300, 8, 'police');
        if (window.__playGun) window.__playGun();
      }
    }

    // Drop foot cops when close to on-foot player
    if (!p.inCar && dist < 130 && G.footCops.length < G.wanted + 1 && Math.random() < dt * 2) {
      const cop = createGangPed(v.x, v.y);
      cop.gang = false; cop.cop = true; cop.gun = true; cop.shirt = '#2b4a7e'; cop.health = 60;
      G.footCops.push(cop);
      G.peds.push(cop);
    }
    // recycle far cops
    if (dist > 1600) { G.vehicles.splice(G.vehicles.indexOf(v), 1); G.cops.splice(i, 1); }
  }
}

function updateFootCops(dt, world) {
  const p = G.player;
  const t = p.inCar || p;
  for (let i = G.footCops.length - 1; i >= 0; i--) {
    const c = G.footCops[i];
    if (c.dead) { G.footCops.splice(i, 1); continue; }
    if (c.retreat || G.wanted === 0) {
      c.x += Math.cos(G.time * 2 + i) * 30 * dt;
      if (Math.hypot(c.x - t.x, c.y - t.y) > 700) { G.peds.splice(G.peds.indexOf(c), 1); G.footCops.splice(i, 1); }
      continue;
    }
    const dx = t.x - c.x, dy = t.y - c.y;
    const dist = Math.hypot(dx, dy);
    c.angle = Math.atan2(dy, dx);
    const spd = dist > 140 ? 95 : 40;
    if (window.__tryMove) window.__tryMove(c, Math.cos(c.angle) * spd * dt, Math.sin(c.angle) * spd * dt, world);
    // shoot
    c.fireCd = (c.fireCd || 0) - dt;
    if (dist < 260 && c.fireCd <= 0 && G.wanted >= 2) {
      c.fireCd = 0.9 + Math.random() * 0.6;
      if (window.__spawnBullet) {
        const jitter = (Math.random() - 0.5) * 0.18;
        window.__spawnBullet(c.x + Math.cos(c.angle) * 12, c.y + Math.sin(c.angle) * 12, c.angle + jitter, 260, 9, 'police');
        if (window.__playGun) window.__playGun();
      }
    }
    if (dist > 900) { G.peds.splice(G.peds.indexOf(c), 1); G.footCops.splice(i, 1); }
  }
}

export function damagePlayerCar(dmg) {
  const p = G.player;
  if (p && p.inCar) {
    p.inCar.health -= dmg;
    if (p.inCar.health <= 0) p.inCar.wrecked = true;
  }
}

function bustedScreen() {
  if (G.mode !== 'play') return;
  G.mode = 'busted';
  const fine = Math.min(G.money, 150 + G.wanted * 120);
  G.money -= fine;
  clearWanted();
  G.bustedInfo = { fine, respawn: 'hotel' };
}
