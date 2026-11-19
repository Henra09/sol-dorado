// Smooth chase camera that leads travel direction and carries screen shake.

import { G } from '../core/state.js';

export const cam = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, zoom: 1 };

export function updateCamera(dt, target, lead) {
  if (!target) return;
  cam.tx = target.x + (lead ? lead.x * 0.55 : 0);
  cam.ty = target.y + (lead ? lead.y * 0.55 : 0);
  const k = 1 - Math.pow(0.0015, dt);      // critically-damped-ish smoothing
  cam.vx += (cam.tx - cam.x) * k * 0.5;
  cam.vy += (cam.ty - cam.y) * k * 0.5;
  cam.vx *= 0.82; cam.vy *= 0.82;
  cam.x += cam.vx; cam.y += cam.vy;
  // keep the view inside the world so we never show dead space
  import('../data/city-map.js').then(() => { });
  if (window.__worldBounds) {
    const [w, h] = window.__worldBounds;
    cam.x = Math.max(G.viewW / 2, Math.min(w - G.viewW / 2, cam.x));
    cam.y = Math.max(G.viewH / 2, Math.min(h - G.viewH / 2, cam.y));
  }
}

export function applyCamera(ctx) {
  ctx.save();
  const shx = (Math.random() - 0.5) * G.shake;
  const shy = (Math.random() - 0.5) * G.shake;
  ctx.translate(G.viewW / 2 - cam.x + shx, G.viewH / 2 - cam.y + shy);
}

export function dropCamera(ctx) { ctx.restore(); }
