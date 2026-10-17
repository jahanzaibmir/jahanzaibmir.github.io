// Some effects need to know where things sit on the page. Reading that on
// every frame is slow, so it is measured once, and again only when the layout
// really changes: a resize, fonts arriving, or the page changing height.

import { coarsePointer } from './env.js';

const jobs = new Set();
let queued = false;

export function onMeasure(fn) {
  jobs.add(fn);
  fn();
  return () => jobs.delete(fn);
}

export function remeasure() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    jobs.forEach((fn) => fn());
  });
}

// Distance from the top of the document, ignoring any CSS transforms on the
// way up (the page is scaled while the intro plays, and that must not count).
export function docTop(el) {
  let y = 0;
  while (el) {
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return y;
}

// Height of the page from its layout. Unlike scrollHeight this ignores
// transforms, which matters while the intro has the page tilted.
export function pageHeight() {
  return document.body.offsetHeight;
}

let lastWidth = window.innerWidth;
let lastHeight = window.innerHeight;
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // phones fire resize when the address bar slides in and out; ignore that
  if (coarsePointer && w === lastWidth && Math.abs(h - lastHeight) < 120) return;
  lastWidth = w;
  lastHeight = h;
  remeasure();
});

window.addEventListener('load', remeasure);
document.addEventListener('intro:done', remeasure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
