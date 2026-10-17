// Entry point. Every part of the page lives in its own module; this file
// only decides the order they start in. A part that fails is logged and
// skipped, so one problem never takes the whole page down.

import { $ } from './lib/env.js';
import { splitAll } from './lib/split.js';
import { initSmooth } from './lib/smooth.js';
import { initScene } from './scene/index.js';
import { initCards } from './cards.js';
import { initBackdrop } from './backdrop.js';
import { initNav } from './nav.js';
import { initWindows } from './windows.js';
import { initTerminal } from './terminal.js';
import { initWork } from './work.js';
import { initForm } from './form.js';
import { initScrub } from './scrub.js';
import { initReveal } from './reveal.js';
import { runIntro } from './intro/index.js';

function start(name, fn) {
  try {
    fn();
    return true;
  } catch (err) {
    console.error(`[${name}]`, err);
    return false;
  }
}

const year = $('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

start('text', splitAll);
start('scene', initScene);
start('cards', initCards);
start('backdrop', initBackdrop);
start('nav', initNav);
start('windows', initWindows);
start('terminal', initTerminal);
start('work', initWork);
start('form', initForm);
start('scrub', initScrub);
const revealed = start('reveal', initReveal);
initSmooth();
const introduced = start('intro', runIntro);

// the inline safety net in index.html shows everything if this never runs
if (revealed && introduced) window.__ready = true;
