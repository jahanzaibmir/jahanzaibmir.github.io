// Jahanzaib Ashraf Mir, portfolio
// The UI never depends on a CDN. Smooth scrolling (Lenis) and the WebGL
// background (three.js) load on their own, so if either fails the menu,
// the form and every animation still work.

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.innerWidth < 860;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const body = document.body;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

let smooth = null; // Lenis instance once loaded

function storageGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function storageSet(key, val) {
  try { sessionStorage.setItem(key, val); } catch { /* private mode */ }
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Split titles into letters and words ---------- */

$$('.letters').forEach((el) => {
  let i = 0;
  const words = el.textContent.trim().split(/\s+/).map((word) => {
    const chars = [...word].map((ch) => `<span class="ch" style="--i:${i++}">${escapeHtml(ch)}</span>`).join('');
    return `<span class="w">${chars}</span>`;
  });
  el.innerHTML = `<span aria-hidden="true">${words.join(' ')}</span>`;
});

$$('.split').forEach((el) => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = `<span aria-hidden="true">${text.split(/\s+/)
    .map((w, i) => `<span class="w"><span style="--i:${i}">${escapeHtml(w)}</span></span>`)
    .join(' ')}</span>`;
});

/* ---------- Boot screen ---------- */

const intro = $('.intro');
const introTimers = [];
let introFinished = false;

function endIntro() {
  if (introFinished) return;
  introFinished = true;
  introTimers.forEach(clearTimeout);
  body.classList.add('intro-out');
  setTimeout(() => {
    body.classList.remove('is-loading');
    if (smooth) smooth.start();
  }, prefersReduced ? 0 : 250);
  setTimeout(() => body.classList.add('loaded'), prefersReduced ? 0 : 1100);
  // let the letters bounce on hover once they have landed
  setTimeout(() => $$('.letters').forEach((el) => el.classList.add('ready')), prefersReduced ? 0 : 2200);
  storageSet('booted', '1');
}

if (prefersReduced) {
  endIntro();
} else {
  // First visit gets the full boot. Coming back in the same tab is quicker.
  const quick = storageGet('booted') === '1';
  introTimers.push(setTimeout(() => body.classList.add('intro-welcome'), quick ? 0 : 1900));
  introTimers.push(setTimeout(endIntro, quick ? 1000 : 3300));
  intro.addEventListener('click', endIntro);
  window.addEventListener('keydown', (e) => { if (!introFinished && e.key !== 'Tab') endIntro(); });
}

/* ---------- Smooth scrolling ---------- */

if (!prefersReduced) {
  import('https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.mjs')
    .then(({ default: Lenis }) => {
      smooth = new Lenis({ lerp: 0.09, smoothWheel: true });
      if (['is-loading', 'has-max', 'menu-open'].some((c) => body.classList.contains(c))) smooth.stop();
      const raf = (time) => {
        smooth.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    })
    .catch(() => { /* native scrolling is fine */ });
}

// In page links glide with Lenis; without it the browser's smooth scroll is used
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !smooth || a.classList.contains('skip-link')) return;
  const id = a.getAttribute('href');
  const target = id.length > 1 && document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  smooth.scrollTo(target, { offset: 0, duration: 1.4 });
  history.pushState(null, '', id);
});

/* ---------- Footer year ---------- */

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Scroll state (one throttled handler) ---------- */

const navbar = $('#navbar');
const progressEl = $('.progress');
let scrollY = window.scrollY;
let lastY = scrollY;
let ticking = false;

function onScroll() {
  scrollY = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressEl.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : 0);
  navbar.classList.toggle('scrolled', scrollY > 20);
  if (!body.classList.contains('menu-open')) {
    navbar.classList.toggle('hidden', scrollY > lastY && scrollY > 500);
  }
  lastY = scrollY;
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(onScroll);
  }
}, { passive: true });
onScroll();
navbar.addEventListener('focusin', () => navbar.classList.remove('hidden'));

/* ---------- Active nav link ---------- */

