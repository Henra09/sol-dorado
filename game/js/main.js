// Main loop: fixed-ish timestep update, mode dispatch, draw order, shot staging.

import { G, clampWorld } from './core/state.js';
import { initInput, endFrame, key, keyPressed, mouse } from './core/input.js';
import { paintCity, blitCity } from './world/city-paint.js';
import { WORLD_W, WORLD_H } from './data/city-map.js';
window.__worldBounds = [WORLD_W, WORLD_H];
import('./entities/vehicle.js').then(m => { window.__updateVehiclePhysics = m.updateVehiclePhysics; });
import { updateTraffic } from './world/traffic.js';
import { updateSpawner } from './world/spawner.js';
import { updatePlayer, exitCar, enterCar, createPlayer, giveWeapon } from './entities/player.js';
import { updateVehiclePhysics, drawVehicle } from './entities/vehicle.js';
import { updatePeds, drawPed, panicNear, createPed } from './entities/pedestrian.js';
import { updatePolice, raiseWanted, clearWanted } from './systems/police.js';
import { initCombat, updateBullets, damagePlayer } from './systems/combat.js';
import { updateMissions } from './systems/missions.js';
import { updateEconomy } from './systems/economy.js';
import { cam, updateCamera, applyCamera, dropCamera } from './render/camera.js';
import { updateParticles, drawParticles, drawSkids, drawGrade } from './render/effects.js';
import { drawHUD, drawOverlay } from './ui/hud.js';
import { buildMinimapBase, drawMinimap } from './ui/minimap.js';
import { drawTitle, drawControls, drawCredits, drawPause, drawShop } from './ui/menus.js';
import { initAudio, resumeAudio, updateEngine, updateSiren, startRadio } from './audio/audio.js';
import { persistProgress, restoreProgress } from './core/save.js';
import { PLACES, TILE } from './data/city-map.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 1280; canvas.height = 720;
G.viewW = canvas.width; G.viewH = canvas.height;
window.__G = G;
window.__camRef = cam;

initInput(canvas);
initAudio();

const world = paintCity();
buildMinimapBase();
initCombat(world);
G.objective = 'Find Rosalia at the Sunrise Diner (yellow marker)';

// ---- spawn hooks for stager ----
import('./world/spawner.js').then(m => {
  window.__spawnerHooks = {
    spawnBatchForShot: (at, w) => {
      for (let i = 0; i < 14; i++) {
        const pt = m.pickSidewalkPointAt ? null : null;
      }
      // direct: use pickSidewalkPoint via exported helper
      const { pickSidewalkPoint } = window.__pedModule || {};
      for (let i = 0; i < 26; i++) {
        const p2 = pickSidewalkPoint ? pickSidewalkPoint(at, w, 700) : null;
        if (p2 && Math.hypot(p2.x - at.x, p2.y - at.y) > 120) G.peds.push(window.__pedModule.createPed(p2.x, p2.y));
      }
      for (let i = 0; i < 10; i++) {
        const car = window.__trafficModule && window.__trafficModule.createTrafficCar(w, at, 800);
        if (car) G.vehicles.push(car);
      }
    },
  };
});
import('./entities/pedestrian.js').then(m => { window.__pedModule = m; });
import('./world/traffic.js').then(m => { window.__trafficModule = m; });

// ---- flow helpers ----
function startRun(restore) {
  G.mode = 'play';
  resumeAudio();
  startRadio();
  const spot = PLACES.hotel;
  G.player = createPlayer(spot.x * TILE + TILE, spot.y * TILE + TILE);
  giveWeapon('fists');
  giveWeapon('pistol', 24);
  G.wanted = 0;
  G.money = 250;
  if (restore && restore.pos) {
    G.player.x = restore.pos.x; G.player.y = restore.pos.y;
    G.money = G.money; // already applied by applySave
  }
  G.peds = []; G.vehicles = []; G.cops = []; G.footCops = []; G.bullets = [];
  G.objective = 'Meet Rosalia at the Sunrise Diner (yellow marker on minimap)';
  // give the player a starter car nearby
  import('./entities/vehicle.js').then(() => { });
  const starter = window.__vehModule.createVehicle(G.player.x + 60, G.player.y + 40, 0, 'sedan', { color: '#c84c3c' });
  G.vehicles.push(starter);
}

