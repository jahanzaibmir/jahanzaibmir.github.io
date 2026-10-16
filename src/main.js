// Jahanzaib Ashraf Mir — Portfolio
// UI runs first and never depends on three.js; the WebGL backdrop is
// loaded lazily so a CDN hiccup can't take the rest of the site down.

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.innerWidth < 860;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Intro / page load ---------- */

const startedAt = performance.now();
const MIN_INTRO = prefersReduced ? 0 : 1250;

function finishIntro() {
  if (document.body.classList.contains('loaded')) return;
  document.body.classList.add('loaded');
  // let the curtain begin lifting before the hero copy rises
  setTimeout(() => document.body.classList.remove('is-loading'), prefersReduced ? 0 : 350);
}

Promise.race([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((r) => setTimeout(r, 2500))
]).then(() => {
  const wait = Math.max(0, MIN_INTRO - (performance.now() - startedAt));
  setTimeout(finishIntro, wait);
});

/* ---------- Footer year ---------- */

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Scroll-driven state (single rAF-throttled handler) ---------- */

const navbar = $('#navbar');
const progressEl = $('.progress');
let lastY = window.scrollY;
let ticking = false;
let scrollY = window.scrollY;

function onScroll() {
  scrollY = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressEl.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : 0);

  navbar.classList.toggle('scrolled', scrollY > 24);
  const menuOpen = document.body.classList.contains('menu-open');
  if (!menuOpen) {
    const goingDown = scrollY > lastY;
    navbar.classList.toggle('hidden', goingDown && scrollY > 480);
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

// Reveal the nav whenever keyboard focus lands in it
navbar.addEventListener('focusin', () => navbar.classList.remove('hidden'));

/* ---------- Active nav link ---------- */

const navAnchors = $$('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const id = entry.target.id;
    navAnchors.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
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
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) navbar.classList.remove('hidden');
}
menuToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navLinks.classList.contains('open')) {
    setMenu(false);
    menuToggle.focus();
  }
});
window.addEventListener('resize', () => { if (!isMobile()) setMenu(false); });

/* ---------- Reveal on scroll ---------- */

