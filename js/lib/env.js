// Small helpers and facts about the visitor's device that every module uses.

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// sessionStorage can throw in private windows, so every call is guarded
export const store = {
  get(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* not available */ }
  }
};

// Run fn once the lock screen has started to lift (or right away if it has).
// Things that animate on screen wait for this, so they are not wasted
// behind the intro.
export function afterIntro(fn) {
  const cl = document.body.classList;
  if (cl.contains('intro-lift') || cl.contains('intro-done')) fn();
  else document.addEventListener('intro:lift', fn, { once: true });
}

// Run fn now, or once the section card covering the page starts to lift,
// so animations never play out of sight behind it.
export function whenClear(fn) {
  if (!document.body.classList.contains('card-on')) fn();
  else document.addEventListener('card:out', () => fn(), { once: true });
}

export const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
