// Minimap: real city layout rendered once to a tiny offscreen canvas, blitted
// each frame with rotating-free north-up view, markers for player/police/cars.

import { G } from '../core/state.js';
import { TILE, MW, MH, buildTileGrid, T_ROAD, T_WATER, T_SAND, T_PARK } from '../data/city-map.js';
import { cam } from '../render/camera.js';

const MAP_SIZE = 190;         // pixels on screen
const SCALE = 2.2;            // world px -> minimap px

let base = null;

export function buildMinimapBase() {
  const grid = buildTileGrid();
  base = document.createElement('canvas');
  base.width = Math.ceil(WORLDW() * SCALE);
  base.height = Math.ceil(WORLDH() * SCALE);
  const ctx = base.getContext('2d');
  ctx.fillStyle = '#1a2028';
  ctx.fillRect(0, 0, base.width, base.height);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = grid[y][x];
    let c = '#454d56';
    if (t === T_ROAD) c = '#71797f';
    else if (t === T_WATER) c = '#2e93ab';
    else if (t === T_SAND) c = '#d0bd8f';
    else if (t === T_PARK) c = '#4a7a42';
    ctx.fillStyle = c;
    ctx.fillRect(x * TILE * SCALE, y * TILE * SCALE, TILE * SCALE + 0.5, TILE * SCALE + 0.5);
  }
  return base;
}

function WORLDW() { return MW * TILE; }
function WORLDH() { return MH * TILE; }

export function drawMinimap(ctx, canvas) {
  if (!base) return;
  const size = MAP_SIZE;
  const x0 = canvas.width - size - 20;
  const y0 = canvas.height - size - 20;
  const p = G.player;
  if (!p) return;
  const t = p.inCar || p;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x0 + size / 2, y0 + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#141a20';
  ctx.fill();
  ctx.clip();

  // view window centred on player, ~1300 world px across
  const worldSpan = 1300;
  const sxw = Math.max(0, Math.min(t.x - worldSpan / 2, WORLDW() - worldSpan));
  const syw = Math.max(0, Math.min(t.y - worldSpan / 2, WORLDH() - worldSpan));
  ctx.drawImage(base, sxw * SCALE, syw * SCALE, worldSpan * SCALE, worldSpan * SCALE,
    x0, y0, size, size);

  // world -> minimap screen
  const toM = (wx, wy) => ({
    x: x0 + (wx - sxw) / worldSpan * size,
    y: y0 + (wy - syw) / worldSpan * size,
  });

  // vehicles (white dots)
  for (const v of G.vehicles) {
    if (v.driver === 'player' || v.wrecked) continue;
    const m = toM(v.x, v.y);
    ctx.fillStyle = v.kind === 'police' ? '#5a9bff' : 'rgba(255,255,255,0.65)';
    ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
  }
  // cops
  for (const c of G.cops) {
    const m = toM(c.x, c.y);
    ctx.fillStyle = '#3b6bff';
    ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
  }
  // mission marker (blinking)
  if (G.missionMarker) {
    const m = toM(G.missionMarker.x, G.missionMarker.y);
    const blink = Math.sin(G.time * 6) > 0;
    ctx.fillStyle = blink ? '#ffd84a' : '#e0a52e';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 7); ctx.lineTo(m.x + 5, m.y + 3); ctx.lineTo(m.x - 5, m.y + 3);
    ctx.closePath(); ctx.fill();
  }
  // player arrow
  const m = toM(t.x, t.y);
  const ang = p.inCar ? p.inCar.angle : p.facing;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = '#7ce07c';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.restore();

  // frame
  ctx.strokeStyle = 'rgba(240,232,210,0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x0 + size / 2, y0 + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}
