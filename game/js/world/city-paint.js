// City painter: pre-renders the entire static world (ground, roads, blocks,
// buildings with sunlit faces and long shadows, parks, beach, sea) into one
// large offscreen canvas. The game loop blits the visible region each frame.

import {
  TILE, MW, MH, WORLD_W, WORLD_H, buildTileGrid, tileHash,
  T_ROAD, T_SIDEWALK, T_BUILDING, T_PARK, T_PLAZA, T_SAND, T_WATER, T_COURT,
  ROADS_V, ROADS_H, ROAD_W,
} from '../data/city-map.js';

let cityCanvas = null;
let buildings = [];   // {x,y,w,h,baseColor,roofColor,faces} world-space rects, drawn each frame for dynamic windows
const rngState = { v: 12345 };
function rnd() { rngState.v = (rngState.v * 1103515245 + 12345) & 0x7fffffff; return rngState.v / 0x7fffffff; }

export function getCityCanvas() { return cityCanvas; }
export function getBuildings() { return buildings; }

const WARM_SUN = { dir: -0.55, len: 34 }; // shadow direction/length (late afternoon, sun from west)

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const DISTRICT_STYLES = [
  { y0: 0, y1: 26, walls: ['#e8c8a0', '#dfb78e', '#e3bfa0', '#d9ad84'], roofs: ['#c96a4e', '#b85a44', '#d47a52'], hMin: 1, hMax: 2 },
  { y0: 26, y1: 62, walls: ['#cdd3d8', '#c2c8ce', '#d6dadd', '#b9c0c8'], roofs: ['#4f6472', '#5b7080', '#42525f'], hMin: 2, hMax: 4 },
  { y0: 62, y1: 104, walls: ['#f0d9b8', '#e6cfa9', '#f4ddc0', '#dcc39c'], roofs: ['#3e8d96', '#357d88', '#4a9aa2'], hMin: 1, hMax: 3 },
];

function styleFor(ty) {
  for (const s of DISTRICT_STYLES) if (ty >= s.y0 && ty < s.y1) return s;
  return DISTRICT_STYLES[0];
}

export function paintCity() {
  const grid = buildTileGrid();
  cityCanvas = document.createElement('canvas');
  cityCanvas.width = WORLD_W;
  cityCanvas.height = WORLD_H;
  const ctx = cityCanvas.getContext('2d');

  // Ground base: warm asphalt-ish dark base for whole map.
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Ground pass.
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = grid[y][x];
    const px = x * TILE, py = y * TILE;
    switch (t) {
      case T_ROAD: {
        ctx.fillStyle = '#31353d';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      }
      case T_SIDEWALK: {
        const h = tileHash(x, y);
        ctx.fillStyle = h < 0.5 ? '#9a9284' : '#948c7e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(px, py, TILE, 1);
        ctx.fillRect(px, py, 1, TILE);
        break;
      }
      case T_PARK: {
        const h = tileHash(x, y);
        ctx.fillStyle = h < 0.5 ? '#5e8c48' : '#57823f';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      }
      case T_PLAZA: {
        ctx.fillStyle = '#a89c8a';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(px, py + TILE / 2 - 1, TILE, 2);
        break;
      }
      case T_SAND: {
        ctx.fillStyle = tileHash(x, y) < 0.5 ? '#e9d39a' : '#e5cd92';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      }
      case T_WATER: {
        ctx.fillStyle = '#2b8fa0';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      }
      case T_COURT: {
        ctx.fillStyle = '#6b675e';
        ctx.fillRect(px, py, TILE, TILE);
        break;
      }
    }
  }

  // Road lane markings + crosswalks.
  drawRoadMarkings(ctx);
  ctx.fillStyle = 'rgba(240,244,240,0.5)';
  ctx.fillRect(94 * TILE, 0, 6, WORLD_H);

  // Buildings pass: merge contiguous building tiles into rects.
  buildings = [];
  const used = grid.map(r => r.map(() => false));
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (grid[y][x] !== T_BUILDING || used[y][x]) continue;
    // grow rect
    let w = 1, h = 1;
    while (x + w < MW && grid[y][x + w] === T_BUILDING && !used[y][x + w]) w++;
    outer: for (let hy = 1; y + hy < MH; hy++) {
      for (let hx = 0; hx < w; hx++) if (grid[y + hy][x + hx] !== T_BUILDING || used[y + hy][x + hx]) break outer;
      hy++;
      hy--;
      // all row matches
      breakOrContinue: for (let hx = 0; hx < w; hx++) { }
      h = hy + 1;
      // mark used later
      if (hy + 1 >= 1 && h === hy + 1) { }
      // verify row
      let ok = true;
      for (let hx = 0; hx < w; hx++) if (grid[y + hy][x + hx] !== T_BUILDING || used[y + hy][x + hx]) { ok = false; break; }
      if (!ok) break outer;
    }
    for (let hy = 0; hy < h; hy++) for (let hx = 0; hx < w; hx++) used[y + hy][x + hx] = true;
    buildings.push(makeBuilding(x * TILE, y * TILE, w * TILE, h * TILE, (y / MH) * MH | 0));
  }

  paintBuildings(ctx);

  // Palm trees & street furniture (parked static props painted into the base).
  paintPalms(ctx, grid);
  paintBillboards(ctx, grid);

  return { grid, buildings };
}

