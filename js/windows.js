// The terminal and the message window work like desktop windows:
//   minimize sends the window down into the tray at the bottom,
//   maximize fills the screen (Escape or the button brings it back),
//   close puts it away until it is opened again.
// Double clicking a title bar maximizes it. The window's place on the page
// is kept while it is away, so nothing else jumps around.

import { $, $$, reduceMotion, escapeHtml } from './lib/env.js';
import { lockScroll, unlockScroll, scrollToY } from './lib/smooth.js';
import { docTop } from './lib/layout.js';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';
const body = document.body;

let maxed = null;

export function initWindows() {
  const tray = $('.tray');
  const backdrop = $('.win-backdrop');
  $$('[data-window]').forEach((win) => setupWindow(win, tray, backdrop));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && maxed) maxed.restore();
  });
  if (backdrop) backdrop.addEventListener('click', () => maxed && maxed.restore());
}

// Web Animations with a promise; the end state is held until the caller has
// swapped classes, then dropped.
function play(el, frames, duration, easing) {
  if (reduceMotion || !el.animate) return Promise.resolve();
  return new Promise((resolve) => {
    const anim = el.animate(frames, { duration, easing, fill: 'forwards' });
    anim.onfinish = () => {
      resolve();
      requestAnimationFrame(() => anim.cancel());
    };
    anim.oncancel = () => resolve();
  });
}

