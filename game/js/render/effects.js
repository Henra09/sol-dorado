// Effects: particles (muzzle, sparks, smoke, fireballs, blood), skid marks,
// warm colour grading, vignette, sun flare.

import { G } from '../core/state.js';
import { cam } from './camera.js';

export function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { G.particles.splice(i, 1); continue; }
    if (pt.vx || pt.vy) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
    }
    if (pt.kind === 'smoke') { pt.vy -= 6 * dt; pt.size += 12 * dt; }
  }
  for (const s of G.skids) s.a -= dt * 0.02;
  for (let i = G.skids.length - 1; i >= 0; i--) if (G.skids[i].a <= 0) G.skids.splice(i, 1);
}

export function drawParticles(ctx) {
  for (const pt of G.particles) {
    const f = pt.life / pt.maxLife;
    switch (pt.kind) {
      case 'muzzle':
        ctx.fillStyle = `rgba(255,220,120,${f * 0.9})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * f + 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark':
        ctx.fillStyle = `rgba(255,${180 + f * 60 | 0},80,${f})`;
        ctx.fillRect(pt.x - 1, pt.y - 1, 2.5, 2.5);
        break;
      case 'smoke':
        ctx.fillStyle = `rgba(70,66,62,${f * 0.45})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fireball':
        ctx.fillStyle = `rgba(255,${140 + f * 90 | 0},50,${f * 0.9})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1.6 - f), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'blood':
        ctx.fillStyle = `rgba(150,20,20,${f * 0.7})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * f + 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }
}

export function drawSkids(ctx) {
  ctx.fillStyle = 'rgba(25,22,20,0.5)';
  for (const s of G.skids) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

// Warm late-afternoon grade + vignette, applied after the world pass.
export function drawGrade(ctx, canvas) {
  const W = canvas.width, H = canvas.height;
  // warm overlay
  ctx.fillStyle = 'rgba(255,166,60,0.10)';
  ctx.fillRect(0, 0, W, H);
  // long sun rays from the west (simple diagonal soft light)
  const g = ctx.createLinearGradient(0, 0, W, H * 0.4);
  g.addColorStop(0, 'rgba(255,190,90,0.10)');
  g.addColorStop(0.5, 'rgba(255,190,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,6,2,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}