const navAnchors = $$('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navAnchors.forEach((a) => {
      const on = a.getAttribute('href') === `#${entry.target.id}`;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('section[id], header#hero').forEach((s) => sectionObserver.observe(s));

/* ---------- Mobile menu ---------- */

const menuToggle = $('#menu-toggle');
const navLinks = $('#nav-links');

function setMenu(open) {
  navLinks.classList.toggle('open', open);
  menuToggle.classList.toggle('open', open);
  body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) navbar.classList.remove('hidden');
  if (smooth) (open ? smooth.stop() : smooth.start());
}
menuToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
window.addEventListener('resize', () => { if (!isMobile() && navLinks.classList.contains('open')) setMenu(false); });

/* ---------- Reveal on scroll: text fades in, windows open ---------- */

window.__revealReady = true;
const revealEls = $$('.reveal, .win, .split');
const groups = new Map();
revealEls.forEach((el) => {
  // stagger items that share a parent so groups cascade in
  const idx = groups.get(el.parentElement) ?? 0;
  const delay = `${Math.min(idx, 5) * 110}ms`;
  el.style.setProperty('--d', delay);
  if (el.classList.contains('win') && el.firstElementChild) el.firstElementChild.style.setProperty('--d', delay);
  groups.set(el.parentElement, idx + 1);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
revealEls.forEach((el) => revealObserver.observe(el));

/* ---------- Count up stats ---------- */

function countUp(el) {
  const target = parseInt(el.dataset.count, 10);
  if (prefersReduced || !Number.isFinite(target)) return;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / 1100, 1);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    countUp(entry.target);
    statObserver.unobserve(entry.target);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => statObserver.observe(el));

/* ---------- Typing line ---------- */

const roles = [
  'offensive security',
  'kernel development',
  'low level programming',
  'computer networking',
  'defensive security',
  'bug bounty'
];
const typedEl = $('#typed');

function typeLoop() {
  if (!typedEl || prefersReduced) return;
  let r = 0, i = roles[0].length, deleting = true;
  const tick = () => {
    if (deleting) {
      typedEl.textContent = roles[r].slice(0, --i);
      if (i <= 0) {
        deleting = false;
        r = (r + 1) % roles.length;
        return setTimeout(tick, 350);
      }
      return setTimeout(tick, 30);
    }
    typedEl.textContent = roles[r].slice(0, ++i);
    if (i >= roles[r].length) {
      deleting = true;
      return setTimeout(tick, 2200);
    }
    setTimeout(tick, 55 + Math.random() * 45);
  };
  setTimeout(tick, 4600);
}
typeLoop();

/* ---------- Terminal ---------- */

const termLines = [
  { html: '<span class="ps">~ $</span> <span class="cmd">whoami</span>', delay: 420 },
  { html: '<span class="out">jahanzaib ashraf mir, cybersecurity engineer and researcher</span>', delay: 560 },
  { html: '<span class="ps">~ $</span> <span class="cmd">cat focus.txt</span>', delay: 600 },
  { html: '<span class="ok">[+]</span> <span class="out">low level programming</span>', delay: 240 },
  { html: '<span class="ok">[+]</span> <span class="out">computer networking</span>', delay: 240 },
  { html: '<span class="ok">[+]</span> <span class="out">offensive and defensive security</span>', delay: 240 },
  { html: '<span class="ok">[+]</span> <span class="out">bug bounty</span>', delay: 240 },
  { html: '<span class="ps">~ $</span> <span class="cmd">echo $MISSION</span>', delay: 640 },
  { html: '<span class="out">build and protect systems that scale, starting from the kernel</span>', delay: 520 }
];
const promptLine = '<span class="ps">~ $</span> <span class="cursor"></span>';

function runTerminal() {
  const outEl = $('#terminal-body');
  if (!outEl) return;
  if (prefersReduced) {
    outEl.innerHTML = [...termLines.map((l) => l.html), promptLine].map((h) => `<div>${h}</div>`).join('');
    return;
  }
  let i = 0;
  const next = () => {
    const div = document.createElement('div');
    div.innerHTML = i < termLines.length ? termLines[i].html : promptLine;
    outEl.appendChild(div);
    if (i < termLines.length) setTimeout(next, termLines[i++].delay);
  };
  next();
}
const termEl = $('#terminal');
if (termEl) {
  const termObserver = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      termObserver.disconnect();
      setTimeout(runTerminal, prefersReduced ? 0 : 700);
    }
  }, { threshold: 0.3 });
  termObserver.observe(termEl);
}

