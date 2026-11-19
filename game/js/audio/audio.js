// Synthesized audio: engine drone per vehicle, gunshots, impacts, sirens and
// a simple procedural radio loop. No files, all WebAudio oscillators/noise.

let ac = null;
let master = null;
let radioNodes = null;
let sirenNodes = null;
let engineNodes = null;

export function initAudio() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);
}

export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }

function noiseBuffer() {
  const len = ac.sampleRate * 1;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function playGunshot() {
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = noiseBuffer();
  const g = ac.createGain(); const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + 0.2);
}

export function playImpact(vol = 0.3) {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.15);
}

export function playPickup() {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(520, t);
  o.frequency.linearRampToValueAtTime(880, t + 0.09);
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.22);
}

export function updateEngine(active, speed01) {
  if (!ac) return;
  if (active && !engineNodes) {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 60;
    g.gain.value = 0.06;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    o.connect(f).connect(g).connect(master); o.start();
    engineNodes = { o, g };
  } else if (!active && engineNodes) {
    engineNodes.o.stop(); engineNodes = null;
  }
  if (engineNodes) {
    engineNodes.o.frequency.value = 55 + speed01 * 130;
    engineNodes.g.gain.value = 0.05 + speed01 * 0.06;
  }
}

export function updateSiren(on) {
  if (!ac) return;
  if (on && !sirenNodes) {
    const o = ac.createOscillator(); const g = ac.createGain();
    const lfo = ac.createOscillator(); const lg = ac.createGain();
    o.type = 'sine'; o.frequency.value = 700; g.gain.value = 0.05;
    lfo.frequency.value = 1.4; lg.gain.value = 180;
    lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(master);
    o.start(); lfo.start();
    sirenNodes = { o, lfo, g };
  } else if (!on && sirenNodes) {
    sirenNodes.o.stop(); sirenNodes.lfo.stop(); sirenNodes = null;
  }
}

// Procedural radio: slow warm chord loop.
export function startRadio() {
  if (!ac || radioNodes) return;
  const g = ac.createGain(); g.gain.value = 0.05; g.connect(master);
  const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]];
  let idx = 0;
  const timer = setInterval(() => {
    if (!ac) return;
    const chord = chords[idx++ % chords.length];
    const t = ac.currentTime;
    for (const f of chord) {
      const o = ac.createOscillator(); const og = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      og.gain.setValueAtTime(0.0, t);
      og.gain.linearRampToValueAtTime(0.3, t + 0.4);
      og.gain.linearRampToValueAtTime(0.0, t + 1.9);
      o.connect(og).connect(g); o.start(t); o.stop(t + 2);
    }
  }, 2000);
  radioNodes = { g, timer };
}

export function stopRadio() {
  if (radioNodes) { clearInterval(radioNodes.timer); radioNodes.g.disconnect(); radioNodes = null; }
}
