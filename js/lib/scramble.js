// Text that settles in letter by letter, left to right. Letters not yet in
// place cycle through random characters for a moment, like a terminal
// decoding a line. Only used on small mono text, so the width never jumps.

import { reduceMotion } from './env.js';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = LOWER.toUpperCase();
const DIGITS = '0123456789';
const running = new WeakMap();

function noiseFor(ch) {
  if (ch >= 'a' && ch <= 'z') return LOWER[(Math.random() * 26) | 0];
  if (ch >= 'A' && ch <= 'Z') return UPPER[(Math.random() * 26) | 0];
  if (ch >= '0' && ch <= '9') return DIGITS[(Math.random() * 10) | 0];
  return ch;
}

export function scramble(el, text, { duration = 650, delay = 0 } = {}) {
  if (!el) return;
  const final = text === undefined ? el.textContent : text;
  const prev = running.get(el);
  if (prev) {
    clearTimeout(prev.timer);
    cancelAnimationFrame(prev.raf);
  }
  if (reduceMotion || !final) {
    el.textContent = final;
    running.delete(el);
    return;
  }

  const chars = [...final];
  let noise = chars.map(noiseFor);
  el.textContent = noise.join('');

  const state = { timer: 0, raf: 0 };
  running.set(el, state);
  let start = 0;
  let lastSwap = 0;

  const tick = (now) => {
    if (!start) start = now;
    const p = Math.min(1, (now - start) / duration);
    // swap the noise a little slower than the frame rate, so it reads calm
    if (now - lastSwap > 55) {
      noise = chars.map(noiseFor);
      lastSwap = now;
    }
    const settled = Math.floor(p * chars.length);
    el.textContent = chars.map((c, i) => (i < settled ? c : noise[i])).join('');
    if (p < 1) {
      state.raf = requestAnimationFrame(tick);
    } else {
      el.textContent = final;
      running.delete(el);
    }
  };
  state.timer = setTimeout(() => {
    state.raf = requestAnimationFrame(tick);
  }, delay);
}