function drawRoadMarkings(ctx) {
  const lane = 'rgba(232,214,150,0.85)';
  ctx.save();
  // vertical roads: dashed centre line
  for (const r of ROADS_V) {
    const cx = (r + ROAD_W / 2) * TILE;
    ctx.strokeStyle = lane;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, 96 * TILE);
    ctx.stroke();
    // sidewalk edge
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(220,220,210,0.25)';
    ctx.beginPath();
    ctx.moveTo((r + ROAD_W) * TILE - 1, 0);
    ctx.lineTo((r + ROAD_W) * TILE - 1, 96 * TILE);
    ctx.stroke();
  }
  for (const r of ROADS_H) {
    const cy = (r + ROAD_W / 2) * TILE;
    ctx.strokeStyle = lane;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(96 * TILE, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(220,220,210,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, (r + ROAD_W) * TILE - 1);
    ctx.lineTo(96 * TILE, (r + ROAD_W) * TILE - 1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // crosswalks at each intersection
  ctx.fillStyle = 'rgba(230,230,225,0.55)';
  for (const rv of ROADS_V) for (const rh of ROADS_H) {
    const x0 = rv * TILE, y0 = rh * TILE, w = ROAD_W * TILE;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x0 + 4 + i * 14, y0 - 10, 8, 8);          // top
      ctx.fillRect(x0 + 4 + i * 14, y0 + w + 2, 8, 8);       // bottom
      ctx.fillRect(x0 - 10, y0 + 4 + i * 14, 8, 8);          // left
      ctx.fillRect(x0 + w + 2, y0 + 4 + i * 14, 8, 8);       // right
    }
  }
  ctx.restore();
}

function makeBuilding(px, py, w, h, _d) {
  const style = styleFor(py / TILE);
  const floors = style.hMin + Math.floor(rnd() * (style.hMax - style.hMin + 1));
  const wall = style.walls[Math.floor(rnd() * style.walls.length)];
  const roof = style.roofs[Math.floor(rnd() * style.roofs.length)];
  const inset = 3 + Math.floor(rnd() * 4);
  return {
    x: px + inset, y: py + inset, w: w - inset * 2, h: h - inset * 2,
    wall, roof, floors, lift: floors * 9,
  };
}

