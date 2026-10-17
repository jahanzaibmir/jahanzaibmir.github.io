// Smooth scrolling with Lenis, loaded from a CDN. If it fails to load, the
// browser's own scrolling is used and nothing else changes.

import { reduceMotion } from './env.js';
import { setLenis } from './ticker.js';

let lenis = null;
const locks = new Set();
const root = document.documentElement;

export async function initSmooth() {
  if (reduceMotion) return;
  try {
    const { default: Lenis } = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.mjs');
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    setLenis(lenis);
    if (locks.size) lenis.stop();
  } catch {
    lenis = null;
  }
}

// Several things can freeze the page (the intro, the phone menu, a maximized
// window). Scrolling comes back only when all of them have let go.
export function lockScroll(key) {
  locks.add(key);
  root.classList.add('no-scroll');
  if (lenis) lenis.stop();
}

export function unlockScroll(key) {
  locks.delete(key);
  if (locks.size) return;
  root.classList.remove('no-scroll');
  if (lenis) lenis.start();
}

export function scrollToY(y, { onDone } = {}) {
  const top = Math.max(0, Math.round(y));
  if (lenis) {
    lenis.scrollTo(top, {
      duration: 1.5,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      onComplete: onDone
    });
    return;
  }
  window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (onDone) waitForScrollEnd(top, onDone);
}

// Move straight to a position with no animation. It works while scrolling is
// locked, which is how the section cards move the page behind themselves.
export function jumpTo(y) {
  const top = Math.max(0, Math.round(y));
  if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
  else window.scrollTo(0, top);
}

// Without Lenis there is no reliable "scroll finished" event everywhere,
// so watch the position until it stops moving.
function waitForScrollEnd(target, done) {
  let frames = 0;
  let lastY = -1;
  const check = () => {
    const y = window.scrollY;
    if (Math.abs(y - target) < 2 || frames > 90 || (y === lastY && frames > 6)) return done();
    lastY = y;
    frames++;
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
