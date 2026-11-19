// The player: on-foot movement, aiming and shooting; handles car enter/exit.

import { G, clampWorld } from '../core/state.js';
import { key, keyPressed, mouse } from '../core/input.js';
import { cam } from '../render/camera.js';
import { TILE } from '../data/city-map.js';

export const WEAPONS = {
  fists: { name: 'FISTS', dmg: 12, rate: 0.4, range: 26, melee: true },
  pistol: { name: 'PISTOL', dmg: 26, rate: 0.32, range: 340, spread: 0.05, ammoPer: 12 },
  smg: { name: 'SMG', dmg: 18, rate: 0.11, range: 300, spread: 0.14, ammoPer: 30 },
  rifle: { name: 'RIFLE', dmg: 44, rate: 0.5, range: 480, spread: 0.04, ammoPer: 8 },
};

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, r: 9,
    facing: -Math.PI / 2,
    health: 100, maxHealth: 100,
    inCar: null,
    fireCd: 0,
    aimAngle: 0,
    sprint: 0,
    walking: false,
  };
}

export function giveWeapon(id, ammo) {
  const w = WEAPONS[id];
  if (!G.weapons[id]) G.weapons[id] = { ammo: 0 };
  G.weapons[id].ammo += ammo ?? w.ammoPer * 4;
  G.weapon = id;
}

export function updatePlayer(dt, world) {
  const p = G.player;
  if (!p || p.inCar) return;
  let ix = 0, iy = 0;
  if (key('KeyW') || key('ArrowUp')) iy -= 1;
  if (key('KeyS') || key('ArrowDown')) iy += 1;
  if (key('KeyA') || key('ArrowLeft')) ix -= 1;
  if (key('KeyD') || key('ArrowRight')) ix += 1;

  const sprinting = key('ShiftLeft') || key('ShiftRight');
  const speed = sprinting ? 172 : 108;
  const len = Math.hypot(ix, iy) || 1;
  p.walking = ix !== 0 || iy !== 0;
  p.vx = (ix / len) * speed * (p.walking ? 1 : 0);
  p.vy = (iy / len) * speed * (p.walking ? 1 : 0);

  // World collision (buildings/water).
  tryMove(p, p.vx * dt, p.vy * dt, world);

  // Aim at mouse (world coords).
  const wx = mouse.x + cam.x - G.viewW / 2;
  const wy = mouse.y + cam.y - G.viewH / 2;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);

  // Fire.
  p.fireCd -= dt;
  const firing = mouse.down || key('Space');
  if (firing && p.fireCd <= 0) {
    const wid = G.weapon;
    const w = WEAPONS[wid];
    const slot = G.weapons[wid];
    if (w.melee || (slot && slot.ammo > 0)) {
      p.fireCd = w.rate;
      p.facing = p.aimAngle;
      if (!w.melee) slot.ammo--;
      fireBullet(p, p.aimAngle, w, 'player');
    }
  }

  // Face travel when walking without aiming a gun recently.
  if (p.walking && !firing) p.facing = Math.atan2(p.vy, p.vx);

  // Enter nearest car.
  if (keyPressed('KeyF') || keyPressed('KeyE')) {
    let best = null, bd = 64 * 64;
    for (const v of G.vehicles) {
      const d = (v.x - p.x) ** 2 + (v.y - p.y) ** 2;
      if (d < bd && !v.wrecked) { bd = d; best = v; }
    }
    if (best) enterCar(p, best);
  }
}

export function enterCar(p, v) {
  p.inCar = v;
  v.driver = 'player';
  v.stolen = v.stolen || v.kind !== 'police';
  if (v.kind === 'police' || v.civilian) {
    // stealing a car in view raises heat (police system watches flags)
    v.justStolen = true;
  }
  p.vx = p.vy = 0;
}

export function exitCar(p) {
  const v = p.inCar;
  if (!v) return;
  if (Math.hypot(v.vx, v.vy) > 90) return;   // can't bail at speed
  p.inCar = null;
  v.driver = null;
  p.x = v.x - Math.sin(v.angle) * 26;
  p.y = v.y - Math.cos(v.angle) * -26 * 0;
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 24;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 24;
  clampWorld(p);
}

function fireBullet(shooter, angle, w, team) {
  import('../systems/combat.js').then(m => { });
  // avoid dynamic import: combat exposes spawnBullet via global hook set at init
  if (window.__spawnBullet) {
    const spread = (w.spread || 0) * (Math.random() * 2 - 1);
    window.__spawnBullet(shooter.x + Math.cos(angle) * 14, shooter.y + Math.sin(angle) * 14,
      angle + spread, w.range, w.dmg, team);
  }
}

// Slide along buildings.
export function tryMove(e, dx, dy, world) {
  const solid = t => t === 'B' || t === 'w';
  const ts = TILE;
  const test = (nx, ny) => {
    for (const [ox, oy] of [[e.r, 0], [-e.r, 0], [0, e.r], [0, -e.r], [e.r * 0.7, e.r * 0.7], [-e.r * 0.7, -e.r * 0.7], [e.r * 0.7, -e.r * 0.7], [-e.r * 0.7, e.r * 0.7]]) {
      const gx = Math.floor((nx + ox) / ts), gy = Math.floor((ny + oy) / ts);
      if (gy < 0 || gx < 0 || gy >= world.grid.length || !world.grid[gy] || gx >= world.grid[gy].length) return true;
      if (solid(world.grid[gy][gx])) return true;
    }
    return false;
  };
  if (!test(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; }
  else if (!test(e.x + dx, e.y)) { e.x += dx; }
  else if (!test(e.x, e.y + dy)) { e.y += dy; }
}
