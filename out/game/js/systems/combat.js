// Combat: bullets, damage application, muzzle flashes, explosions, player
// health/death and crime flags that feed the police system.

import { G, setDialogue, addShake } from '../core/state.js';
import { WEAPONS } from '../entities/player.js';
import { panicNear, killPed, createGangPed } from '../entities/pedestrian.js';
import { damageVehicle } from '../entities/vehicle.js';
import { raiseWanted } from './police.js';
import { TILE, T_BUILDING, T_WATER } from '../data/city-map.js';
import { playGunshot, playImpact } from '../audio/audio.js';

export function initCombat(world) {
  window.__spawnBullet = (x, y, angle, range, dmg, team) => spawnBullet(x, y, angle, range, dmg, team, world);
  window.__spawnExplosion = spawnExplosion;
  window.__spawnSparks = spawnSparks;
  window.__tryMove = (e, dx, dy) => { tryMoveBulletSafe(e, dx, dy, world); };
  window.__playGun = playGunshot;
  window.__onPedDeath = (p) => {
    if (p.cop) { raiseWanted(1); }
    panicNear(p.x, p.y, 220);
  };
  window.__onVehicleKill = () => raiseWanted(1, 'VEHICLE DESTROYED \u2014 police notified');
}

function tryMoveBulletSafe(e, dx, dy, world) {
  // reuse player.tryMove by import-free duplicate (small)
  const solid = t => t === 'B' || t === 'w';
  const ts = TILE;
  const test = (nx, ny) => {
    for (const [ox, oy] of [[e.r, 0], [-e.r, 0], [0, e.r], [0, -e.r]]) {
      const gx = Math.floor((nx + ox) / ts), gy = Math.floor((ny + oy) / ts);
      if (gy < 0 || gx < 0 || gy >= world.grid.length || gx >= world.grid[0].length) return true;
      if (solid(world.grid[gy][gx])) return true;
    }
    return false;
  };
  if (!test(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; }
  else if (!test(e.x + dx, e.y)) e.x += dx;
  else if (!test(e.x, e.y + dy)) e.y += dy;
}

function spawnBullet(x, y, angle, range, dmg, team, world) {
  G.bullets.push({ x, y, vx: Math.cos(angle) * 760, vy: Math.sin(angle) * 760, life: range / 760, dmg, team, angle });
  G.particles.push({ x: x + Math.cos(angle) * 8, y: y + Math.sin(angle) * 8, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, size: 10, kind: 'muzzle', angle });
  panicNear(x, y, 160);
  if (team === 'player') {
    if (G.wanted === 0) raiseWanted(1, 'SHOTS FIRED \u2014 police responding');
    G.wantedHeat = Math.min(1, G.wantedHeat + 0.4);
  }
  addShake(0.6);
}

function spawnSparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * (60 + Math.random() * 140), vy: Math.sin(a) * (60 + Math.random() * 140), life: 0.25 + Math.random() * 0.2, maxLife: 0.45, size: 2, kind: 'spark' });
  }
}

function spawnExplosion(x, y) {
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 46, kind: 'fireball' });
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * (80 + Math.random() * 220), vy: Math.sin(a) * (80 + Math.random() * 220), life: 0.4 + Math.random() * 0.4, maxLife: 0.8, size: 3, kind: 'spark' });
  }
  addShake(14);
  playImpact(0.6);
  panicNear(x, y, 260);
  // damage nearby
  const p = G.player;
  if (p) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 70) damagePlayer(60 * (1 - d / 70));
  }
  for (const v of G.vehicles) if (!v.wrecked && Math.hypot(v.x - x, v.y - y) < 80) damageVehicle(v, 55);
  for (const ped of G.peds) if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < 70) { ped.health = 0; killPed(ped); }
}

export function damagePlayer(dmg) {
  const p = G.player;
  if (!p || G.mode !== 'play') return;
  if (G.armour > 0) {
    const absorbed = Math.min(G.armour, dmg * 0.6);
    G.armour -= absorbed; dmg -= absorbed;
  }
  p.health -= dmg;
  G.hitFlash = Math.min(1, G.hitFlash + dmg / 60);
  addShake(dmg * 0.15);
  if (p.health <= 0 && G.mode === 'play') wastedScreen();
}

function wastedScreen() {
  G.mode = 'wasted';
  const loss = Math.min(G.money, 200);
  G.money -= loss;
  clearWanted();
  G.bustedInfo = { fine: loss, respawn: 'hotel' };
}

export function updateBullets(dt, world) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    // world hit
    const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
    let dead = b.life <= 0;
    if (gy < 0 || gx < 0 || gy >= world.grid.length || gx >= world.grid[0].length) dead = true;
    else {
      const t = world.grid[gy][gx];
      if (t === T_BUILDING) {
        spawnSparks(nx, ny, 3);
        dead = true;
      }
    }
    // entity hits
    if (!dead) {
      if (b.team === 'player') {
        for (const ped of G.peds) {
          if (ped.dead) continue;
          if (Math.hypot(ped.x - nx, ped.y - ny) < 10) {
            ped.health -= b.dmg;
            spawnSparks(nx, ny, 4);
            if (ped.health <= 0) killPed(ped);
            else if (!ped.cop && !ped.gang) { ped.state = 'panic'; ped.panicTimer = 6; }
            else if (ped.gang && !ped.cop) { ped.gun = true; }
            dead = true;
            break;
          }
        }
        if (!dead) for (const v of G.vehicles) {
          if (v.wrecked || v.driver === 'player') continue;
          const lx = (nx - v.x) * Math.cos(-v.angle) - (ny - v.y) * Math.sin(-v.angle);
          const ly = (nx - v.x) * Math.sin(-v.angle) + (ny - v.y) * Math.cos(-v.angle);
          if (Math.abs(lx) < v.w / 2 && Math.abs(ly) < v.h / 2) {
            damageVehicle(v, b.dmg, true);
            spawnSparks(nx, ny, 4);
            dead = true;
            break;
          }
        }
        // gang members (armed peds marked gang) handled above; cops are in peds list too
      } else {
        // police bullets: hit player or player's car
        if (p) {
          const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
          if (Math.hypot(tx - nx, ty - ny) < 14) {
            if (p.inCar) { damagePlayerCar2(b.dmg * 0.7); }
            else damagePlayer(b.dmg);
            spawnSparks(nx, ny, 4);
            dead = true;
          }
        }
      }
    }
    if (dead) G.bullets.splice(i, 1); else { b.x = nx; b.y = ny; }
  }

  // gang peds shoot back at player
  for (const ped of G.peds) {
    if (ped.dead || !ped.gang || ped.cop || !ped.gun) continue;
    const t = p.inCar || p;
    const dx = t.x - ped.x, dy = t.y - ped.y;
    const d = Math.hypot(dx, dy);
    ped.fireCd = (ped.fireCd || 0) - dt;
    if (d < 240) ped.angle = Math.atan2(dy, dx);
    if (d < 220 && ped.fireCd <= 0) {
      ped.fireCd = 1.1 + Math.random();
      window.__spawnBullet(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12, ped.angle + (Math.random() - 0.5) * 0.2, 240, 7, 'gang');
      playGunshot();
    }
  }
}

function damagePlayerCar2(dmg) {
  const p = G.player;
  if (p.inCar) { p.inCar.health -= dmg; if (p.inCar.health <= 0) p.inCar.wrecked = true; }
  else damagePlayer(dmg);
}
