// Top bar: hides while you scroll down and comes back when you scroll up,
// shows reading progress, and slides a pill to the section on screen.
// On phones the links live in a full screen menu.

import { $, $$ } from './lib/env.js';
import { onFrame } from './lib/ticker.js';
import { onMeasure, docTop, pageHeight } from './lib/layout.js';
import { lockScroll, unlockScroll, scrollToY } from './lib/smooth.js';
import { playCard } from './cards.js';

const body = document.body;

export function initNav() {
  const nav = $('#nav');
  if (!nav) return;
  const bar = $('.nav-progress span', nav);
  const pill = $('.nav-pill', nav);
  const links = $$('.nav-links a', nav);
  const toggle = $('.nav-toggle', nav);
  const menu = $('#menu');
  const menuLinks = menu ? $$('.menu-links a', menu) : [];

  /* ---------- Scroll state ---------- */

  let maxScroll = 1;
  onMeasure(() => {
    maxScroll = Math.max(1, pageHeight() - window.innerHeight);
  });

  let lastY = window.scrollY;
  let lastP = -1;
  let scrolled = null;
  let hidden = false;
  let menuOpen = false;

  const setHidden = (h) => {
    if (h === hidden) return;
    hidden = h;
    nav.classList.toggle('is-hidden', h);
  };

  onFrame((fr) => {
    const y = fr.y;
    const p = Math.min(1, Math.max(0, y / maxScroll));
    if (Math.abs(p - lastP) > 0.0005) {
      lastP = p;
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    const isScrolled = y > 12;
    if (isScrolled !== scrolled) {
      scrolled = isScrolled;
      nav.classList.toggle('is-scrolled', isScrolled);
    }
    if (!menuOpen && !nav.contains(document.activeElement)) {
      if (y > lastY + 3 && y > 520) setHidden(true);
      else if (y < lastY - 3 || y <= 520) setHidden(false);
    }
    lastY = y;
  });
  nav.addEventListener('focusin', () => setHidden(false));

  /* ---------- Current section ---------- */

  let activeId = null;

  function placePill(link) {
    if (!pill) return;
    if (!link) {
      pill.classList.remove('is-on');
      return;
    }
    const first = !pill.classList.contains('is-on');
    if (first) pill.classList.add('is-jump');
    pill.style.setProperty('--x', `${link.offsetLeft}px`);
    pill.style.setProperty('--w', `${link.offsetWidth}px`);
    if (first) {
      void pill.offsetWidth;
      pill.classList.remove('is-jump');
      pill.classList.add('is-on');
    }
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    let current = null;
    links.forEach((a) => {
      const on = a.hash === `#${id}`;
      a.classList.toggle('is-active', on);
      if (on) {
        a.setAttribute('aria-current', 'true');
        current = a;
      } else {
        a.removeAttribute('aria-current');
      }
    });
    menuLinks.forEach((a) => a.classList.toggle('is-active', a.hash === `#${id}`));
    placePill(current);
  }

  const sections = ['top', 'about', 'work', 'skills', 'contact'].map((id) => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id === 'top' ? null : entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  window.addEventListener('resize', () => {
    const link = links.find((a) => a.classList.contains('is-active'));
    if (link) placePill(link);
  });

  /* ---------- Links inside the page ---------- */

  // A section link first shows that section's card (cards.js). Anything
  // else, or a visitor who asked for less motion, glides there instead.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.classList.contains('skip') || a.hasAttribute('data-go')) return;
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    history.pushState(null, '', id === 'top' ? window.location.pathname : `#${id}`);
    if (playCard(id)) return;
    scrollToY(id === 'top' ? 0 : docTop(target));
    if (id !== 'top') {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });

  // after a card has moved the page, keep the bar in view and don't treat
  // the jump as scrolling down
  document.addEventListener('card:jump', () => {
    requestAnimationFrame(() => {
      lastY = window.scrollY;
      setHidden(false);
    });
  });

  /* ---------- Phone menu ---------- */

  function setMenu(open) {
    if (!menu || open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.classList.toggle('menu-open', open);
    if (open) {
      setHidden(false);
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add('is-open');
      lockScroll('menu');
    } else {
      menu.classList.remove('is-open');
      unlockScroll('menu');
      setTimeout(() => {
        if (!menuOpen) menu.hidden = true;
      }, 460);
    }
  }

  if (toggle) toggle.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (menuOpen && window.innerWidth >= 760) setMenu(false);
  });
}
