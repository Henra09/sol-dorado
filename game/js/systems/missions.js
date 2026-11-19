// Missions: story arc runner (steal/deliver/kill/goto/survive/race steps),
// giver markers, side jobs, dialogue subtitles, objective text.

import { G, setDialogue, clampWorld } from '../core/state.js';
import { STORY, SIDE_JOBS } from '../data/missions.js';
import { PLACES, TILE, districtAt } from '../data/city-map.js';
import { createVehicle } from '../entities/vehicle.js';
import { createGangPed } from '../entities/pedestrian.js';
import { keyPressed } from '../core/input.js';
import { playPickup } from '../audio/audio.js';
import { raiseWanted, clearWanted } from './police.js';

let active = null;            // current story mission runtime
let availableIdx = 0;         // next story mission index

export function missionState() { return { active, availableIdx }; }

export function startMission(def) {
  active = {
    def, stepIdx: 0, stepDone: false, waiting: null,
    objectiveText: def.steps[0].text,
    timer: 0, data: {},
  };
  G.mission = active;
  runDialogue(def.lines);
  G.objective = def.steps[0].text;
  prepareStep(def.steps[0]);
}

function runDialogue(lines) {
  let delay = 0;
  for (const [who, text] of lines) {
    setTimeout(() => { if (active) setDialogue(who, text, Math.max(3.5, text.length * 0.045)); }, delay * 1000);
    delay += Math.max(3.5, text.length * 0.045);
  }
}

function step() { return active.def.steps[active.stepIdx]; }

function prepareStep(s) {
  active.stepDone = false;
  active.objectiveText = s.text;
  G.objective = s.text;
  const spot = PLACES[s.pos];
  if (!spot) return;
  const c = { x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2 };

  if (s.type === 'steal-car') {
    // spawn a mission car near the target place
    const v = createVehicle(c.x + TILE * 1.5, c.y, Math.PI / 2, 'sport', { missionCar: true, color: '#e0b23e' });
    v.carTag = 'MISSION CAR';
    G.vehicles.push(v);
    active.data.car = v;
  } else if (s.type === 'kill') {
    // spawn a crew of gang peds
    active.data.targets = [];
    for (let i = 0; i < s.count; i++) {
      const gp = createGangPed(c.x + (Math.random() - 0.5) * 140, c.y + (Math.random() - 0.5) * 140);
      gp.missionPed = true;
      active.data.targets.push(gp);
      G.peds.push(gp);
    }
  } else if (s.type === 'race') {
    active.data.cpIdx = 0;
    active.timer = 0;
  } else if (s.type === 'survive-wanted') {
    active.waiting = 'survive';
  }
}

export function updateMissions(dt, world) {
  const p = G.player;
  if (!p) return;
  const t = p.inCar || p;

  if (active) {
    updateActive(dt, t, world);
    return;
  }

  // Story giver marker: check distance to next giver.
  const def = STORY[availableIdx];
  if (def) {
    const spot = PLACES[def.giver];
    const c = { x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2 };
    G.missionMarker = c;
    if (Math.hypot(t.x - c.x, t.y - c.y) < 34) {
      if (!G.missionPromptShown) G.missionPromptShown = true;
      if (keyPressed('KeyM')) {
        startMission(def);
        G.missionPromptShown = false;
      }
    } else G.missionPromptShown = false;
  } else {
    G.missionMarker = null;
  }

  // Side jobs
  if (!G.sideJob) {
    for (const job of SIDE_JOBS) {
      if (G.missionsDone.includes('side:' + job.id)) continue;
      const spot = PLACES[job.giver];
      const c = { x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2 };
      if (Math.hypot(t.x - c.x, t.y - c.y) < 30 && keyPressed('KeyM')) {
        G.sideJob = startSideJob(job, c);
        break;
      }
    }
  } else {
    updateSideJob(dt, t);
  }
}

function updateActive(dt, t, world) {
  const s = step();
  const spot = PLACES[s.pos];
  const c = spot ? { x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2 } : null;
  G.missionMarker = c;

  switch (s.type) {
    case 'goto':
      if (c && Math.hypot(t.x - c.x, t.y - c.y) < 40) completeStep();
      break;
    case 'steal-car': {
      const car = active.data.car;
      if (car && G.player.inCar === car) completeStep();
      break;
    }
    case 'deliver-car': {
      const car = active.data.car;
      if (car && G.player.inCar === car && c && Math.hypot(t.x - c.x, t.y - c.y) < 44) {
        G.player.inCar.speed = 0;
        G.player.inCar = null;
        car.driver = null;
        car.missionCar = false;
        completeStep();
      }
      break;
    }
    case 'kill': {
      const targets = (active.data.targets || []).filter(gp => !gp.dead);
      active.data.targets = active.data.targets.filter(gp => !gp.dead);
      if (targets.length === 0) completeStep();
      break;
    }
    case 'survive-wanted':
      if (G.wanted >= s.stars) active.stepDone = true;
      else if (active.stepDone && G.wanted < s.stars) {
        clearWanted();
        completeStep();
      }
      break;
    case 'race': {
      active.timer += dt;
      const cps = s.checkpoints;
      const idx = active.data.cpIdx;
      const spot2 = PLACES[cps[idx]];
      const cc = { x: spot2.x * TILE + TILE / 2, y: spot2.y * TILE + TILE / 2 };
      G.missionMarker = cc;
      if (Math.hypot(t.x - cc.x, t.y - cc.y) < 50) {
        active.data.cpIdx++;
        playPickup();
        if (active.data.cpIdx >= cps.length) {
          G.stats.racesWon++;
          completeStep();
        }
      }
      break;
    }
  }
}

