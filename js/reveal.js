// Things tip and fade into view as they scroll onto the screen. Items that
// share a parent come in one after another instead of all at once. Small
// mono labels decode their text as they appear.
//
// When a section card is up, reveals wait until it lifts. The section the
// card opens is reset first, so it plays in fresh every time, like a page
// that has just been opened.

import { $, $$, afterIntro } from './lib/env.js';
import { scramble } from './lib/scramble.js';

const SELECTOR = '[data-reveal], [data-split], [data-flip], [data-win-in]';
const body = document.body;

function decode(el) {
  const target = el.matches('[data-scramble]') ? $('[data-scramble-text]', el) || el : null;
  if (target) scramble(target, target.dataset.text || target.textContent, { duration: 700, delay: 120 });
}

function show(el) {
  el.classList.add('is-in');
  decode(el);
}

export function initReveal() {
  const els = $$(SELECTOR);

  // remember each label's real text before anything scrambles it
  $$('[data-scramble-text]').forEach((t) => { t.dataset.text = t.textContent; });

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

  const waiting = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      if (body.classList.contains('card-on')) waiting.add(entry.target);
      else show(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  // wait for the lock screen, so nothing plays out of sight behind it
  afterIntro(() => els.forEach((el) => io.observe(el)));

  // the hero decodes its first line as the lock screen lifts
  const role = $('.hero-role');
  const roleText = role ? role.textContent.trim() : '';
  if (role) {
    document.addEventListener('intro:lift', () => scramble(role, roleText, { duration: 900, delay: 350 }), { once: true });
  }

  /* ---------- Section cards ---------- */

  const hero = $('.hero');

  // the card is covering the page: put the section it opens back to its
  // hidden state, instantly, so it can play in again
  document.addEventListener('card:jump', (e) => {
    const section = document.getElementById(e.detail.id);
    if (!section) return;
    section.classList.add('no-anim');
    if (section === hero) {
      hero.classList.add('is-replay');
    } else {
      $$(SELECTOR, section).forEach((el) => {
        el.classList.remove('is-in');
        io.observe(el);
      });
    }
    void section.offsetWidth;
    section.classList.remove('no-anim');
  });

  // the card has started to lift: play everything that was waiting
  document.addEventListener('card:out', (e) => {
    setTimeout(() => {
      waiting.forEach(show);
      waiting.clear();
      if (e.detail.id === 'top' && hero) {
        hero.classList.remove('is-replay');
        if (role) scramble(role, roleText, { duration: 900, delay: 300 });
      }
    }, 60);
  });
}