function paintBuildings(ctx) {
  // Long soft shadows first.
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,10,0.35)';
  for (const b of buildings) {
    const dx = WARM_SUN.len * 0.8, dy = WARM_SUN.len * 0.45 + b.lift * 0.2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + dx * 0.35, b.y + b.h + dy);
    ctx.lineTo(b.x + dx * 0.35, b.y + b.h + dy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  for (const b of buildings) {
    // Sunlit south face (fake 2.5D extrusion towards screen bottom).
    const faceH = b.lift;
    const grad = ctx.createLinearGradient(0, b.y + b.h - faceH, 0, b.y + b.h);
    grad.addColorStop(0, shade(b.wall, 1.25));
    grad.addColorStop(1, shade(b.wall, 0.85));
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y + b.h - faceH, b.w, faceH);

    // Lit windows on the face.
    const cols = Math.max(1, Math.floor(b.w / 16));
    for (let i = 0; i < cols; i++) {
      for (let f = 0; f < b.floors; f++) {
        const wx = b.x + 5 + i * 16;
        const wy = b.y + b.h - faceH + 6 + f * 12;
        if (wx + 8 > b.x + b.w || wy + 6 > b.y + b.h) continue;
        ctx.fillStyle = tileHash(wx, wy) < 0.4 ? '#ffd98a' : 'rgba(60,70,80,0.85)';
        ctx.fillRect(wx, wy, 8, 6);
      }
    }

    // Roof (saturated top).
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h - faceH);
    ctx.fillStyle = shade(b.roof, 0.82);
    ctx.fillRect(b.x + b.w - 6, b.y, 6, b.h - faceH);
    ctx.fillStyle = shade(b.roof, 1.12);
    ctx.fillRect(b.x, b.y, 6, b.h - faceH);
    // roof detail: AC boxes
    if (rnd() < 0.6) {
      ctx.fillStyle = shade(b.roof, 0.7);
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.25, 12, 10);
    }
    // outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }
}

function paintPalms(ctx, grid) {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (grid[y][x] !== T_PARK && grid[y][x] !== T_SIDEWALK) continue;
    const h = tileHash(x * 7 + 3, y * 11 + 1);
    const onPark = grid[y][x] === T_PARK;
    if (h > (onPark ? 0.16 : 0.05)) continue;
    const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    drawPalm(ctx, px, py, 10 + h * 30);
  }
}

function drawPalm(ctx, px, py, s) {
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(20,16,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(8, 4, s * 0.5, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6a48';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.15, -s * 0.7);
  ctx.stroke();
  const top = { x: s * 0.15, y: -s * 0.7 };
  ctx.strokeStyle = '#3f7a3c';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.quadraticCurveTo(top.x + Math.cos(a) * s * 0.5, top.y + Math.sin(a) * s * 0.3,
      top.x + Math.cos(a) * s * 0.75, top.y + Math.sin(a) * s * 0.45 + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function paintBillboards(ctx, grid) {
  const brands = [
    ['#d94f4f', 'SOL FM 101.3'],
    ['#2f9aa0', 'MIRAGE MOTORS'],
    ['#e0b23e', 'BRASS & LEAD'],
    ['#7a4fa0', 'CORMORANT AIR'],
    ['#e07b3e', 'FLAMINGO COFFEE'],
  ];
  let bi = 0;
  let placed = 0;
  const minGap = TILE * 14;
  const spots = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (grid[y][x] !== T_PLAZA) continue;
    if (tileHash(x * 13 + 5, y * 17 + 9) > 0.2) continue;
    const px = x * TILE + 8, py = y * TILE + 12;
    if (spots.some(s => Math.hypot(s[0] - px, s[1] - py) < minGap)) continue;
    spots.push([px, py]);
    if (placed++ >= 5) break;
  }
  for (const [px, py] of spots) {
    const [c, name] = brands[bi++ % brands.length];
    ctx.fillStyle = 'rgba(20,16,10,0.3)';
    ctx.fillRect(px + 6, py + 6, 52, 24);
    ctx.fillStyle = '#54504a';
    ctx.fillRect(px + 24, py + 24, 4, 14);
    ctx.fillStyle = c;
    ctx.fillRect(px, py, 52, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, px + 26, py + 15);
    ctx.textAlign = 'left';
  }
}

export function blitCity(ctx, cam, viewW, viewH) {
  const sx = Math.max(0, cam.x - viewW / 2), sy = Math.max(0, cam.y - viewH / 2);
  const sw = Math.min(WORLD_W - sx, viewW), sh = Math.min(WORLD_H - sy, viewH);
  ctx.drawImage(cityCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
}
