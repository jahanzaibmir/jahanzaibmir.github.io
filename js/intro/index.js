// Start up sequence, in the spirit of Windows:
//   1. boot: the tesseract logo draws itself above the spinning dots
//   2. lock screen: the visitor's own time and date
//   3. the lock screen slides up and the page settles in underneath
// Any click, key, wheel or touch skips straight to step 3. Coming back in
// the same tab skips the boot and shows the lock screen only briefly.

import { reduceMotion, store } from '../lib/env.js';
import { lockScroll, unlockScroll } from '../lib/smooth.js';
import { startLogo } from './logo.js';

const body = document.body;
const root = document.documentElement;
const emit = (name) => document.dispatchEvent(new CustomEvent(name));

export function runIntro() {
  const intro = document.getElementById('intro');
  if (!intro || reduceMotion) {
    root.classList.remove('is-intro');
    body.classList.remove('is-loading');
    body.classList.add('intro-done');
    emit('intro:lift');
    emit('intro:done');
    return;
  }

  lockScroll('intro');
  setClock(intro);

  const quick = store.get('intro-seen') === '1';
  const timers = [];
  let stopLogo = () => {};
  let lifted = false;

  const skip = () => lift();
  const skipKeys = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    lift();
  };

  function lift() {
    if (lifted) return;
    lifted = true;
    timers.forEach(clearTimeout);
    intro.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skipKeys);
    window.removeEventListener('wheel', skip);
    window.removeEventListener('touchstart', skip);
    store.set('intro-seen', '1');

    body.classList.add('intro-lock', 'intro-lift');
    emit('intro:lift');

    setTimeout(() => {
      root.classList.remove('is-intro');
      body.classList.remove('is-loading');
      unlockScroll('intro');
    }, 120);
    setTimeout(() => {
      stopLogo();
      body.classList.add('intro-done');
      emit('intro:done');
    }, 1200);
  }

  if (quick) {
    body.classList.add('intro-quick', 'intro-lock');
    timers.push(setTimeout(lift, 1000));
  } else {
    stopLogo = startLogo(intro.querySelector('.boot-logo'));
    timers.push(setTimeout(() => body.classList.add('intro-lock'), 2100));
    timers.push(setTimeout(lift, 3600));
  }

  intro.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skipKeys);
  window.addEventListener('wheel', skip, { passive: true });
  window.addEventListener('touchstart', skip, { passive: true });
}

// Time and date in the visitor's own format, without AM or PM, like the
// Windows lock screen
function setClock(intro) {
  const now = new Date();
  const timeEl = intro.querySelector('.lock-time');
  const dateEl = intro.querySelector('.lock-date');
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(now);
    timeEl.textContent = parts
      .filter((p) => p.type !== 'dayPeriod')
      .map((p) => p.value)
      .join('')
      .trim();
    dateEl.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  } catch {
    timeEl.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