/* ---------- Working window controls: minimize, maximize, close ---------- */

const animate = (el, frames, ms) => (prefersReduced || !el.animate ? null : el.animate(frames, { duration: ms, easing: EASE }));

function setupWindow(win) {
  const wrap = win.closest('.win-wrap');
  const content = $('.win-content', win);
  const bar = $('.win-bar', win);
  const reopen = $('.win-reopen', wrap);
  const btnMax = $('[data-win="max"]', win);
  const btnMin = $('[data-win="min"]', win);

  function toggleMax(force) {
    const enter = force ?? !win.classList.contains('maximized');
    if (enter === win.classList.contains('maximized')) return;
    if (enter && win.classList.contains('minimized')) toggleMin(false, true);
    const first = win.getBoundingClientRect();
    if (enter) {
      wrap.style.minHeight = `${first.height}px`;
      wrap.classList.add('has-max');
      win.classList.add('maximized');
      body.classList.add('has-max');
      if (smooth) smooth.stop();
    } else {
      win.classList.remove('maximized');
      wrap.classList.remove('has-max');
      body.classList.remove('has-max');
      wrap.style.minHeight = '';
      if (smooth) smooth.start();
    }
    btnMax.setAttribute('aria-label', btnMax.getAttribute('aria-label').replace(enter ? 'Maximize' : 'Restore', enter ? 'Restore' : 'Maximize'));
    // FLIP: glide from the old box to the new one
    const last = win.getBoundingClientRect();
    animate(win, [
      { transformOrigin: '0 0', transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
      { transformOrigin: '0 0', transform: 'none' }
    ], 520);
  }

  function toggleMin(force, instant) {
    const fold = force ?? !win.classList.contains('minimized');
    if (fold === win.classList.contains('minimized')) return;
    if (fold && win.classList.contains('maximized')) toggleMax(false);
    const from = content.getBoundingClientRect().height;
    win.classList.toggle('minimized', fold);
    btnMin.setAttribute('aria-label', btnMin.getAttribute('aria-label').replace(fold ? 'Minimize' : 'Restore', fold ? 'Restore' : 'Minimize'));
    if (instant) return;
    if (fold) {
      animate(content, [{ height: `${from}px` }, { height: '0px' }], 450);
    } else {
      const to = content.getBoundingClientRect().height;
      animate(content, [{ height: '0px' }, { height: `${to}px` }], 500);
    }
  }

  function close() {
    if (win.classList.contains('maximized')) toggleMax(false);
    const done = () => {
      win.classList.remove('closing');
      win.classList.add('closed');
      reopen.hidden = false;
      reopen.focus({ preventScroll: true });
    };
    if (prefersReduced) return done();
    win.classList.add('closing');
    win.addEventListener('animationend', done, { once: true });
  }

  reopen.addEventListener('click', () => {
    reopen.hidden = true;
    win.classList.remove('closed', 'minimized');
    win.classList.add('reopening');
    win.addEventListener('animationend', () => win.classList.remove('reopening'), { once: true });
  });

  bar.addEventListener('click', (e) => {
    const action = e.target.closest('[data-win]')?.dataset.win;
    if (action === 'min') toggleMin();
    else if (action === 'max') toggleMax();
    else if (action === 'close') close();
    else if (win.classList.contains('minimized')) toggleMin(false);
  });
  // double click the title bar to maximize, like a desktop window
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('[data-win]')) toggleMax(); });

  win._restore = () => toggleMax(false);
}
$$('.window').forEach((win) => { if ($('[data-win]', win)) setupWindow(win); });

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (navLinks.classList.contains('open')) {
    setMenu(false);
    menuToggle.focus();
    return;
  }
  const maxed = $('.window.maximized');
  if (maxed && maxed._restore) maxed._restore();
});

