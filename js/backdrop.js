// The page colour shifts gently between sections: slate grey for most of
// the page, near black behind the projects and at the very end.

import { $ } from './lib/env.js';
import { onFrame } from './lib/ticker.js';
import { where } from './lib/sections.js';

const COLOURS = [
  [36, 36, 38], // hero
  [35, 35, 37], // about
  [23, 23, 24], // work
  [36, 36, 38], // skills
  [27, 27, 28]  // contact
];

export function initBackdrop() {
  const el = $('.backdrop');
  if (!el) return;
  let last = '';
  onFrame(() => {
    const f = Math.min(Math.max(where.smooth, 0), COLOURS.length - 1);
    const a = Math.floor(f);
    const b = Math.min(a + 1, COLOURS.length - 1);
    const t = f - a;
    const rgb = COLOURS[a].map((c, i) => Math.round(c + (COLOURS[b][i] - c) * t));
    const css = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    if (css === last) return;
    last = css;
    el.style.backgroundColor = css;
  });
}
