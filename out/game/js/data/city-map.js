// Hand-authored layout of Sol Dorado: the tile grid (roads, blocks, parks,
// beach and sea) plus the named districts and points of interest. Everything
// downstream (prerender, traffic, peds, missions) reads from here.

export const TILE = 36;
export const MW = 104;          // map width in tiles
export const MH = 104;          // map height in tiles
export const WORLD_W = MW * TILE;
export const WORLD_H = MH * TILE;

// Road centre lines (3 tiles wide: two lanes + shoulders drawn in paint).
export const ROADS_V = [5, 19, 33, 47, 61, 75, 89];
export const ROADS_H = [5, 19, 33, 47, 61, 75, 89];
export const ROAD_W = 3;

export const T_ROAD = 'r';
export const T_SIDEWALK = 's';
export const T_BUILDING = 'B';
export const T_PARK = 'g';
export const T_PLAZA = 'p';
export const T_SAND = 'n';
export const T_WATER = 'w';
export const T_COURT = 'c';      // open concrete inside a block

// Deterministic hash so the city is identical every run.
export function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// Grid of block interiors between roads. A block spans from road edge+1 to next road start-1.
function blockRanges(roads) {
  const ranges = [];
  for (let i = 0; i < roads.length - 1; i++) {
    ranges.push([roads[i] + ROAD_W, roads[i + 1] - 1]);
  }
  ranges.push([roads[roads.length - 1] + ROAD_W, 95]);
  return ranges;
}
export const BLOCKS_X = blockRanges(ROADS_V);
export const BLOCKS_Y = blockRanges(ROADS_H);

// Districts by block row band: north = Palms Vista (residential), centre =
// Meridian Core (downtown towers), south-east near the sea = Marina Sur.
export const DISTRICTS = [
  { name: 'PALMS VISTA', y0: 0, y1: 26 },
  { name: 'MERIDIAN CORE', y0: 26, y1: 62 },
  { name: 'MARINA SUR', y0: 62, y1: 104 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (y >= d.y0 * TILE && y < d.y1 * TILE) return d.name;
  return 'SOL DORADO';
}

// Which road a coordinate is on, for traffic lane logic.
export function isRoadCol(c) { return ROADS_V.some(r => c >= r && c < r + ROAD_W); }
export function isRoadRow(r) { return ROADS_H.some(v => r >= v && r < v + ROAD_W); }

// Build the static tile grid once.
export function buildTileGrid() {
  const g = [];
  for (let y = 0; y < MH; y++) { g.push(new Array(MW).fill(T_BUILDING)); }

  // Sea and beach down the whole east edge.
  for (let y = 0; y < MH; y++) {
    for (let x = 96; x < MW; x++) g[y][x] = T_WATER;
    g[y][95] = T_SAND;
    g[y][94] = T_SAND;
  }
  // A boardwalk road along the coast.
  for (let y = 0; y < MH; y++) { g[y][93] = T_ROAD; g[y][92] = T_ROAD; g[y][91] = T_ROAD; }

  for (const r of ROADS_V) for (let y = 0; y < 96; y++) for (let k = 0; k < ROAD_W; k++) g[y][r + k] = T_ROAD;
  for (const r of ROADS_H) for (let x = 0; x < 96; x++) for (let k = 0; k < ROAD_W; k++) g[r + k][x] = T_ROAD;

  const inBlocks = (x, y) =>
    BLOCKS_X.some(([a, b]) => x >= a && x <= b) && BLOCKS_Y.some(([a, b]) => y >= a && y <= b);

  // Sidewalk ring around every block.
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (g[y][x] !== T_BUILDING) continue;
    let nearRoad = false;
    for (let dy = -1; dy <= 1 && !nearRoad; dy++) for (let dx = -1; dx <= 1 && !nearRoad; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      if (g[ny][nx] === T_ROAD) nearRoad = true;
    }
    if (nearRoad && inBlocks(x, y)) g[y][x] = T_SIDEWALK;
  }

  // Parks: two full blocks; a beach plaza near the sea.
  const parkBlocks = [BLOCKS_X[2], BLOCKS_Y[1], BLOCKS_X[4], BLOCKS_Y[3]];
  for (let y = parkBlocks[1][0]; y <= parkBlocks[1][1]; y++) for (let x = parkBlocks[0][0]; x <= parkBlocks[0][1]; x++) g[y][x] = T_PARK;
  const park2X = BLOCKS_X[1], park2Y = BLOCKS_Y[4];
  for (let y = park2Y[0]; y <= park2Y[1]; y++) for (let x = park2X[0]; x <= park2X[1]; x++) g[y][x] = T_PARK;
  const plazaX = BLOCKS_X[5], plazaY = BLOCKS_Y[2];
  for (let y = plazaY[0]; y <= plazaY[1]; y++) for (let x = plazaX[0]; x <= plazaX[1]; x++) g[y][x] = T_PLAZA;

  // Alleys and courtyards inside downtown blocks.
  for (const [bx0, bx1] of BLOCKS_X) for (const [by0, by1] of BLOCKS_Y) {
    const cx = (bx0 + bx1) >> 1, cy = (by0 + by1) >> 1;
    if (tileHash(bx0, by0) < 0.35) {
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        if (g[y] && g[y][x] === T_BUILDING) g[y][x] = T_COURT;
      }
    }
  }

  return g;
}

// Named places (tile coords, snapped to sidewalk). Used by missions, shops and the stager.
export const PLACES = {
  gunShop:    { x: 23, y: 22, label: 'BRASS & LEAD AMMUNITION' },
  garage:     { x: 51, y: 22, label: 'MIRAGE CUSTOMS GARAGE' },
  diner:      { x: 37, y: 36, label: 'SUNRISE DINER' },
  towers:     { x: 65, y: 50, label: 'CORMORANT TOWERS' },
  marina:     { x: 79, y: 72, label: 'MARINA SUR DOCKS' },
  hotel:      { x: 9,  y: 8,  label: 'AZUL PALMS HOTEL' },
  penthouse:  { x: 23, y: 64, label: 'VERANDA HEIGHTS' },
  warehouse:  { x: 79, y: 22, label: 'DEL ORO WAREHOUSE' },
  raceStart:  { x: 37, y: 78, label: 'BOARDWALK STRIP' },
};

export function tileCenter(t) { return { x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 }; }