window.__revealReady = true;
const revealEls = $$('.reveal');
// Stagger siblings that share a parent so groups cascade in
const groups = new Map();
revealEls.forEach((el) => {
  const idx = groups.get(el.parentElement) ?? 0;
  el.style.setProperty('--d', `${Math.min(idx, 5) * 90}ms`);
  groups.set(el.parentElement, idx + 1);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
revealEls.forEach((el) => revealObserver.observe(el));

/* ---------- Count-up stats ---------- */

function countUp(el) {
  const target = parseInt(el.dataset.count, 10);
  if (prefersReduced || !Number.isFinite(target)) return;
  const dur = 1200;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(target * eased)).padStart(2, '0');
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '00';
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
  'low-level programming',
  'computer networking',
  'malware research',
  'defensive engineering',
  'bug bounty'
];
const typedEl = $('#typed');

function typeLoop() {
  if (!typedEl || prefersReduced) return;
  let r = 0, i = roles[0].length, deleting = true;
  const tick = () => {
    const word = roles[r];
    if (deleting) {
      i--;
      typedEl.textContent = word.slice(0, i);
      if (i <= 0) {
        deleting = false;
        r = (r + 1) % roles.length;
        return setTimeout(tick, 380);
      }
      return setTimeout(tick, 28);
    }
    i++;
    typedEl.textContent = roles[r].slice(0, i);
    if (i >= roles[r].length) {
      deleting = true;
      return setTimeout(tick, 2200);
    }
    setTimeout(tick, 60 + Math.random() * 40);
  };
  setTimeout(tick, 2600);
}
typeLoop();

/* ---------- Terminal ---------- */

const termLines = [
  { html: '<span class="ps">~ $</span> <span class="cmd">whoami</span>', delay: 420 },
  { html: '<span class="out">jahanzaib ashraf mir — cybersecurity engineer &amp; researcher</span>', delay: 520 },
  { html: '<span class="ps">~ $</span> <span class="cmd">uname</span> <span class="arg">-a</span>', delay: 620 },
  { html: '<span class="out">curiosity 6.2.0-kernel-up x86_64 SRM-AP</span>', delay: 520 },
  { html: '<span class="ps">~ $</span> <span class="cmd">./focus</span> <span class="arg">--list</span>', delay: 620 },
  { html: '<span class="hl"><b>[+]</b> low-level programming</span>', delay: 240 },
  { html: '<span class="hl"><b>[+]</b> computer networking</span>', delay: 240 },
  { html: '<span class="hl"><b>[+]</b> offensive / defensive security</span>', delay: 240 },
  { html: '<span class="hl"><b>[+]</b> bug bounty</span>', delay: 240 },
  { html: '<span class="ps">~ $</span> <span class="cmd">echo</span> <span class="arg">$MISSION</span>', delay: 680 },
  { html: '<span class="out">"build &amp; safeguard scalable systems — from the kernel up."</span>', delay: 520 }
];
const promptLine = '<span class="ps">~ $</span> <span class="cursor"></span>';

function runTerminal() {
  const body = $('#terminal-body');
  if (!body) return;
  if (prefersReduced) {
    body.innerHTML = [...termLines.map((l) => l.html), promptLine].map((h) => `<div>${h}</div>`).join('');
    return;
  }
  let i = 0;
  const next = () => {
    const div = document.createElement('div');
    if (i >= termLines.length) {
      div.innerHTML = promptLine;
      body.appendChild(div);
      return;
    }
    div.innerHTML = termLines[i].html;
    body.appendChild(div);
    setTimeout(next, termLines[i++].delay);
  };
  next();
}
const termEl = $('#terminal');
if (termEl) {
  const termObserver = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      termObserver.disconnect();
      setTimeout(runTerminal, prefersReduced ? 0 : 400);
    }
  }, { threshold: 0.3 });
  termObserver.observe(termEl);
}

/* ---------- Pointer niceties (desktop only) ---------- */

if (finePointer && !prefersReduced) {
  // Spotlight that follows the cursor across project rows
  $$('.project-link').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // Gentle magnetic pull on primary buttons
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.28;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------- Contact form (Web3Forms) ---------- */

const form = $('#contact-form');
const statusEl = $('#form-status');
const submitBtn = form.querySelector('.submit-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setStatus(msg, kind = '') {
  statusEl.className = kind;
  statusEl.innerHTML = msg;
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
    setStatus('Please fill in every field with a valid email address.', 'err');
    bad.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  if (data.botcheck) return; // honeypot tripped
  delete data.botcheck;

  if (!data.access_key || data.access_key === 'YOUR_ACCESS_KEY_HERE') {
    setStatus(
      'The form is offline right now. Please reach me on ' +
      '<a href="https://www.linkedin.com/in/jahanzaib-ashraf-mir" target="_blank" rel="noopener noreferrer">LinkedIn</a>.',
      'err'
    );
    return;
  }

  submitBtn.disabled = true;
  btnLabel.textContent = 'Sending…';
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
    setStatus('Message sent. I\'ll get back to you soon.', 'ok');
    form.reset();
  } catch {
    setStatus('Something went wrong sending your message. Please try again.', 'err');
  } finally {
    clearTimeout(timeout);
    submitBtn.disabled = false;
    btnLabel.textContent = 'Send message';
  }
});

/* ---------- WebGL backdrop ---------- */

