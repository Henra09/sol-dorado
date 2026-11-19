// Vehicles: physics (acceleration, steering, drift), damage, rendering with
// body colours and police liveries.

import { G } from '../core/state.js';
import { TILE, MW, MH } from '../data/city-map.js';
import { tryMove } from './player.js';

const CIV_COLORS = ['#c84c3c', '#e0b23e', '#3e7fc8', '#4aa564', '#d9d4cc', '#8a8f98', '#b8629a', '#e07b3e'];
let nextId = 1;

export function createVehicle(x, y, angle, kind = 'sedan', opts = {}) {
  return {
    id: nextId++,
    x, y, angle,
    vx: 0, vy: 0,        // velocity in world space
    speed: 0,            // signed forward speed
    kind,                // sedan | sport | taxi | van | police
    color: kind === 'police' ? '#20304c' : (opts.color || CIV_COLORS[Math.floor(Math.random() * CIV_COLORS.length)]),
    w: 38, h: 20, r: 16,
    driver: null,        // 'player' | 'ai' | 'police' | null
    health: 100,
    wrecked: false,
    smoke: 0,
    stolen: false,
    justStolen: false,
    civilian: kind !== 'police',
    siren: false,
    ai: opts.ai || null, // {mode:'lane', dir, road, ...} set by traffic
    brake: false,
    skidTimer: 0,
    headlights: opts.headlights || false,
    maxSpeed: kind === 'sport' ? 420 : kind === 'police' ? 380 : kind === 'van' ? 240 : 320,
    accel: kind === 'sport' ? 260 : kind === 'police' ? 240 : 170,
    turn: kind === 'sport' ? 3.4 : 2.6,
    missionCar: opts.missionCar || false,
    carTag: opts.carTag || null,
  };
}

export function updateVehiclePhysics(v, dt, world, controls) {
  // controls: {throttle -1..1, steer -1..1, brake bool}
  const accel = v.accel * (v.wrecked ? 0 : 1);
  if (controls.throttle > 0) v.speed += accel * controls.throttle * dt;
  else if (controls.throttle < 0) v.speed += accel * 0.6 * controls.throttle * dt;
  else v.speed *= Math.pow(0.35, dt);            // engine drag
  if (controls.brake) v.speed *= Math.pow(0.02, dt);

  const max = v.maxSpeed * (v.wrecked ? 0 : 1);
  v.speed = Math.max(-max * 0.45, Math.min(max, v.speed));

  // Steering scales down at standstill; drift factor at high speed.
  const steerAmt = v.turn * controls.steer * Math.min(1, Math.abs(v.speed) / 120);
  const drift = Math.abs(v.speed) > v.maxSpeed * 0.7 && Math.abs(controls.steer) > 0.5;
  v.angle += steerAmt * dt * (v.speed < 0 ? -1 : 1);
  if (drift) {
    v.angle += steerAmt * dt * 0.4;
    v.skidTimer += dt;
    if (v.skidTimer > 0.05) { v.skidTimer = 0; addSkid(v); }
  }

  const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
  v.vx = fx * v.speed * 0.94 + v.vx * 0.06;
  v.vy = fy * v.speed * 0.94 + v.vy * 0.06;
  v.vx *= 0.995; v.vy *= 0.995;

  moveVehicle(v, v.vx * dt, v.vy * dt, world);

  if (v.health < 40) {
    v.smoke = Math.min(1, v.smoke + dt * 0.4);
    if (Math.random() < dt * 8) spawnSmoke(v);
  }
  if (v.health <= 0 && !v.wrecked) wreckVehicle(v);
}

function moveVehicle(v, dx, dy, world) {
  const before = { x: v.x, y: v.y };
  tryMove(v, dx, dy, world);
  const hit = Math.hypot(v.x - before.x, v.y - before.y) < Math.hypot(dx, dy) * 0.5;
  if (hit && Math.abs(v.speed) > 60) {
    const dmg = Math.abs(v.speed) * 0.12;
    damageVehicle(v, dmg, true);
    v.speed *= -0.25;
    if (v.driver === 'player') {
      import('../core/state.js').then(() => { });
    }
    G.shake = Math.min(20, G.shake + Math.abs(v.speed) * 0.03);
    if (window.__spawnSparks) window.__spawnSparks(v.x, v.y, 6);
  }
}

