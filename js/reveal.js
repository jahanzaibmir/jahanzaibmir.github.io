// Things tip and fade into view as they scroll onto the screen. Items that
// share a parent come in one after another instead of all at once.

import { $$, afterIntro } from './lib/env.js';

const SELECTOR = '[data-reveal], [data-split], [data-flip], [data-win-in]';

export function initReveal() {
  const els = $$(SELECTOR);

  const order = new Map();
  els.forEach((el) => {
    const n = order.get(el.parentElement) || 0;
    order.set(el.parentElement, n + 1);
    if (n) el.style.setProperty('--d', `${(Math.min(n, 8) * 0.08).toFixed(2)}s`);
  });

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  // wait for the lock screen, so nothing plays out of sight behind it
  afterIntro(() => els.forEach((el) => io.observe(el)));
}
