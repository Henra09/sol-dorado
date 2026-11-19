// Keyboard + mouse input: an event-driven map consumed by gameplay systems.

const keys = Object.create(null);
const pressed = Object.create(null);   // true for one frame after keydown
export const mouse = { x: 0, y: 0, down: false, clicked: false };

export function initInput(canvas) {
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * canvas.width;
    mouse.y = (e.clientY - r.top) / r.height * canvas.height;
  });
  canvas.addEventListener('mousedown', e => { mouse.down = true; mouse.clicked = true; e.preventDefault(); });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

export function key(c) { return !!keys[c]; }
export function anyKeys(cs) { return cs.some(c => keys[c]); }
export function keyPressed(c) { return !!pressed[c]; }
export function endFrame() { for (const k in pressed) pressed[k] = false; mouse.clicked = false; }