export function addSkid(v) {
  const bx = v.x - Math.cos(v.angle) * 12, by = v.y - Math.sin(v.angle) * 12;
  G.skids.push({ x: bx + Math.cos(v.angle + Math.PI / 2) * 8, y: by + Math.sin(v.angle + Math.PI / 2) * 8, a: 1 });
  G.skids.push({ x: bx - Math.cos(v.angle + Math.PI / 2) * 8, y: by - Math.sin(v.angle + Math.PI / 2) * 8, a: 1 });
  if (G.skids.length > 400) G.skids.splice(0, 80);
}

function spawnSmoke(v) {
  G.particles.push({
    x: v.x + (Math.random() - 0.5) * 20, y: v.y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20,
    life: 1.2, maxLife: 1.2, size: 8 + Math.random() * 8, kind: 'smoke',
  });
}

export function damageVehicle(v, dmg, byPlayer = false) {
  if (v.wrecked) return;
  v.health -= dmg;
  if (v.health <= 0) {
    v.health = 0;
    if (byPlayer && window.__onVehicleKill) window.__onVehicleKill(v);
  }
}

export function wreckVehicle(v) {
  v.wrecked = true;
  v.speed = 0; v.vx = 0; v.vy = 0;
  if (v.driver === 'ai' || v.driver === 'police') {
    // kick the AI driver out
    if (window.__spawnFleeingPed) window.__spawnFleeingPed(v.x, v.y);
    v.driver = null;
  }
  if (window.__spawnExplosion) window.__spawnExplosion(v.x, v.y);
  if (G.player && G.player.inCar === v) {
    G.player.exitRequest = true;
    G.player.health -= 25;
    G.hitFlash = 1;
  }
}

export function drawVehicle(ctx, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);

  // shadow
  ctx.fillStyle = 'rgba(20,16,10,0.35)';
  ctx.beginPath();
  ctx.ellipse(3, 5, v.w / 2 + 2, v.h / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (v.wrecked) {
    ctx.fillStyle = '#2c2a28';
    ctx.fillRect(-v.w / 2, -v.h / 2, v.w, v.h);
    ctx.fillStyle = '#1a1918';
    ctx.fillRect(-v.w / 2 + 6, -v.h / 2 + 3, v.w - 12, v.h - 6);
    ctx.restore();
    return;
  }

  const body = v.color;
  // body
  ctx.fillStyle = body;
  roundRect(ctx, -v.w / 2, -v.h / 2, v.w, v.h, 5);
  ctx.fill();
  // cabin
  ctx.fillStyle = 'rgba(30,38,48,0.9)';
  ctx.fillRect(-v.w / 2 + 9, -v.h / 2 + 3, v.w - 20, v.h - 6);
  // windshield glint
  ctx.fillStyle = 'rgba(255,240,200,0.5)';
  ctx.fillRect(v.w / 2 - 12, -v.h / 2 + 3, 4, v.h - 6);
  // hood highlight (sun)
  ctx.fillStyle = 'rgba(255,230,170,0.35)';
  ctx.fillRect(v.w / 2 - 5, -v.h / 2, 5, v.h);
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, -v.w / 2, -v.h / 2, v.w, v.h, 5);
  ctx.stroke();

  if (v.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-2, -v.h / 2 - 4, 8, 4);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(-1, -v.h / 2 - 4, 6, 4);
  }
  if (v.kind === 'police') {
    ctx.fillStyle = '#e8e6e0';
    ctx.fillRect(-v.w / 2 + 4, -v.h / 2, 10, v.h);
    ctx.fillStyle = '#1a2844';
    ctx.fillRect(-v.w / 2 + 5, -v.h / 2 + 2, 8, v.h - 4);
    // light bar
    const blink = Math.sin(G.time * 14) > 0;
    ctx.fillStyle = blink ? '#ff3b3b' : '#3b6bff';
    ctx.fillRect(-3, -v.h / 2 - 3, 3, 3);
    ctx.fillStyle = blink ? '#3b6bff' : '#ff3b3b';
    ctx.fillRect(0, -v.h / 2 - 3, 3, 3);
  }
  if (v.missionCar && !v.driver) {
    ctx.strokeStyle = 'rgba(255,220,90,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-v.w / 2 - 3, -v.h / 2 - 3, v.w + 6, v.h + 6);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
