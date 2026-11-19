// HUD: health/armour, money, wanted stars, weapon+ammo, objective, mission
// timer, dialogue subtitles, shop prompt, busted/wasted overlays.

import { G } from '../core/state.js';
import { WEAPONS } from '../entities/player.js';

export function drawHUD(ctx, canvas) {
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.textAlign = 'left';

  // Money
  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(20,26,20,0.55)';
  ctx.fillRect(20, 16, 190, 34);
  ctx.fillStyle = '#9ee493';
  ctx.fillText('$' + G.money.toLocaleString(), 30, 41);

  // Wanted stars
  const starY = 66;
  ctx.font = '20px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd84a' : 'rgba(255,255,255,0.22)';
    ctx.fillText('\u2605', 26 + i * 24, starY);
  }

  // Health + armour bars
  const p = G.player;
  if (p) {
    bar(ctx, 20, H - 64, 200, 14, p.health / p.maxHealth, '#e05a4c', '#571b15');
    if (G.armour > 0) bar(ctx, 20, H - 42, 200, 10, G.armour / 100, '#6fb3e0', '#1c3e57');
  }

  // Weapon + ammo
  if (p && !p.inCar) {
    const w = WEAPONS[G.weapon];
    const slot = G.weapons[G.weapon];
    const ammo = w.melee ? '\u221e' : (slot ? slot.ammo : 0);
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(20,26,20,0.55)';
    ctx.fillRect(20, H - 92, 150, 24);
    ctx.fillStyle = '#f2e8d5';
    ctx.fillText(`${w.name}  ${ammo}`, 28, H - 75);
  }

  // Objective
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  const objLines = wrap(ctx, G.objective, W * 0.55);
  let oy = 28;
  ctx.fillStyle = 'rgba(15,20,26,0.6)';
  ctx.fillRect(W / 2 - W * 0.28, 10, W * 0.56, 18 + objLines.length * 19);
  ctx.fillStyle = '#ffe9b8';
  for (const ln of objLines) { ctx.fillText(ln, W / 2, oy + 15); oy += 19; }

  // Mission timer
  if (G.missionTimer > 0) {
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillStyle = G.missionTimer < 10 ? '#ff6a5a' : '#ffe9b8';
    ctx.fillText(Math.ceil(G.missionTimer) + 's', W / 2, oy + 34);
  }

  // Dialogue subtitles
  if (G.dialogue && G.time < G.dialogue.until) {
    ctx.font = '17px Georgia, serif';
    const who = G.dialogue.who;
    const lines = wrap(ctx, `\u201C${G.dialogue.text}\u201D`, W * 0.7);
    const bh = 34 + lines.length * 22;
    ctx.fillStyle = 'rgba(10,12,16,0.72)';
    ctx.fillRect(W / 2 - W * 0.36, H - bh - 14, W * 0.72, bh);
    ctx.fillStyle = '#f0c869';
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText(who, W / 2, H - bh + 6);
    ctx.font = '17px Georgia, serif';
    ctx.fillStyle = '#f6f1e4';
    let ly = H - bh + 30;
    for (const ln of lines) { ctx.fillText(ln, W / 2, ly); ly += 22; }
  }

  // Mission prompt
  if (G.missionPromptShown) {
    ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center';
    ctx.fillText('Press M to start the job', W / 2, H * 0.62);
  }

  // Shop prompt
  if (G.shopPrompt) {
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#cfe6ff';
    ctx.textAlign = 'center';
    ctx.fillText(G.shopPrompt.label, W / 2, H * 0.68);
  }

  // Hit flash
  if (G.hitFlash > 0) {
    ctx.fillStyle = `rgba(190,30,20,${G.hitFlash * 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

function bar(ctx, x, y, w, h, f, color, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, f)), h - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawOverlay(ctx, canvas, kind, info) {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,0,0,0.72)' : 'rgba(10,14,40,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillStyle = kind === 'wasted' ? '#e8d6c0' : '#cfe0ff';
  ctx.fillText(kind.toUpperCase(), W / 2, H / 2 - 20);
  ctx.font = '20px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#f2e8d5';
  ctx.fillText(info ? `Fine paid: $${info.fine}  \u2014  respawning...` : 'respawning...', W / 2, H / 2 + 26);
}