/* ---------- Pointer effects (mouse only) ---------- */

if (finePointer && !prefersReduced) {
  // 3D tilt with a soft light that follows the cursor
  $$('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      el.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });

  // Gentle magnetic pull on the hero buttons
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.2;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  // Hero text leans slightly toward the mouse, giving it depth
  const heroInner = $('.hero-inner');
  let hx = 0, hy = 0, tx = 0, ty = 0, heroRaf = 0;
  const heroLoop = () => {
    hx += (tx - hx) * 0.08;
    hy += (ty - hy) * 0.08;
    heroInner.style.setProperty('--hx', `${hx.toFixed(3)}deg`);
    heroInner.style.setProperty('--hy', `${hy.toFixed(3)}deg`);
    heroRaf = Math.abs(tx - hx) + Math.abs(ty - hy) > 0.01 ? requestAnimationFrame(heroLoop) : 0;
  };

  // Soft ring that trails the cursor and grows over things you can click
  const ring = $('.cursor-ring');
  let cx = -100, cy = -100, rx = -100, ry = -100, ringRaf = 0;
  const ringLoop = () => {
    rx += (cx - rx) * 0.2;
    ry += (cy - ry) * 0.2;
    ring.style.setProperty('--cx', `${rx.toFixed(1)}px`);
    ring.style.setProperty('--cy', `${ry.toFixed(1)}px`);
    ringRaf = Math.abs(cx - rx) + Math.abs(cy - ry) > 0.1 ? requestAnimationFrame(ringLoop) : 0;
  };

  window.addEventListener('pointermove', (e) => {
    cx = e.clientX;
    cy = e.clientY;
    if (!body.classList.contains('cursor-on')) {
      rx = cx; ry = cy;
      body.classList.add('cursor-on');
    }
    if (!ringRaf) ringRaf = requestAnimationFrame(ringLoop);

    if (scrollY < window.innerHeight) {
      tx = ((e.clientX / window.innerWidth) - 0.5) * 6;
      ty = (0.5 - (e.clientY / window.innerHeight)) * 4;
      if (!heroRaf) heroRaf = requestAnimationFrame(heroLoop);
    }
  }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    body.classList.toggle('cursor-text', !!t.closest('input, textarea, .terminal-body'));
    body.classList.toggle('cursor-hover', !!t.closest('a, button, .tilt, label'));
  });
  document.documentElement.addEventListener('pointerleave', () => body.classList.remove('cursor-on'));
  window.addEventListener('pointerdown', () => body.classList.add('cursor-down'));
  window.addEventListener('pointerup', () => body.classList.remove('cursor-down'));
}

/* ---------- Contact form (Web3Forms) ---------- */

const form = $('#contact-form');
const statusEl = $('#form-status');
const submitBtn = form.querySelector('.submit-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setStatus(msg, kind = '') {
  statusEl.className = kind;
  statusEl.textContent = msg;
}

