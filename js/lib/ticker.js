// One requestAnimationFrame loop for the whole page. Modules subscribe to it
// instead of running loops of their own, so the scroll position is read once
// per frame and every effect works from the same numbers.

const subscribers = new Set();

export const frame = {
  time: 0,  // seconds since the page opened
  dt: 1 / 60,
  y: 0,     // scroll position
  vy: 0,    // scroll speed in pixels per second, smoothed
  vw: window.innerWidth,
  vh: window.innerHeight
};

let lenis = null;
let started = false;
let last = 0;
let lastY = window.scrollY;

export function setLenis(instance) {
  lenis = instance;
}

// After the page jumps (behind a section card) the jump must not count as
// a burst of scrolling.
export function resetSpeed() {
  lastY = window.scrollY;
  frame.y = lastY;
  frame.vy = 0;
}

export function onFrame(fn) {
  subscribers.add(fn);
  if (!started) {
    started = true;
    requestAnimationFrame(tick);
  }
  return () => subscribers.delete(fn);
}

window.addEventListener('resize', () => {
  frame.vw = window.innerWidth;
  frame.vh = window.innerHeight;
});

function tick(now) {
  requestAnimationFrame(tick);
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  last = now;

  if (lenis) lenis.raf(now);

  frame.time = now / 1000;
  frame.dt = dt;
  frame.y = window.scrollY;
  const speed = (frame.y - lastY) / dt;
  frame.vy += (speed - frame.vy) * Math.min(1, dt * 7);
  lastY = frame.y;

  // one broken effect must not stop the others, so each runs on its own
  subscribers.forEach((fn) => {
    try {
      fn(frame);
    } catch (err) {
      subscribers.delete(fn);
      console.error('[frame]', err);
    }
  });
}
