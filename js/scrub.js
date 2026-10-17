// Effects tied directly to the scroll position, so they move exactly as far
// as the page does:
//   the hero leans back into the screen and fades as you leave it,
//   the About statement lights up word by word as you read down,
//   the big name in the footer stands up letter by letter.

import { $, clamp, reduceMotion } from './lib/env.js';
import { onFrame } from './lib/ticker.js';
import { onMeasure, docTop, pageHeight } from './lib/layout.js';
import { splitPlainWords, splitLetters } from './lib/split.js';

export function initScrub() {
  heroExit();
  statementWords();
  outroLetters();
}

function heroExit() {
  const inner = $('.hero-inner');
  if (!inner || reduceMotion) return;

  let ready = false;
  let last = -1;
  document.addEventListener('intro:done', () => { ready = true; }, { once: true });

  onFrame((fr) => {
    if (!ready) return;
    const p = clamp(fr.y / (fr.vh * 0.9));
    if (Math.abs(p - last) < 0.0005) return;
    last = p;
    if (p === 0) {
      inner.style.transform = '';
      inner.style.opacity = '';
      return;
    }
    inner.style.transform =
      `perspective(1200px) translate3d(0, ${(-p * 80).toFixed(1)}px, ${(-p * 160).toFixed(1)}px) rotateX(${(p * 18).toFixed(2)}deg)`;
    inner.style.opacity = clamp(1 - p * 1.1).toFixed(3);
  });
}

function statementWords() {
  const el = $('[data-words]');
  if (!el) return;
  const words = splitPlainWords(el);
  if (reduceMotion) return;

  let top = 0;
  let height = 0;
  onMeasure(() => {
    top = docTop(el);
    height = el.offsetHeight;
  });

  const shown = words.map(() => -1);
  let last = -1;
  onFrame((fr) => {
    // from when the statement enters at 88% down the screen until its last
    // line reaches 45%
    const start = top - fr.vh * 0.88;
    const end = top + height - fr.vh * 0.45;
    const p = clamp((fr.y - start) / Math.max(1, end - start));
    if (Math.abs(p - last) < 0.0008) return;
    last = p;
    const lit = p * (words.length + 1.5);
    words.forEach((w, i) => {
      const v = Math.round(clamp(lit - i) * 100) / 100;
      if (v !== shown[i]) {
        shown[i] = v;
        w.style.opacity = (0.16 + 0.84 * v).toFixed(2);
        w.style.transform = v >= 1 ? 'none' : `translate3d(0, ${((1 - v) * 0.2).toFixed(3)}em, 0)`;
      }
    });
  });
}

function outroLetters() {
  const el = $('[data-outro]');
  if (!el) return;
  const letters = splitLetters(el);

  let top = 0;
  let room = 1;
  onMeasure(() => {
    fitWidth(el);
    top = docTop(el);
    // the page may end before the name gets far up the screen, so make sure
    // the letters are fully up by the time the bottom is reached
    room = pageHeight() - top;
  });
  if (reduceMotion) return;

  let last = -1;
  onFrame((fr) => {
    // stands up while its top climbs from the bottom of the screen
    const p = clamp((fr.y + fr.vh - top) / Math.max(60, Math.min(fr.vh * 0.45, room * 0.85)));
    if (Math.abs(p - last) < 0.0008) return;
    last = p;
    const n = letters.length;
    letters.forEach((c, i) => {
      const q = clamp(p * 1.7 - (i / n) * 0.7);
      if (q >= 1) {
        c.style.transform = '';
        c.style.opacity = '';
        return;
      }
      const e = 1 - Math.pow(1 - q, 3);
      c.style.transform = `translate3d(0, ${((1 - e) * 22).toFixed(1)}%, 0) rotateX(${((1 - e) * 88).toFixed(1)}deg)`;
      c.style.opacity = (0.1 + 0.9 * e).toFixed(3);
    });
  });
}

// size the footer name so it fills the width of the page exactly. The probe
// copies the letter spans, so it measures them the way they really sit.
function fitWidth(el) {
  const probe = document.createElement('span');
  probe.innerHTML = el.innerHTML;
  // letter spacing is set again here, because an inherited em value would
  // still be sized from the old font size
  probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:100px;letter-spacing:-0.055em;';
  el.appendChild(probe);
  const w = probe.offsetWidth;
  probe.remove();
  const avail = el.clientWidth;
  if (w > 0 && avail > 0) el.style.fontSize = `${((avail / w) * 100 * 0.985).toFixed(2)}px`;
}
