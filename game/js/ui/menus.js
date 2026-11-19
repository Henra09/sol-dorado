// Menus: title screen (Play / Continue / Controls / Credits), pause menu,
// shop screen. Mouse-driven with clickable rects.

import { G } from '../core/state.js';
import { mouse } from '../core/input.js';
import { hasSave, tryBuy, getShop, closeShop } from '../systems/economy.js';

const TITLE = 'SOL DORADO';
const TAGLINE = 'every sun casts a shadow';

let buttons = [];

function button(ctx, b, hovered, disabled) {
  const W = b.w || 240;
  ctx.fillStyle = disabled ? 'rgba(60,64,70,0.8)' : hovered ? 'rgba(224,178,62,0.92)' : 'rgba(20,26,34,0.85)';
  ctx.strokeStyle = hovered ? '#fff2cf' : 'rgba(224,178,62,0.8)';
  ctx.lineWidth = 2;
  ctx.fillRect(b.x, b.y, W, b.h || 46);
  ctx.strokeRect(b.x, b.y, W, b.h || 46);
  ctx.fillStyle = hovered ? '#1a1408' : '#ffe9b8';
  ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, b.x + W / 2, b.y + (b.h || 46) / 2 + 6);
}

function hit(b, W) {
  return mouse.x >= b.x && mouse.x <= b.x + (b.w || 240) && mouse.y >= b.y && mouse.y <= b.y + (b.h || 46);
}