function setupWindow(win, tray, backdrop) {
  const slot = win.closest('.win-slot');
  const ghost = slot && $('.win-ghost', slot);
  if (!slot || !ghost) return;

  const ghostText = $('.win-ghost-text', ghost);
  const ghostBtn = $('button', ghost);
  const bar = $('.win-bar', win);
  const btnMax = $('[data-act="max"]', win);
  const title = win.dataset.title || 'Window';
  const name = win.dataset.name || title.toLowerCase();
  const icon = $('.win-title svg', win);
  const iconHtml = icon ? icon.outerHTML : '';

  let state = 'normal'; // normal, max, min or closed
  let busy = false;
  let trayBtn = null;
  let ghostAction = null;

  const api = { restore: () => unmaximize(true) };

  /* ---------- Maximize ---------- */

  function flip(first) {
    if (reduceMotion || !win.animate) return;
    const last = win.getBoundingClientRect();
    if (!last.width || !last.height) return;
    win.animate([
      {
        transformOrigin: '0 0',
        transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`
      },
      { transformOrigin: '0 0', transform: 'none' }
    ], { duration: 560, easing: EASE });
  }

  function showBackdrop(on) {
    if (!backdrop) return;
    if (on) {
      backdrop.hidden = false;
      void backdrop.offsetWidth;
      backdrop.classList.add('is-on');
    } else {
      backdrop.classList.remove('is-on');
      setTimeout(() => {
        if (!maxed) backdrop.hidden = true;
      }, 460);
    }
  }

  function maximize() {
    if (state !== 'normal' || busy || maxed) return;
    const first = win.getBoundingClientRect();
    slot.style.minHeight = `${slot.offsetHeight}px`;
    win.classList.add('is-max');
    body.classList.add('has-max');
    state = 'max';
    maxed = api;
    lockScroll('max');
    showBackdrop(true);
    btnMax.setAttribute('aria-label', `Restore ${name}`);
    flip(first);
  }

  function unmaximize(animated) {
    if (state !== 'max') return;
    const first = win.getBoundingClientRect();
    win.classList.remove('is-max');
    body.classList.remove('has-max');
    slot.style.minHeight = '';
    state = 'normal';
    maxed = null;
    unlockScroll('max');
    showBackdrop(false);
    btnMax.setAttribute('aria-label', `Maximize ${name}`);
    if (animated) flip(first);
  }

  /* ---------- Ghost left in the window's place ---------- */

  function showGhost(text, label, action) {
    const hadFocus = win.contains(document.activeElement);
    ghostText.textContent = text;
    ghostBtn.textContent = label;
    ghostAction = action;
    ghost.hidden = false;
    if (hadFocus) ghostBtn.focus({ preventScroll: true });
  }

  function hideGhost() {
    ghost.hidden = true;
    ghostAction = null;
  }

  ghostBtn.addEventListener('click', () => ghostAction && ghostAction());

  /* ---------- Tray ---------- */

  function addToTray() {
    if (!tray) return null;
    const list = $('ul', tray);
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-label="Restore ${escapeHtml(name)}">${iconHtml}<span>${escapeHtml(title)}</span></button>`;
    const btn = $('button', li);
    btn.addEventListener('click', restoreFromTray);
    list.appendChild(li);
    tray.classList.remove('is-leaving');
    tray.hidden = false;
    return btn;
  }

  function removeFromTray() {
    if (!trayBtn) return;
    trayBtn.parentElement.remove();
    trayBtn = null;
    const list = $('ul', tray);
    if (list.children.length) return;
    tray.classList.add('is-leaving');
    const done = () => {
      if (!list.children.length) {
        tray.hidden = true;
        tray.classList.remove('is-leaving');
      }
    };
    if (reduceMotion) done();
    else tray.addEventListener('animationend', done, { once: true });
  }

  // where the tray button will be once the tray has finished sliding up
  function trayTarget(from) {
    const r = trayBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = window.innerHeight - (window.innerWidth <= 600 ? 12 : 18) - 26;
    return {
      dx: x - (from.left + from.width / 2),
      dy: y - (from.top + from.height / 2),
      s: Math.max(0.05, Math.min(0.3, r.width / from.width))
    };
  }

  /* ---------- Minimize ---------- */

  async function minimize() {
    if (busy) return;
    if (state === 'max') unmaximize(false);
    if (state !== 'normal') return;
    busy = true;
    state = 'min';
    trayBtn = addToTray();
    const from = win.getBoundingClientRect();
    if (trayBtn) {
      const { dx, dy, s } = trayTarget(from);
      win.classList.add('is-flying');
      await play(win, [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) perspective(900px) rotateX(28deg) scale(${s})`, opacity: 0 }
      ], 520, EASE_IN);
      win.classList.remove('is-flying');
    }
    win.classList.add('is-gone');
    showGhost(`The ${name} is minimized.`, 'Restore', restoreFromTray);
    busy = false;
  }

  function restoreFromTray() {
    if (state !== 'min' || busy) return;
    const run = () => {
      if (state !== 'min') return;
      busy = true;
      const from = trayBtn ? trayBtn.getBoundingClientRect() : null;
      removeFromTray();
      hideGhost();
      win.classList.remove('is-gone');
      state = 'normal';
      const to = win.getBoundingClientRect();
      let frames = [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }];
      if (from) {
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        const s = Math.max(0.05, Math.min(0.3, from.width / to.width));
        frames = [
          { transform: `translate(${dx}px, ${dy}px) perspective(900px) rotateX(28deg) scale(${s})`, opacity: 0 },
          { transform: 'none', opacity: 1 }
        ];
      }
      win.classList.add('is-flying');
      play(win, frames, 620, EASE).then(() => {
        win.classList.remove('is-flying');
        busy = false;
        win.focus({ preventScroll: true });
      });
    };

    // bring the window's place onto the screen first, then fly it back
    const r = slot.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.2;
    if (onScreen) run();
    else scrollToY(docTop(slot) - Math.max(80, (window.innerHeight - slot.offsetHeight) / 2), { onDone: run });
  }

  /* ---------- Close ---------- */

  async function close() {
    if (busy) return;
    if (state === 'max') unmaximize(false);
    if (state !== 'normal') return;
    busy = true;
    state = 'closed';
    await play(win, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'perspective(1200px) rotateX(-10deg) scale(0.92)' }
    ], 240, 'cubic-bezier(0.4, 0, 1, 1)');
    win.classList.add('is-gone');
    showGhost(`The ${name} is closed.`, 'Open it again', reopen);
    busy = false;
  }

  function reopen() {
    if (state !== 'closed' || busy) return;
    busy = true;
    hideGhost();
    win.classList.remove('is-gone');
    state = 'normal';
    play(win, [
      { opacity: 0, transform: 'perspective(1200px) translate3d(0, 26px, -40px) rotateX(12deg) scale(0.94)' },
      { opacity: 1, transform: 'none' }
    ], 560, EASE).then(() => {
      busy = false;
      win.focus({ preventScroll: true });
    });
  }

  /* ---------- Title bar ---------- */

  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'min') minimize();
    else if (act.dataset.act === 'max') (state === 'max' ? unmaximize(true) : maximize());
    else if (act.dataset.act === 'close') close();
  });
  bar.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-act]')) return;
    if (state === 'max') unmaximize(true);
    else maximize();
  });
}
