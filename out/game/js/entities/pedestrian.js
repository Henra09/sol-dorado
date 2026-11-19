// Pedestrians: sidewalk wanderers with avoidance, panic states and takedown.

import { G } from '../core/state.js';
import { TILE, tileHash, T_SIDEWALK, T_PLAZA, T_PARK, T_SAND, T_ROAD } from '../data/city-map.js';
import { tryMove } from './player.js';

const SKIN = ['#e8b88a', '#c98d5e', '#8a5c3c', '#f0d0b0', '#6e4a30'];
const SHIRT = ['#e05a4c', '#3e7fc8', '#e0b23e', '#4aa564', '#d9d4cc', '#b8629a', '#3f9aa0', '#e07b3e'];
let nextPedId = 1;

export function createPed(x, y) {
  const h = tileHash(x | 0, y | 0);
  return {
    id: nextPedId++,
    x, y, vx: 0, vy: 0, r: 7,
    angle: Math.random() * Math.PI * 2,
    skin: SKIN[Math.floor(Math.random() * SKIN.length)],
    shirt: SHIRT[Math.floor(Math.random() * SHIRT.length)],
    state: 'walk',           // walk | panic | dead
    timer: 2 + Math.random() * 4,
    speed: 34 + Math.random() * 22,
    walkPhase: Math.random() * 6,
    dead: false,
    health: 40,
    panicTimer: 0,
    gang: false, gun: false,
  };
}

export function createGangPed(x, y) {
  const p = createPed(x, y);
  p.gang = true; p.gun = true;
  p.shirt = '#3a3f4a';
  p.health = 70;
  p.speed = 40;
  return p;
}

export function updatePeds(dt, world) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (p.state === 'panic') {
      p.panicTimer -= dt;
      if (p.panicTimer <= 0) p.state = 'walk';
      p.speed = 120;
    }
    p.timer -= dt;
    if (p.timer <= 0 && p.state !== 'panic') {
      p.timer = 2 + Math.random() * 5;
      p.angle += (Math.random() - 0.5) * 2.2;
    }

    // Simple sidewalk avoidance: sample ahead, turn if leaving walkable ground.
    const lookX = p.x + Math.cos(p.angle) * 16, lookY = p.y + Math.sin(p.angle) * 16;
    if (!walkable(lookX, lookY, world)) p.angle += Math.PI / 2 * (tileHash(p.id, (G.time * 10) | 0) > 0.5 ? 1 : -1);

    // avoidance from nearby peds
    for (const o of G.peds) {
      if (o === p || o.dead) continue;
      const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 < 18 * 18 && d2 > 0.01) p.angle += Math.sign(dx * Math.sin(p.angle) - dy * Math.cos(p.angle)) * 0.06;
    }

    const vx = Math.cos(p.angle) * p.speed, vy = Math.sin(p.angle) * p.speed;
    const px = p.x, py = p.y;
    tryMove(p, vx * dt, vy * dt, world);
    if (Math.hypot(p.x - px, p.y - py) < (vx * dt) * 0.2) p.angle += 0.8;  // stuck, turn
    p.walkPhase += dt * (p.state === 'panic' ? 14 : 7);

    // Panic from gunfire near or player driving at them is set by police/combat.
    if (p.health <= 0 && !p.dead) killPed(p);
  }
}

export function panicNear(x, y, radius) {
  for (const p of G.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) { p.state = 'panic'; p.panicTimer = 5 + Math.random() * 3; p.angle = Math.atan2(p.y - y, p.x - x); }
  }
}

export function killPed(p) {
  p.dead = true;
  p.state = 'dead';
  p.deadTime = G.time;
  G.stats.kills++;
  if (window.__onPedDeath) window.__onPedDeath(p);
}

export function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dead) {
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    ctx.fillRect(-8, -4, 16, 8);
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(9, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,20,20,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(p.angle);
  // shadow
  ctx.fillStyle = 'rgba(20,16,10,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  // legs bob
  const step = Math.sin(p.walkPhase) * 3;
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(-2, -5 + step * 0.5, 4, 3);
  ctx.fillRect(-2, 2 - step * 0.5, 4, 3);
  // body
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(1, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  // gun in hand when armed
  if (p.gun) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(6, -1, 6, 2);
  }
  ctx.restore();
}

function walkable(wx, wy, world) {
  const gx = Math.floor(wx / TILE), gy = Math.floor(wy / TILE);
  if (gy < 0 || gx < 0 || gy >= world.grid.length || gx >= world.grid[0].length) return false;
  const t = world.grid[gy][gx];
  return t === T_SIDEWALK || t === T_PLAZA || t === T_PARK || t === T_SAND || t === T_ROAD;
}

// Spawn peds on sidewalks near a point (used by spawner with recycle).
export function pickSidewalkPoint(near, world, radius) {
  for (let i = 0; i < 30; i++) {
    const x = near.x + (Math.random() * 2 - 1) * radius;
    const y = near.y + (Math.random() * 2 - 1) * radius;
    const gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
    if (gy < 0 || gx < 0 || gy >= world.grid.length || gx >= world.grid[0].length) continue;
    const t = world.grid[gy][gx];
    if (t === T_SIDEWALK || t === T_PLAZA || t === T_PARK) return { x, y };
  }
  return null;
}
