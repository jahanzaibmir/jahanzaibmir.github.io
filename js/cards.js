// Section cards. Picking a section from the menu first shows a full screen
// card for it, like the splash screen of an app opening: its number, its
// name and its 4D shape. While the card covers the screen the page moves to
// that section underneath. Then the card wipes away upward and the section
// plays in.
//
// The wipe is two layers moving against each other: the card slides, and
// everything inside it slides back the same amount, so the content stays
// still on screen while the edge sweeps across. That keeps the card's
// shape (drawn by the scene onto the card's own canvas) lined up exactly
// with the shape on the page, so it never jumps between the two.

import { $, clamp, reduceMotion, escapeHtml } from './lib/env.js';
import { onFrame, resetSpeed } from './lib/ticker.js';
import { lockScroll, unlockScroll, jumpTo } from './lib/smooth.js';
import { docTop } from './lib/layout.js';
import { snapWhere } from './lib/sections.js';
import { scramble } from './lib/scramble.js';
import { sceneCards } from './scene/index.js';
import { SHAPES } from './scene/shapes.js';

const CHAPTERS = {
  top: { n: 0, title: 'Home', line: 'Cybersecurity engineer and researcher' },
  about: { n: 1, title: 'About', line: 'From the kernel to the network' },
  work: { n: 2, title: 'Work', line: 'Things I have built' },
  skills: { n: 3, title: 'Skills', line: 'What I work with' },
  contact: { n: 4, title: 'Contact', line: 'Say hello' }
};

// seconds: wipe in, hold, wipe out
const IN = 0.72;
const HOLD = 0.72;
const OUT = 0.85;
const EDGE = 180; // height of the soft shadow along the moving edge

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const body = document.body;

let card, stage, inner, edge;
let numEl, titleEl, lineEl, shapeEl, ownerEl;
let run = null;

export function initCards() {
  card = $('#card');
  if (!card || reduceMotion) return;
  stage = $('.card-stage', card);
  inner = $('.card-inner', card);
  edge = $('.card-edge');
  numEl = $('.card-num-now', card);
  titleEl = $('.card-title', card);
  lineEl = $('.card-line', card);
  shapeEl = $('.card-shape', card);
  ownerEl = $('.card-owner', card);

  // a click or key skips the wait once the page has moved
  card.addEventListener('pointerdown', () => { if (run) run.skip = true; });
  window.addEventListener('keydown', () => { if (run) run.skip = true; });

  onFrame(step);
}

// Returns false when no card can play, so the caller scrolls normally.
export function playCard(id) {
  const chapter = CHAPTERS[id];
  if (!card || !chapter || run || reduceMotion) return false;
  if (body.classList.contains('is-loading')) return false;

  run = { id, n: chapter.n, t0: performance.now() / 1000, phase: 'in', shown: false, skip: false };

  numEl.textContent = String(chapter.n).padStart(2, '0');
  titleEl.innerHTML = [...chapter.title]
    .map((ch, i) => `<span class="ch" style="--i:${i}">${escapeHtml(ch)}</span>`)
    .join('');
  lineEl.textContent = chapter.line;
  shapeEl.textContent = SHAPES[chapter.n].name;

  card.classList.remove('is-shown', 'is-leaving');
  card.classList.add('is-on');
  run.h = card.clientHeight || window.innerHeight;
  place(run.h);
  if (edge) edge.className = 'card-edge is-in';
  body.classList.add('card-on');
  lockScroll('card');
  sceneCards.mirror = true;
  sceneCards.begin(chapter.n);
  return true;
}

// y: how far the card is pushed down (positive) or up (negative)
function place(y, shift = 0) {
  card.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  stage.style.transform = `translate3d(0, ${(-y).toFixed(1)}px, 0)`;
  inner.style.setProperty('--shift', `${shift.toFixed(2)}vh`);
  if (!edge) return;
  const at = y >= 0 ? y - EDGE : run.h + y;
  edge.style.transform = `translate3d(0, ${at.toFixed(1)}px, 0)`;
}

function step(fr) {
  if (!run) return;
  const now = fr.time;
  const h = run.h;

  if (run.phase === 'in') {
    const k = clamp((now - run.t0) / IN);
    const p = easeInOut(k);
    place((1 - p) * h, (1 - p) * 14);
    if (!run.shown && k > 0.38) {
      run.shown = true;
      card.classList.add('is-shown');
      scramble(numEl, numEl.textContent, { duration: 500 });
      scramble(ownerEl, 'Jahanzaib Ashraf Mir', { duration: 700 });
      scramble(shapeEl, shapeEl.textContent, { duration: 800, delay: 250 });
    }
    if (k >= 1) {
      cover();
      run.phase = 'hold';
      run.tPhase = now;
      sceneCards.covered = true;
    }
  } else if (run.phase === 'hold') {
    if (run.skip || now - run.tPhase >= HOLD) {
      leave();
      run.phase = 'out';
      run.tPhase = now;
    }
  } else {
    const k = clamp((now - run.tPhase) / OUT);
    const p = easeInOut(k);
    place(-p * h, -p * 9);
    if (k >= 1) finish();
  }
}

// the card fully covers the screen: move the page underneath
function cover() {
  const el = document.getElementById(run.id);
  document.dispatchEvent(new CustomEvent('card:jump', { detail: { id: run.id } }));
  jumpTo(run.id === 'top' || !el ? 0 : docTop(el));
  resetSpeed();
  snapWhere(run.n);
  if (el && run.id !== 'top') {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}

function leave() {
  sceneCards.covered = false;
  card.classList.add('is-leaving');
  if (edge) edge.className = 'card-edge is-out';
  sceneCards.release();
  unlockScroll('card');
  body.classList.remove('card-on');
  document.dispatchEvent(new CustomEvent('card:out', { detail: { id: run.id } }));
}

function finish() {
  card.classList.remove('is-on', 'is-shown', 'is-leaving');
  card.style.transform = '';
  stage.style.transform = '';
  inner.style.removeProperty('--shift');
  if (edge) {
    edge.className = 'card-edge';
    edge.style.transform = '';
  }
  sceneCards.mirror = false;
  run = null;
}