import('./entities/vehicle.js').then(m => { window.__vehModule = m; });

function respawn() {
  const spot = PLACES[G.bustedInfo?.respawn || 'hotel'];
  G.player.health = G.player.maxHealth;
  G.player.x = spot.x * TILE + TILE; G.player.y = spot.y * TILE + TILE;
  G.player.inCar = null;
  G.mode = 'play';
  G.hitFlash = 0;
}

// ---- shot staging ----
let stagedFrames = 0;
let staged = false;
import('./core/shot-stager.js').then(async m => {
  const r = await m.applyShotParam({ get: () => G }, world);
  if (r) {
    stagedFrames = r.frames || 40;
    if (r.camAt) { cam.x = r.camAt.x; cam.y = r.camAt.y; }
    if (G.mode === 'title' && G.player) G.mode = 'play';
    staged = true;
  }
});

// ---- menu actions ----
let menuMode = 'title';     // title | controls | credits
const actions = {
  play: () => startRun(null),
  continueGame: () => {
    const r = restoreProgress();
    startRun(r);
    G.mode = 'play';
  },
  controls: () => { menuMode = 'controls'; },
  credits: () => { menuMode = 'credits'; },
  back: () => { menuMode = 'title'; },
  resume: () => { G.mode = 'play'; },
  save: () => { persistProgress(); G.mode = 'play'; },
  quit: () => { persistProgress(); G.mode = 'title'; menuMode = 'title'; },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  G.shake *= Math.pow(0.001, dt);
  G.hitFlash = Math.max(0, G.hitFlash - dt * 2);

  // global keys
  if (keyPressed('Escape') || keyPressed('KeyP')) {
    if (G.mode === 'play') G.mode = 'paused';
    else if (G.mode === 'paused') G.mode = 'play';
    else if (G.mode === 'shop') { import('./systems/economy.js').then(m => m.closeShop()); G.mode = 'play'; }
  }
  if (keyPressed('KeyR')) {
    import('./audio/audio.js').then(m => m.stopRadio());
  }

  if (G.mode === 'title' || G.mode === 'controls' || G.mode === 'credits') {
    drawFrameMenu();
  } else if (G.mode === 'shop') {
    drawShop(ctx, canvas);
  } else {
    update(dt);
    drawWorld();
    drawHUD(ctx, canvas);
    drawMinimap(ctx, canvas);
    drawGrade(ctx, canvas);
    if (G.mode === 'paused') drawPause(ctx, canvas, actions);
    if (G.mode === 'busted' || G.mode === 'wasted') {
      drawOverlay(ctx, canvas, G.mode, G.bustedInfo);
      respawnTimer -= dt;
      if (respawnTimer <= 0) respawn();
    }
  }

  if (stagedFrames > 0 && staged) stagedFrames--;
  endFrame();
  requestAnimationFrame(frame);
}

let respawnTimer = 2.5;

function drawFrameMenu() {
  if (menuMode === 'controls') drawControls(ctx, canvas, actions.back);
  else if (menuMode === 'credits') drawCredits(ctx, canvas, actions.back);
  else drawTitle(ctx, canvas, actions);
}

