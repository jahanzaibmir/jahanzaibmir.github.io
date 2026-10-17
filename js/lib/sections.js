// Turns the scroll position into one number that says where the reader is:
// 0 on the first section, 1 on the next, and so on. Between two sections it
// is somewhere in between, which is what drives the morphs and colour shifts.

import { clamp, reduceMotion } from './env.js';
import { onFrame } from './ticker.js';
import { onMeasure, docTop } from './layout.js';

export const SECTION_IDS = ['top', 'about', 'work', 'skills', 'contact'];

const tops = SECTION_IDS.map(() => 0);

onMeasure(() => {
  SECTION_IDS.forEach((id, i) => {
    const el = document.getElementById(id);
    tops[i] = el ? docTop(el) : 0;
  });
});

// A change starts when the next section's top reaches 75% down the screen
// and is done once it has climbed to 20%.
export function sectionCoord(y, vh) {
  let f = 0;
  for (let k = 1; k < tops.length; k++) {
    f += clamp((y + vh * 0.75 - tops[k]) / (vh * 0.55));
  }
  return f;
}

// raw follows the scroll exactly; smooth eases after it
export const where = { raw: 0, smooth: 0 };

// A section card has already shown the morph, so skip straight to it
export function snapWhere(value) {
  where.smooth = value;
}

let first = true;
onFrame((fr) => {
  where.raw = sectionCoord(fr.y, fr.vh);
  if (first || reduceMotion) {
    where.smooth = where.raw;
    first = false;
    return;
  }
  where.smooth += (where.raw - where.smooth) * (1 - Math.exp(-fr.dt * 4.5));
  if (Math.abs(where.raw - where.smooth) < 1e-4) where.smooth = where.raw;
});