function validate() {
  let firstBad = null;
  form.querySelectorAll('.field').forEach((f) => {
    const input = f.querySelector('input, textarea');
    const v = input.value.trim();
    const ok = v.length > 0 && (input.type !== 'email' || EMAIL_RE.test(v));
    f.classList.toggle('invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok && !firstBad) firstBad = input;
  });
  return firstBad;
}

form.addEventListener('input', (e) => {
  const field = e.target.closest('.field');
  if (field && field.classList.contains('invalid')) {
    field.classList.remove('invalid');
    e.target.removeAttribute('aria-invalid');
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bad = validate();
  if (bad) {
    setStatus('Please fill in all fields and use a valid email.', 'err');
    bad.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  if (data.botcheck) return; // spam bot filled the hidden box
  delete data.botcheck;

  submitBtn.disabled = true;
  btnLabel.textContent = 'Sending...';
  setStatus('');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: ctrl.signal
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) throw new Error(result.message || res.statusText);
    setStatus('Thank you! Your message was sent.', 'ok');
    form.reset();
  } catch {
    setStatus('Sorry, the message could not be sent. Please try again.', 'err');
  } finally {
    clearTimeout(timeout);
    submitBtn.disabled = false;
    btnLabel.textContent = 'Send message';
  }
});

/* ---------- WebGL background: point sphere around a 4D tesseract ---------- */

const canvas = $('#bg');
if (canvas) {
  import('three')
    .then((THREE) => initScene(THREE, canvas))
    .catch(() => { /* the background is decoration only */ });
}

function initScene(THREE, canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 46);

  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const world = new THREE.Group();
  scene.add(world);
  const centre = new THREE.Group();
  world.add(centre);

  // Point sphere
  const SPHERE_N = isMobile() ? 1100 : 2200;
  const R = 13;
  const base = new Float32Array(SPHERE_N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < SPHERE_N; i++) {
    const y = 1 - (i / (SPHERE_N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    base[i * 3] = Math.cos(golden * i) * rad * R;
    base[i * 3 + 1] = y * R;
    base[i * 3 + 2] = Math.sin(golden * i) * rad * R;
  }
  const sphereGeo = new THREE.BufferGeometry();
  const spherePos = new Float32Array(base);
  sphereGeo.setAttribute('position', new THREE.BufferAttribute(spherePos, 3));
  const sphere = new THREE.Points(sphereGeo, new THREE.PointsMaterial({
    size: 0.26, map: sprite, color: 0xe6e6e6, transparent: true, opacity: 0.8, depthWrite: false
  }));
  centre.add(sphere);

  // Tesseract: a 4D cube, rotated in 4D and projected into 3D every frame
  const verts4 = [];
  for (let i = 0; i < 16; i++) {
    verts4.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
  }
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b);
      if (j > i) edges.push([i, j]);
    }
  }
  const tessPos = new Float32Array(edges.length * 6);
  const tessGeo = new THREE.BufferGeometry();
  tessGeo.setAttribute('position', new THREE.BufferAttribute(tessPos, 3));
  const tesseract = new THREE.LineSegments(tessGeo, new THREE.LineBasicMaterial({
    color: 0xd6d6d6, transparent: true, opacity: 0.55
  }));
  centre.add(tesseract);

  const cornerGeo = new THREE.BufferGeometry();
  const cornerPos = new Float32Array(16 * 3);
  cornerGeo.setAttribute('position', new THREE.BufferAttribute(cornerPos, 3));
  const corners = new THREE.Points(cornerGeo, new THREE.PointsMaterial({
    size: 0.7, map: sprite, color: 0xf5f5f5, transparent: true, opacity: 0.9, depthWrite: false
  }));
  centre.add(corners);

  const projected = verts4.map(() => [0, 0, 0]);
  const TESS_SCALE = 9.2;
  function updateTesseract(t) {
    const a = t * 0.35, b = t * 0.22, c = t * 0.15;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cb = Math.cos(b), sb = Math.sin(b);
    const cc = Math.cos(c), sc = Math.sin(c);
    verts4.forEach(([x, y, z, w], i) => {
      // rotate in the XW plane, then ZW, then XY
      const x1 = x * ca - w * sa, w1 = x * sa + w * ca;
      const z1 = z * cb - w1 * sb, w2 = z * sb + w1 * cb;
      const x2 = x1 * cc - y * sc, y1 = x1 * sc + y * cc;
      const k = TESS_SCALE / (2.6 - w2); // perspective from 4D down to 3D
      const p = projected[i];
      p[0] = x2 * k;
      p[1] = y1 * k;
      p[2] = z1 * k;
      cornerPos.set(p, i * 3);
    });
    edges.forEach(([i, j], e) => {
      tessPos.set(projected[i], e * 6);
      tessPos.set(projected[j], e * 6 + 3);
    });
    tessGeo.attributes.position.needsUpdate = true;
    cornerGeo.attributes.position.needsUpdate = true;
  }

  // Two thin orbit rings, each with a small travelling node
  const rings = [];
  [[R * 1.4, 1.2, 0.3, 0.22, 0.14], [R * 1.68, 1.42, -0.42, 0.14, -0.09]].forEach(([radius, tx, tz, op, speed], n) => {
    const pts = new THREE.EllipseCurve(0, 0, radius, radius).getPoints(180);
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xd6d6d6, transparent: true, opacity: op })
    );
    const holder = new THREE.Group();
    holder.rotation.set(tx, 0, tz);
    holder.add(ring);
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5 })
    );
    holder.add(node);
    holder.userData = { radius, node, speed, offset: n * 2 };
    centre.add(holder);
    rings.push(holder);
  });

  // Far dust for depth
  const DUST_N = isMobile() ? 350 : 800;
  const dustPos = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 200;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 120;
    dustPos[i * 3 + 2] = -20 - Math.random() * 120;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.4, map: sprite, color: 0x9a9a9a, transparent: true, opacity: 0.55, depthWrite: false
  }));
  world.add(dust);

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (isMobile()) {
      centre.position.set(0, 7, -10);
      centre.scale.setScalar(0.85);
    } else {
      const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
      centre.position.set(Math.min(halfW * 0.5, 26), 0, 0);
      centre.scale.setScalar(1);
    }
  }
  layout();

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  });

  let mx = 0, my = 0;
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const motion = prefersReduced ? 0 : 1;
  const clock = new THREE.Clock();
  let running = true;
  let rafId = 0;
  let lastOpacity = '';
  let grow = prefersReduced ? 1 : 0; // the scene grows in when the boot screen lifts

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const t = clock.getElapsedTime() * motion;
    const s = Math.min(scrollY / window.innerHeight, 3);

    if (!body.classList.contains('is-loading') && grow < 1) grow = Math.min(1, grow + 0.012);
    const g = 1 - Math.pow(1 - grow, 3);

    if (motion) {
      for (let i = 0; i < SPHERE_N; i++) {
        const ix = i * 3;
        const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
        const k = (1 + Math.sin(by * 0.35 + t * 0.9) * Math.cos(bx * 0.3 + t * 0.6) * 0.035) * (0.4 + 0.6 * g);
        spherePos[ix] = bx * k;
        spherePos[ix + 1] = by * k;
        spherePos[ix + 2] = bz * k;
      }
      sphereGeo.attributes.position.needsUpdate = true;
    }
    sphere.material.opacity = 0.8 * g;
    sphere.rotation.y = t * 0.06;
    sphere.rotation.x = Math.sin(t * 0.1) * 0.15;

    updateTesseract(t + 0.6);
    tesseract.scale.setScalar(g);
    corners.scale.setScalar(g);
    tesseract.rotation.y = t * 0.08;
    corners.rotation.y = t * 0.08;

    rings.forEach((h) => {
      const d = h.userData;
      const a = t * d.speed + d.offset;
      d.node.position.set(Math.cos(a) * d.radius, Math.sin(a) * d.radius, 0);
      h.scale.setScalar(0.6 + 0.4 * g);
    });

    // scrolling turns the whole scene in 3D and lifts it away
    centre.rotation.y = s * 0.7;
    centre.rotation.x = s * 0.2;
    world.position.y = s * 6;
    dust.rotation.y = t * 0.004;

    camera.position.x += (mx * 2.4 - camera.position.x) * 0.035;
    camera.position.y += (-my * 1.6 - camera.position.y) * 0.035;
    camera.lookAt(0, world.position.y * 0.2, 0);

    // fade the background below the hero so text stays easy to read
    const op = Math.max(0.3, 1 - s * 0.7).toFixed(3);
    if (op !== lastOpacity) {
      canvas.style.setProperty('--bg-opacity', op);
      lastOpacity = op;
    }

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    cancelAnimationFrame(rafId);
    if (running) frame();
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(rafId);
  });

  frame();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