function completeStep() {
  playPickup();
  active.stepIdx++;
  if (active.stepIdx >= active.def.steps.length) {
    finishMission();
  } else {
    prepareStep(active.def.steps[active.stepIdx]);
  }
}

function finishMission() {
  const def = active.def;
  G.money += def.reward;
  G.missionsDone.push(def.id);
  availableIdx = STORY.findIndex(d => d.id === def.id) + 1;
  setDialogue(def.lines[def.lines.length - 1][0], `Job done. $${def.reward} wired.`, 4);
  G.objective = availableIdx < STORY.length
    ? `Next job: meet your contact at ${PLACES[STORY[availableIdx].giver].label}`
    : 'Sol Dorado is yours. Roam free.';
  G.mission = null;
  active = null;
  G.missionMarker = null;
  clearWanted();
}

// ---- Side jobs ----
function startSideJob(job, c) {
  const state = { job, t: 0, limit: job.kind === 'rampage' ? 60 : 75, kills0: G.stats.kills, data: {} };
  setDialogue('DISPATCH', job.text, 4);
  if (job.kind === 'delivery') {
    // random far destination
    const keys = Object.keys(PLACES);
    const dest = PLACES[keys[Math.floor(Math.random() * keys.length)]];
    state.dest = { x: dest.x * TILE + TILE / 2, y: dest.y * TILE + TILE / 2, name: dest.label };
    G.objective = `COURIER RUN: deliver to ${dest.label}`;
    G.missionMarker = state.dest;
  } else if (job.kind === 'rampage') {
    G.objective = `RAMPAGE: 8 takedowns in 60s (0/8)`;
    // spawn targets
    state.targets = [];
    for (let i = 0; i < 8; i++) {
      const gp = createGangPed(c.x + (Math.random() - 0.5) * 200, c.y + (Math.random() - 0.5) * 200);
      gp.missionPed = true;
      state.targets.push(gp);
      G.peds.push(gp);
    }
  } else if (job.kind === 'race') {
    state.cps = ['raceStart', 'marina', 'towers'];
    state.cpIdx = 0;
    G.objective = 'NIGHT SPRINT: hit checkpoint 1';
  }
  return state;
}

function updateSideJob(dt, t) {
  const s = G.sideJob;
  s.t += dt;
  const left = s.limit - s.t;
  if (s.job.kind === 'delivery') {
    G.missionTimer = Math.max(0, left);
    if (Math.hypot(t.x - s.dest.x, t.y - s.dest.y) < 44) paySideJob();
    if (left <= 0) failSideJob('OUT OF TIME');
  } else if (s.job.kind === 'rampage') {
    G.missionTimer = Math.max(0, left);
    const done = s.targets.filter(gp => gp.dead).length;
    G.objective = `RAMPAGE: ${done}/8 takedowns \u2014 ${Math.ceil(left)}s`;
    if (done >= 8) paySideJob();
    if (left <= 0) failSideJob('TOO SLOW');
  } else if (s.job.kind === 'race') {
    const cp = PLACES[s.cps[s.cpIdx]];
    const c = { x: cp.x * TILE + TILE / 2, y: cp.y * TILE + TILE / 2 };
    G.missionMarker = c;
    G.objective = `NIGHT SPRINT: checkpoint ${s.cpIdx + 1}/${s.cps.length}`;
    if (Math.hypot(t.x - c.x, t.y - c.y) < 50) {
      s.cpIdx++;
      playPickup();
      if (s.cpIdx >= s.cps.length) paySideJob();
    }
    if (left <= 0) failSideJob('TOO SLOW');
  }
}

function paySideJob() {
  const s = G.sideJob;
  G.money += s.job.pay;
  setDialogue('DISPATCH', `Contract complete. $${s.job.pay} paid.`, 3.5);
  G.missionsDone.push('side:' + s.job.id);
  G.sideJob = null;
  G.missionMarker = null;
  G.objective = 'Free roam \u2014 find the next marker';
  G.missionTimer = 0;
}

function failSideJob(why) {
  setDialogue('DISPATCH', `${why}. Contract void.`, 3.5);
  G.sideJob = null;
  G.missionMarker = null;
  G.objective = 'Free roam \u2014 find the next marker';
  G.missionTimer = 0;
}
