// Projects. On large screens the section pins to the screen and the project
// windows sit in a 3D stack, each one further back and to the side. As you
// scroll, the front window lifts up and away past you and the next one
// slides forward to take its place. The list on the left follows along and
// can be clicked to jump to a project. Small screens and reduced motion get
// a plain list instead.

import { $, $$, clamp, smoothstep, easeOut, reduceMotion, afterIntro, whenClear } from './lib/env.js';
import { scramble } from './lib/scramble.js';
import { onFrame } from './lib/ticker.js';
import { onMeasure, docTop } from './lib/layout.js';
import { scrollToY } from './lib/smooth.js';

const BIG = window.matchMedia('(min-width: 960px) and (min-height: 600px)');
const STEP = 0.8; // screens of scrolling per project

export function initWork() {
  const section = $('#work');
  if (!section) return;
  const stage = $('.work-stage', section);
  const wins = $$('.pwin', section);
  const shades = wins.map((w) => $('.pwin-shade', w));
  const links = $$('.work-index a', section);
  const types = wins.map((w) => $('.pwin-top span:last-child', w));
  const typeText = types.map((t) => (t ? t.textContent : ''));
  const bar = $('.work-progress span', section);
  const n = wins.length;
  if (!stage || n < 2) return;

  let on = false;
  let top = 0;
  let span = 1;
  let W = 1;
  let H = 1;
  let lastKey = '';
  let front = -1;
  let entered = 0;
  let enterStart = -1;

  function setMode() {
    const want = BIG.matches && !reduceMotion;
    if (want === on) return;
    on = want;
    section.classList.toggle('is-3d', on);
    lastKey = '';
    front = -1;
    if (on) return;
    section.style.height = '';
    stage.style.transform = '';
    stage.style.opacity = '';
    wins.forEach((w, i) => {
      w.style.transform = '';
      w.style.opacity = '';
      w.style.visibility = '';
      w.style.zIndex = '';
      w.classList.remove('is-front');
      if (shades[i]) shades[i].style.opacity = '';
    });
    links.forEach((a) => a.classList.remove('is-on'));
  }

  onMeasure(() => {
    setMode();
    if (!on) return;
    const vh = window.innerHeight;
    span = (n - 1) * vh * STEP;
    section.style.height = `${Math.round(span + vh * 1.3)}px`;
    top = docTop(section);
    W = stage.offsetWidth || 1;
    H = stage.offsetHeight || 1;
    lastKey = '';
  });

  // 0 for the first project, 1 for the second and so on. Each project holds
  // still for a while before the next one moves in.
  function progress(y) {
    const raw = clamp((y - top) / span) * (n - 1);
    const i = Math.min(Math.floor(raw), n - 2);
    return i + smoothstep(0.12, 0.88, raw - i);
  }

  function place(i, rel) {
    const w = wins[i];
    if (rel > 3.6 || rel < -1) {
      w.style.visibility = 'hidden';
      w.style.opacity = '0';
      return;
    }
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let rx = 0;
    let ry = 0;
    let op = 1;
    let shade = 0;
    if (rel >= 0) {
      // waiting in the stack: back, up and to the right
      tx = rel * W * 0.06;
      ty = -rel * H * 0.085;
      tz = -rel * 190;
      ry = -Math.min(rel, 3) * 5;
      op = rel > 2.6 ? clamp(1 - (rel - 2.6)) : 1;
      shade = Math.min(rel * 0.3, 0.75);
    } else {
      // leaving: lifts up toward you, staying solid while it clears the
      // next window, and only then fades
      const r = -rel;
      ty = -r * H * 1.05;
      tz = r * 260;
      rx = r * 18;
      op = 1 - smoothstep(0.25, 0.75, r);
    }
    w.style.visibility = '';
    w.style.zIndex = String(n - i);
    w.style.opacity = op.toFixed(3);
    w.style.transform = Math.abs(rel) < 0.0005
      ? 'none'
      : `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
    if (shades[i]) shades[i].style.opacity = shade.toFixed(3);
  }

  onFrame((fr) => {
    if (!on) return;
    if (enterStart >= 0 && entered < 1) entered = easeOut(clamp((fr.time - enterStart) / 1.6));
    const p = progress(fr.y);
    // once the last project has had its moment, the whole stage tips back
    // into the screen as the section scrolls away
    const exit = clamp((fr.y - top - span) / (window.innerHeight * 0.3));
    const key = `${p.toFixed(4)}|${entered.toFixed(4)}|${exit.toFixed(4)}|${W}|${H}`;
    if (key === lastKey) return;
    lastKey = key;
    stage.style.transform = exit > 0
      ? `perspective(1600px) translate3d(0, ${(-exit * 40).toFixed(1)}px, ${(-exit * 160).toFixed(1)}px) rotateX(${(exit * 11).toFixed(2)}deg)`
      : '';
    // the stack fades in as one piece, so windows never show through each other
    const fade = entered * (1 - exit * 0.35);
    stage.style.opacity = fade < 1 ? fade.toFixed(3) : '';

    // before the section is reached the windows wait further back, hidden
    const back = (1 - entered) * 2.4;
    for (let i = 0; i < n; i++) place(i, i - p + back);

    const current = Math.round(p);
    if (current !== front) {
      front = current;
      links.forEach((a, i) => a.classList.toggle('is-on', i === current));
      wins.forEach((w, i) => w.classList.toggle('is-front', i === current));
      if (entered > 0.5 && types[current]) scramble(types[current], typeText[current], { duration: 600, delay: 150 });
    }
    if (bar) bar.style.transform = `scaleX(${(p / (n - 1)).toFixed(4)})`;
  });

  /* ---------- Jumping to a project ---------- */

  function go(i) {
    if (on) scrollToY(top + (span * i) / (n - 1) + 1);
    else scrollToY(docTop(wins[i]) - 96);
  }

  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(i);
    });
  });

  wins.forEach((w, i) => {
    // clicking a window further back brings it to the front
    w.addEventListener('click', (e) => {
      if (!on || i === front) return;
      e.preventDefault();
      go(i);
    });
    // so does tabbing into it from the keyboard
    w.addEventListener('focusin', () => {
      if (on && i !== front) go(i);
    });
  });

  /* ---------- First appearance ---------- */

  if (reduceMotion) {
    entered = 1;
    return;
  }
  afterIntro(() => {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      whenClear(() => { enterStart = performance.now() / 1000; });
    }, { threshold: 0.15 });
    io.observe(stage);
  });

  // opening Work from its section card deals the windows in again
  document.addEventListener('card:jump', (e) => {
    if (e.detail.id !== 'work' || !on) return;
    entered = 0;
    enterStart = -1;
    lastKey = '';
    whenClear(() => { enterStart = performance.now() / 1000; });
  });
}
