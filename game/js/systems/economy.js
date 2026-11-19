// Economy: money, shops (weapons, garage), purchase flow, save/load.

import { G } from '../core/state.js';
import { PLACES, TILE } from '../data/city-map.js';
import { keyPressed } from '../core/input.js';
import { giveWeapon, WEAPONS } from '../entities/player.js';
import { createVehicle } from '../entities/vehicle.js';
import { setDialogue } from '../core/state.js';
import { playPickup } from '../audio/audio.js';

export const WEAPON_PRICES = {
  pistol: { price: 0, ammo: 24 },
  smg: { price: 800, ammo: 90 },
  rifle: { price: 1600, ammo: 30 },
};

export const CAR_PRICES = {
  sport: { price: 2500, name: 'VESPER GT' },
  sedan: { price: 900, name: 'DORADO LX' },
};

export function updateEconomy(dt, world) {
  const p = G.player;
  if (!p) return;
  const t = p.inCar || p;

  // Weapon shop
  const gs = PLACES.gunShop;
  const gsC = { x: gs.x * TILE + TILE / 2, y: gs.y * TILE + TILE / 2 };
  G.shopPrompt = null;
  if (Math.hypot(t.x - gsC.x, t.y - gsC.y) < 40) {
    G.shopPrompt = { kind: 'gun', label: 'BRASS & LEAD: press B to open shop' };
    if (keyPressed('KeyB')) openShop('gun');
  }
  // Garage
  const gr = PLACES.garage;
  const grC = { x: gr.x * TILE + TILE / 2, y: gr.y * TILE + TILE / 2 };
  if (Math.hypot(t.x - grC.x, t.y - grC.y) < 40) {
    G.shopPrompt = { kind: 'garage', label: 'MIRAGE CUSTOMS: press B for cars & repairs' };
    if (keyPressed('KeyB')) openShop('garage');
  }
}

let shop = null;
export function getShop() { return shop; }
export function closeShop() { shop = null; G.mode = 'play'; }

function openShop(kind) {
  shop = { kind, items: kind === 'gun' ? gunItems() : carItems() };
  G.mode = 'shop';
}

function gunItems() {
  return [
    { name: 'PISTOL + 24 AMMO', price: 250, act: () => { giveWeapon('pistol', 24); } },
    { name: 'SMG + 90 AMMO', price: 800, act: () => { giveWeapon('smg', 90); } },
    { name: 'RIFLE + 30 AMMO', price: 1600, act: () => { giveWeapon('rifle', 30); } },
    { name: 'ARMOUR VEST', price: 500, act: () => { G.armour = 100; } },
  ];
}

function carItems() {
  const p = G.player;
  return [
    { name: 'REPAIR CURRENT CAR ($300)', price: 300, act: () => { if (p.inCar) p.inCar.health = 100; } },
    { name: 'BUY VESPER GT (sport, $2500)', price: 2500, act: () => spawnBought('sport') },
    { name: 'BUY DORADO LX (sedan, $900)', price: 900, act: () => spawnBought('sedan') },
  ];
}

function spawnBought(kind) {
  const p = G.player;
  const t = p.inCar || p;
  const v = createVehicle(t.x + 60, t.y + 60, 0, kind);
  v.driver = null;
  G.vehicles.push(v);
}

export function tryBuy(idx) {
  if (!shop) return;
  const item = shop.items[idx];
  if (!item || G.money < item.price) { setDialogue('SHOPKEEPER', 'Not enough cash, friend.', 2.5); return; }
  G.money -= item.price;
  item.act();
  playPickup();
  shop = null;
  G.mode = 'play';
}

// ---- save/load ----
const SAVE_KEY = 'sol-dorado-save-v1';

export function saveGame() {
  const p = G.player;
  const data = {
    money: G.money, wanted: G.wanted, missionsDone: G.missionsDone, availableIdx: G.availableIdx ?? 0,
    weapon: G.weapon, weapons: G.weapons, armour: G.armour, stats: G.stats,
    pos: { x: p.x, y: p.y },
    nextMission: G.nextMissionIdx ?? 0,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

export function applySave(data) {
  G.money = data.money ?? 250;
  G.missionsDone = data.missionsDone ?? [];
  G.weapons = data.weapons ?? G.weapons;
  G.weapon = data.weapon ?? 'pistol';
  G.armour = data.armour ?? 0;
  G.stats = data.stats ?? G.stats;
  return data;
}

export function saveSlotPos(data) { return data.pos; }
export function saveMissionIdx(data) { return data.nextMission ?? 0; }
export { SAVE_KEY };
