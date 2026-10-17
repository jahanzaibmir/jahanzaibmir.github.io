// Wraps words and letters in spans so they can be animated one by one.
// Screen readers get the plain text from a hidden copy, not the pieces.

import { $$, escapeHtml } from './env.js';

const clean = (s) => s.trim().replace(/\s+/g, ' ');

function wrap(el, visibleHtml, label) {
  el.innerHTML = `<span class="sr-only">${escapeHtml(label)}</span><span aria-hidden="true">${visibleHtml}</span>`;
}

// Headings: <span class="w"><i>word</i></span>
export function splitWords(el) {
  const text = clean(el.textContent);
  const html = text
    .split(' ')
    .map((word, i) => `<span class="w"><i style="--i:${i}">${escapeHtml(word)}</i></span>`)
    .join(' ');
  wrap(el, html, text);
}

// Text that lights up word by word while scrolling: <span class="sw">word</span>
export function splitPlainWords(el) {
  const text = clean(el.textContent);
  const html = text
    .split(' ')
    .map((word) => `<span class="sw">${escapeHtml(word)}</span>`)
    .join(' ');
  wrap(el, html, text);
  return $$('.sw', el);
}

// The hero name: lines, then words, then letters, numbered across the whole name
export function splitChars(el) {
  const lines = $$('.line', el);
  const sources = lines.length ? lines : [el];
  let i = 0;
  const label = sources.map((l) => clean(l.textContent)).join(' ');
  const html = sources
    .map((line) => {
      const words = clean(line.textContent)
        .split(' ')
        .map((word) => `<span class="wd">${[...word].map((ch) => `<span class="ch" style="--i:${i++}">${escapeHtml(ch)}</span>`).join('')}</span>`)
        .join(' ');
      return `<span class="line">${words}</span>`;
    })
    .join('');
  wrap(el, html, label);
}

// Single letters for the big footer name, which is decoration only
// (the element is hidden from screen readers in the HTML)
export function splitLetters(el) {
  const text = clean(el.textContent);
  el.innerHTML = [...text].map((ch) => (ch === ' ' ? ' ' : `<span class="oc">${escapeHtml(ch)}</span>`)).join('');
  return $$('.oc', el);
}

// Hover roll: the label turns up and away on a 3D hinge while a copy turns
// in from below. Only the first text in the element is wrapped, so icons
// stay where they are.
export function rollify(el) {
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!node) return;
  const text = escapeHtml(node.textContent.trim());
  const wrap = document.createElement('span');
  wrap.className = 'roll';
  wrap.innerHTML = `<span class="roll-a">${text}</span><span class="roll-b" aria-hidden="true">${text}</span>`;
  el.replaceChild(wrap, node);
}

export function splitAll() {
  $$('[data-split]').forEach(splitWords);
  $$('[data-chars]').forEach(splitChars);
  $$('.nav-links a, .hero-actions .btn').forEach(rollify);
}