function update(dt) {
  if (G.mode !== 'play' && G.mode !== 'busted' && G.mode !== 'wasted') return;

  updateSpawner(dt, world);
  updateMissions(dt, world);
  updateEconomy(dt, world);
  updatePolice(dt, world);
  updateBullets(dt, world);
  updatePeds(dt, world);
  updateParticles(dt);

  const p = G.player;
  if (p) {
    if (p.inCar) {
      const c = {
        throttle: (key('KeyW') || key('ArrowUp') ? 1 : 0) + (key('KeyS') || key('ArrowDown') ? -1 : 0),
        steer: (key('KeyD') || key('ArrowRight') ? 1 : 0) - (key('KeyA') || key('ArrowLeft') ? 1 : 0),
        brake: key('Space') && false,
      };
      c.brake = key('Space');
      if (p.inCar.cruise && c.throttle === 0) c.throttle = 0.9;   // shot-staged scenes keep rolling
      updateVehiclePhysics(p.inCar, dt, world, c);
      p.x = p.inCar.x; p.y = p.inCar.y;
      p.facing = p.inCar.angle;
      updateEngine(true, Math.min(1, Math.abs(p.inCar.speed) / p.inCar.maxSpeed));
      if (keyPressed('KeyF') || keyPressed('KeyE')) exitCar(p);
      // running over peds
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - p.x, ped.y - p.y) < 20 && Math.abs(p.inCar.speed) > 90) {
          ped.health = 0;
          window.__onPedDeath(ped);
          G.shake = Math.min(18, G.shake + 4);
        }
      }
    } else {
      updatePlayer(dt, world);
      updateEngine(false, 0);
    }
    clampWorld(p);
    if (p.exitRequest) { exitCar(p); p.exitRequest = false; }
  }

  // drive AI vehicles & cop cars through physics-ish integration already done
  // (traffic moves directly; cop cars move directly). Update other playerless cars:
  for (const v of G.vehicles) {
    if (v.driver === 'ai' || v.driver === 'police') continue;      // traffic/police integrate in their systems
    if (v.driver === null && !v.wrecked) updateVehiclePhysics(v, dt, world, { throttle: 0, steer: 0, brake: false });
  }

  // steal detection: entering a car with driver 'ai'
  if (p && p.inCar && p.inCar.justStolen) {
    p.inCar.justStolen = false;
    raiseWanted(2, 'GRAND THEFT AUTO \u2014 police alerted');
    G.stats.carsStolen++;
    panicNear(p.x, p.y, 180);
  }

  // sirens audible when cops active
  updateSiren(G.wanted > 0 && G.cops.length > 0);

  // camera
  const t = p ? (p.inCar || p) : null;
  const lead = p && p.inCar ? { x: Math.cos(p.inCar.angle) * p.inCar.speed * 0.25, y: Math.sin(p.inCar.angle) * p.inCar.speed * 0.25 } : null;
  updateCamera(dt, t, lead);
}

function drawWorld() {
  ctx.fillStyle = '#22262e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  applyCamera(ctx);
  blitCity(ctx, cam, canvas.width, canvas.height);

  // skids under everything
  drawSkids(ctx);

  // mission marker (world)
  if (G.missionMarker) {
    const blink = Math.sin(G.time * 5) > 0;
    ctx.strokeStyle = blink ? 'rgba(255,216,74,0.95)' : 'rgba(255,216,74,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(G.missionMarker.x, G.missionMarker.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = blink ? 'rgba(255,216,74,0.9)' : 'rgba(255,216,74,0.35)';
    ctx.beginPath();
    ctx.arc(G.missionMarker.x, G.missionMarker.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // giver markers for available story mission & side jobs
  drawPlaceMarkers(ctx);

  // vehicles under peds
  for (const v of G.vehicles) drawVehicle(ctx, v);
  for (const pd of G.peds) drawPed(ctx, pd);
  drawParticles(ctx);

  // player
  const p = G.player;
  if (p && !p.inCar) drawPlayer(ctx, p);

  dropCamera(ctx);
}

function drawPlaceMarkers(ctx) {
  import('./systems/missions.js').then(() => { });
  const st = window.__missionState ? window.__missionState() : null;
  // draw shop markers
  const mark = (place, color) => {
    const c = { x: place.x * TILE + TILE / 2, y: place.y * TILE + TILE / 2 };
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
  };
  mark(PLACES.gunShop, 'rgba(214,80,80,0.9)');
  mark(PLACES.garage, 'rgba(120,180,220,0.9)');
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(20,16,10,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.facing);
  // legs
  ctx.fillStyle = '#232833';
  ctx.fillRect(-4, -7, 7, 5);
  ctx.fillRect(-4, 2, 7, 5);
  // torso (bright jacket, readable against asphalt)
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,30,0.85)'; ctx.lineWidth = 2; ctx.stroke();
  // head
  ctx.fillStyle = '#d9a877';
  ctx.beginPath(); ctx.arc(1.5, 0, 4, 0, Math.PI * 2); ctx.fill();
  // weapon
  if (G.weapon !== 'fists') {
    ctx.fillStyle = '#101010';
    ctx.fillRect(9, -2, 12, 4);
  }
  // aim laser
  if (G.weapon !== 'fists') {
    ctx.strokeStyle = 'rgba(255,80,60,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(21, 0);
    ctx.lineTo(80, 0);
    ctx.stroke();
  }
  ctx.restore();
}

requestAnimationFrame(frame);

// register mission state accessor for save system
import('./systems/missions.js').then(m => { window.__missionState = m.missionState; });