export function drawTitle(ctx, canvas, actions) {
  const W = canvas.width, H = canvas.height;
  // warm sky backdrop
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a2530');
  g.addColorStop(0.45, '#a45a3a');
  g.addColorStop(0.7, '#e0a04a');
  g.addColorStop(1, '#f2cf7e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun
  ctx.fillStyle = 'rgba(255,224,150,0.9)';
  ctx.beginPath(); ctx.arc(W * 0.5, H * 0.62, 110, 0, Math.PI * 2); ctx.fill();
  // skyline silhouette
  ctx.fillStyle = 'rgba(28,22,34,0.9)';
  let bx = 0;
  let seed = 7;
  while (bx < W) {
    const bw = 60 + (seed * 37) % 90;
    const bh = 60 + (seed * 53) % 190;
    ctx.fillRect(bx, H * 0.66 - bh, bw, bh + 40);
    bx += bw + 8; seed++;
  }
  // sea strip
  ctx.fillStyle = 'rgba(38,120,140,0.85)';
  ctx.fillRect(0, H * 0.78, W, H * 0.05);

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 76px Georgia, serif';
  ctx.fillStyle = 'rgba(20,14,8,0.85)';
  ctx.fillText(TITLE, W / 2 + 4, 172 + 4);
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(TITLE, W / 2, 172);
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillStyle = '#f2cf7e';
  ctx.fillText(TAGLINE, W / 2, 210);

  // Buttons
  buttons = [];
  const cx = W / 2 - 120;
  const defs = [
    { label: 'PLAY', act: actions.play },
    ...(hasSave() ? [{ label: 'CONTINUE', act: actions.continueGame }] : []),
    { label: 'CONTROLS', act: actions.controls },
    { label: 'CREDITS', act: actions.credits },
  ];
  let y = H * 0.62;
  for (const d of defs) {
    const b = { x: cx, y, w: 240, h: 46, label: d.label, act: d.act };
    buttons.push(b);
    button(ctx, b, hit(b));
    y += 58;
  }

  // Handle clicks
  if (mouse.clicked) {
    for (const b of buttons) if (hit(b)) { b.act(); break; }
  }
  if (mouse.x >= cx && mouse.x <= cx + 240) {
    canvas.style.cursor = buttons.some(b => hit(b)) ? 'pointer' : 'default';
  }
}

export function drawControls(ctx, canvas, back) {
  const W = canvas.width, H = canvas.height;
  dim(ctx, W, H);
  panel(ctx, W / 2 - 300, 70, 600, 560);
  ctx.textAlign = 'left';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText('CONTROLS', W / 2 - 260, 120);
  const rows = [
    ['W A S D', 'Move / drive'],
    ['SHIFT', 'Sprint'],
    ['MOUSE', 'Aim'],
    ['LEFT CLICK / SPACE', 'Shoot'],
    ['F or E', 'Enter / exit vehicle'],
    ['M', 'Start mission at marker'],
    ['B', 'Open shop at shop markers'],
    ['ESC / P', 'Pause'],
    ['R', 'Radio on/off'],
  ];
  ctx.font = '18px "Trebuchet MS", sans-serif';
  let y = 165;
  for (const [k, v] of rows) {
    ctx.fillStyle = '#f0c869';
    ctx.fillText(k, W / 2 - 260, y);
    ctx.fillStyle = '#f6f1e4';
    ctx.fillText(v, W / 2 - 80, y);
    y += 36;
  }
  drawBack(ctx, W, H, back);
}

export function drawCredits(ctx, canvas, back) {
  const W = canvas.width, H = canvas.height;
  dim(ctx, W, H);
  panel(ctx, W / 2 - 300, 90, 600, 500);
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText('SOL DORADO', W / 2, 150);
  ctx.font = '18px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#f6f1e4';
  const lines = [
    'An original open-world crime story.',
    '',
    'City, code, characters & audio:',
    'built from scratch for the make.fun gta6-01 jam.',
    '',
    'Starring Rosalia, Teo and Chico',
    '\u2014 and everyone who owes them money.',
    '',
    'No game engines. No libraries. Canvas 2D only.',
  ];
  let y = 200;
  for (const ln of lines) { ctx.fillText(ln, W / 2, y); y += 30; }
  drawBack(ctx, W, H, back);
}

export function drawPause(ctx, canvas, actions) {
  const W = canvas.width, H = canvas.height;
  dim(ctx, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText('PAUSED', W / 2, H * 0.3);
  buttons = [];
  const cx = W / 2 - 120;
  const defs = [
    { label: 'RESUME', act: actions.resume },
    { label: 'SAVE GAME', act: actions.save },
    { label: 'QUIT TO TITLE', act: actions.quit },
  ];
  let y = H * 0.42;
  for (const d of defs) {
    const b = { x: cx, y, w: 240, h: 46, label: d.label, act: d.act };
    buttons.push(b);
    button(ctx, b, hit(b));
    y += 58;
  }
  if (mouse.clicked) for (const b of buttons) if (hit(b)) { b.act(); break; }
}

export function drawShop(ctx, canvas) {
  const W = canvas.width, H = canvas.height;
  dim(ctx, W, H);
  const s = getShop();
  if (!s) return;
  const isGun = s.kind === 'gun';
  panel(ctx, W / 2 - 280, 110, 560, 440);
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(isGun ? 'BRASS & LEAD AMMUNITION' : 'MIRAGE CUSTOMS', W / 2, 160);
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#9ee493';
  ctx.fillText('Your cash: $' + G.money.toLocaleString(), W / 2, 190);

  buttons = [];
  let y = 220;
  s.items.forEach((item, i) => {
    const b = { x: W / 2 - 240, y, w: 480, h: 40, label: `${item.name}  \u2014  $${item.price}${G.money < item.price ? ' (need cash)' : ''}`, act: () => tryBuy(i) };
    buttons.push(b);
    button(ctx, b, hit(b) && G.money >= item.price, G.money < item.price);
    y += 50;
  });
  if (mouse.clicked) for (const b of buttons) if (hit(b)) { b.act(); break; }
  // close hint
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('press B to leave', W / 2, y + 24);
}

function drawBack(ctx, W, H, back) {
  const b = { x: W / 2 - 80, y: H - 110, w: 160, h: 42, label: 'BACK', act: back };
  button(ctx, b, hit(b));
  if (mouse.clicked && hit(b)) b.act();
}

function dim(ctx, W, H) {
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  ctx.fillRect(0, 0, W, H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(24,30,40,0.94)';
  ctx.strokeStyle = 'rgba(224,178,62,0.7)';
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
}
