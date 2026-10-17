// The small label next to the shape, like the card beside a museum piece.
// It names the shape and shows how far it has turned in three 4D planes.

import { SHAPES } from './shapes.js';
import { scramble } from '../lib/scramble.js';

const deg = (a) => String(Math.round((((a * 180) / Math.PI) % 360 + 360) % 360)).padStart(3, '0');

export function createCaption(el) {
  if (!el) return null;
  const num = el.querySelector('.figure-num');
  const title = el.querySelector('.figure-title');
  const note = el.querySelector('.figure-note');
  const angles = el.querySelector('.figure-angles');
  const swapping = [el.querySelector('.figure-name'), note];

  let current = 0;
  let lastText = -1;
  let lastPlace = '';

  return {
    setShape(i) {
      if (i === current) return;
      current = i;
      num.textContent = String(i + 1).padStart(2, '0');
      scramble(title, SHAPES[i].name, { duration: 600 });
      scramble(note, SHAPES[i].note, { duration: 900, delay: 120 });
      swapping.forEach((node) => {
        node.classList.remove('is-swap');
        void node.offsetWidth; // restart the animation
        node.classList.add('is-swap');
      });
    },

    setAngles(a, time) {
      if (time - lastText < 0.12) return;
      lastText = time;
      angles.textContent = `XW ${deg(a[2])}°   YZ ${deg(a[3])}°   ZW ${deg(a[5])}°`;
    },

    place(x, y, alpha) {
      const key = `${x.toFixed(1)}|${y.toFixed(1)}|${alpha.toFixed(3)}`;
      if (key === lastPlace) return;
      lastPlace = key;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = alpha.toFixed(3);
    }
  };
}