const canvas = $('#bg');
if (canvas) {
  import('three')
    .then((THREE) => initScene(THREE, canvas))
    .catch(() => { /* backdrop is decorative; the page works without it */ });
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

  // Soft round sprite for every point
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

  // Centerpiece: Fibonacci point-sphere with a faint geodesic shell
  const centre = new THREE.Group();
  world.add(centre);

  const SPHERE_N = isMobile() ? 1100 : 2200;
  const R = 13;
  const base = new Float32Array(SPHERE_N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < SPHERE_N; i++) {
    const y = 1 - (i / (SPHERE_N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    base[i * 3] = Math.cos(th) * rad * R;
    base[i * 3 + 1] = y * R;
    base[i * 3 + 2] = Math.sin(th) * rad * R;
  }
  const sphereGeo = new THREE.BufferGeometry();
  const spherePos = new Float32Array(base);
  sphereGeo.setAttribute('position', new THREE.BufferAttribute(spherePos, 3));
  const sphere = new THREE.Points(sphereGeo, new THREE.PointsMaterial({
    size: 0.26, map: sprite, color: 0xcbd5e1, transparent: true, opacity: 0.85,
    depthWrite: false, sizeAttenuation: true
  }));
  centre.add(sphere);

  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 0.62, 1)),
    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.22 })
  );
  centre.add(shell);

  // Two thin orbit rings
  const rings = [];
  [[R * 1.45, 1.2, 0.3, 0.18], [R * 1.75, 1.42, -0.42, 0.11]].forEach(([radius, tx, tz, op]) => {
    const pts = new THREE.EllipseCurve(0, 0, radius, radius).getPoints(180);
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: op })
    );
    const holder = new THREE.Group();
    holder.rotation.set(tx, 0, tz);
    holder.add(ring);

    // a single node travelling each ring
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xeceef1 })
    );
    holder.add(node);
    holder.userData = { radius, node, speed: rings.length ? -0.09 : 0.14, offset: rings.length * 2 };
    centre.add(holder);
    rings.push(holder);
  });

  // Deep dust field for parallax
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
    size: 0.35, map: sprite, color: 0x64748b, transparent: true, opacity: 0.5, depthWrite: false
  }));
  world.add(dust);

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (isMobile()) {
      centre.position.set(0, 6, -8);
      centre.scale.setScalar(0.85);
    } else {
      // keep the sphere in the right third of the viewport
      const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
      centre.position.set(halfW * 0.5, 0, 0);
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
  let lastOpacity = -1;

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const t = clock.getElapsedTime() * motion;
    const vh = window.innerHeight;
    const s = Math.min(scrollY / vh, 3);

    // a slow surface ripple across the point sphere
    if (motion) {
      for (let i = 0; i < SPHERE_N; i++) {
        const ix = i * 3;
        const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
        const k = 1 + Math.sin(by * 0.35 + t * 0.9) * Math.cos(bx * 0.3 + t * 0.6) * 0.035;
        spherePos[ix] = bx * k;
        spherePos[ix + 1] = by * k;
        spherePos[ix + 2] = bz * k;
      }
      sphereGeo.attributes.position.needsUpdate = true;
    }

    sphere.rotation.y = t * 0.06;
    sphere.rotation.x = Math.sin(t * 0.1) * 0.15;
    shell.rotation.y = -t * 0.04;
    shell.rotation.z = t * 0.025;

    rings.forEach((h) => {
      const d = h.userData;
      const a = t * d.speed + d.offset;
      d.node.position.set(Math.cos(a) * d.radius, Math.sin(a) * d.radius, 0);
    });

    // scroll: the sphere drifts up and turns; dust slides for depth
    centre.rotation.y = s * 0.6;
    centre.rotation.x = s * 0.15;
    world.position.y = s * 6;
    dust.rotation.y = t * 0.004;

    camera.position.x += (mx * 2.4 - camera.position.x) * 0.035;
    camera.position.y += (-my * 1.6 - camera.position.y) * 0.035;
    camera.lookAt(0, world.position.y * 0.2, 0);

    // fade the backdrop once the hero is behind us so content stays legible
    const op = Math.max(0.28, 1 - s * 0.72).toFixed(3);
    if (op !== lastOpacity) {
      canvas.style.setProperty('--bg-opacity', op);
      lastOpacity = op;
    }

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      cancelAnimationFrame(rafId);
      frame();
    }
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(rafId);
  });

  frame();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
