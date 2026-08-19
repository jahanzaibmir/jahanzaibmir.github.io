import * as THREE from 'three';


const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionScale = prefersReduced ? 0 : 1;
const isMobile = () => window.innerWidth < 768;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
  alpha: true,
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(34);

// Paper-colored fog: far objects melt into the background = real depth
scene.fog = new THREE.Fog(0xfbfaf6, 45, 160);

// Everything lives in one world group so scrolling rotates the whole world
const worldGroup = new THREE.Group();
scene.add(worldGroup);

// Studio lighting — warm key, cool blue fill
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.15);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff6e9, 1.7);
keyLight.position.set(-15, 22, 12);
scene.add(keyLight);

const blueFill = new THREE.PointLight(0x3d6bd8, 60, 160);
blueFill.position.set(-26, -6, -4);
scene.add(blueFill);

const warmFill = new THREE.PointLight(0xead9b7, 35, 160);
warmFill.position.set(26, 12, -12);
scene.add(warmFill);

// ---- Porcelain centerpiece + orbital system ----
const knotGroup = new THREE.Group();
worldGroup.add(knotGroup);

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(9, 2.6, 220, 36),
  new THREE.MeshPhysicalMaterial({
    color: 0xf3eee3,
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28
  })
);
knotGroup.add(knot);

// Faint wireframe shell enclosing the centerpiece
const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(16.5, 1),
  new THREE.MeshBasicMaterial({ color: 0x1b2a4a, wireframe: true, transparent: true, opacity: 0.07 })
);
knotGroup.add(shell);

// Three tilted orbit rings (ink / cobalt / bronze)
const ringHolders = [];
function addRing(radius, color, opacity, tiltX, tiltZ, spin) {
  const points = new THREE.EllipseCurve(0, 0, radius, radius).getPoints(128);
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  const holder = new THREE.Group();
  holder.rotation.set(tiltX, 0, tiltZ);
  holder.add(ring);
  holder.userData.spin = spin;
  knotGroup.add(holder);
  ringHolders.push(holder);
}
addRing(21, 0x1b2a4a, 0.16, 1.15, 0.2, 0.05);
addRing(26, 0x3d6bd8, 0.2, 1.45, -0.3, -0.035);
addRing(31, 0xc0a878, 0.14, 0.8, 0.55, 0.025);

// Orbiting satellites
const satellites = [];
function addSatellite(geo, color, radius, speed, inclination, roughness = 0.4) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0.15, flatShading: true
  }));
  mesh.userData = { radius, speed, incline: inclination, angle: Math.random() * Math.PI * 2 };
  knotGroup.add(mesh);
  satellites.push(mesh);
}
addSatellite(new THREE.IcosahedronGeometry(2.1, 0), 0x3d6bd8, 20, 0.22, 0.35);
addSatellite(new THREE.TorusGeometry(3, 0.85, 12, 28), 0x1b2a4a, 26, -0.16, -0.5);
addSatellite(new THREE.OctahedronGeometry(1.7, 0), 0xc0a878, 17, 0.3, 1.1, 0.5);

// ---- Floating shape field — depth-scattered mini solids ----
const floaterGeos = [
  new THREE.BoxGeometry(1.6, 1.6, 1.6),
  new THREE.OctahedronGeometry(1.2, 0),
  new THREE.TetrahedronGeometry(1.4, 0),
  new THREE.TorusGeometry(1, 0.35, 10, 20),
  new THREE.SphereGeometry(0.95, 16, 16)
];
const floaterPalette = [0x1b2a4a, 0x3d6bd8, 0xc0a878, 0xd8cfbc, 0xffffff];
const floaters = [];
const floaterCount = isMobile() ? 7 : 14;

for (let i = 0; i < floaterCount; i++) {
  const geo = floaterGeos[i % floaterGeos.length];
  const isSphere = geo.type === 'SphereGeometry';
  const mat = new THREE.MeshStandardMaterial({
    color: floaterPalette[i % floaterPalette.length],
    roughness: 0.5,
    metalness: 0.1,
    flatShading: !isSphere
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    (Math.random() - 0.5) * 125,
    (Math.random() - 0.5) * 58,
    -12 - Math.random() * 70
  );
  const scale = 0.5 + Math.random() * 1.3;
  mesh.scale.setScalar(scale);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  mesh.userData = {
    baseY: mesh.position.y,
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.5,
    amp: 0.8 + Math.random() * 1.4,
    rx: (Math.random() - 0.5) * 0.012,
    ry: (Math.random() - 0.5) * 0.012
  };
  worldGroup.add(mesh);
  floaters.push(mesh);
}

// Distant monolith — huge sand dodecahedron swallowed by fog
const monolith = new THREE.Mesh(
  new THREE.DodecahedronGeometry(9, 0),
  new THREE.MeshStandardMaterial({ color: 0xd8cfbc, roughness: 0.6, flatShading: true })
);
monolith.position.set(-48, 10, -85);
worldGroup.add(monolith);

// ---- Dust — two parallax layers of fine specks ----
function makeDust(count, size, opacity, spread) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * spread;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size, color: 0x8b93a3, transparent: true, opacity
  }));
}
const dustNear = makeDust(isMobile() ? 130 : 260, 0.5, 0.35, 160);
const dustFar = makeDust(isMobile() ? 200 : 420, 0.3, 0.22, 230);
dustFar.position.z = -60;
worldGroup.add(dustNear, dustFar);

// Layout: centerpiece sits right of the hero copy on desktop,
// floats behind the text on mobile (canvas dimmed via CSS)
let knotBaseY = 1;
function layoutScene() {
  if (isMobile()) {
    knotGroup.position.set(0, 4, -10);
    knotGroup.scale.setScalar(0.7);
  } else {
    knotGroup.position.set(15, 1, 0);
    knotGroup.scale.setScalar(1);
  }
  knotBaseY = knotGroup.position.y;
}
layoutScene();

// Interaction state
let mouseX = 0, mouseY = 0;
let scrollY = window.scrollY;

document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Centerpiece: spin + gentle bob around its anchored height
  knot.rotation.x = t * 0.16 * motionScale;
  knot.rotation.y = t * 0.22 * motionScale;
  knotGroup.position.y = knotBaseY + Math.sin(t * 0.6) * 0.9 * motionScale;
  shell.rotation.x = -t * 0.05 * motionScale;
  shell.rotation.y = t * 0.06 * motionScale;

  ringHolders.forEach((h) => { h.rotation.y = t * h.userData.spin * motionScale; });

  satellites.forEach((s) => {
    const d = s.userData;
    d.angle += d.speed * 0.01 * motionScale;
    s.position.set(
      Math.cos(d.angle) * d.radius,
      Math.sin(d.angle) * d.radius * Math.sin(d.incline),
      Math.sin(d.angle) * d.radius * Math.cos(d.incline)
    );
    s.rotation.x += 0.004 * motionScale;
    s.rotation.y += 0.005 * motionScale;
  });

  // Floating field: each solid bobs and tumbles on its own clock
  floaters.forEach((f) => {
    const d = f.userData;
    f.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * d.amp * motionScale;
    f.rotation.x += d.rx * motionScale;
    f.rotation.y += d.ry * motionScale;
  });
  monolith.rotation.y = t * 0.03 * motionScale;

  // Scrolling turns the whole world; the camera dollies in
  const targetRot = scrollY * 0.00035;
  worldGroup.rotation.y += (targetRot - worldGroup.rotation.y) * 0.05;
  worldGroup.rotation.x = Math.sin(t * 0.08) * 0.015 * motionScale;

  camera.position.x += (mouseX * 5 - camera.position.x) * 0.03;
  camera.position.y += (mouseY * 3.5 - camera.position.y) * 0.03;
  camera.position.z = 34 - Math.min(scrollY * 0.005, 10);
  camera.lookAt(isMobile() ? 0 : 5, 0, 0);

  dustNear.rotation.y = t * 0.01 * motionScale;
  dustFar.rotation.y = -t * 0.006 * motionScale;

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  layoutScene();
});

animate();

/* ==========================================================
   2. 3D CARD TILT (desktop pointers only)
   ========================================================== */

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced) {
  document.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-6px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

const roles = [
  'offensive security',
  'kernel development',
  'low-level programming',
  'computer networking',
  'malware research',
  'defensive engineering'
];
const typedEl = document.getElementById('typed');

function typeLoop(text, i = 0, deleting = false) {
  if (prefersReduced) { typedEl.textContent = roles[0]; return; }
  const current = roles[(text + roles.length) % roles.length]; // no-op guard
  if (!deleting) {
    typedEl.textContent = current.slice(0, i);
    if (i <= current.length) {
      setTimeout(() => typeLoop(text, i + 1, false), 55);
    } else {
      setTimeout(() => typeLoop(text, i, true), 1800);
    }
  } else {
    typedEl.textContent = current.slice(0, Math.max(i - 1, 0));
    if (i > 0) {
      setTimeout(() => typeLoop(text, i - 1, true), 26);
    } else {
      setTimeout(() => typeLoop((text + 1) % roles.length, 0, false), 400);
    }
  }
}
typeLoop(0);



const termLines = [
  { html: '<span class="cmd">~ $</span> <span class="cmd">whoami</span>', delay: 300 },
  { html: '<span class="out">jahanzaib ashraf mir — cybersecurity engineer</span>', delay: 500 },
  { html: '<span class="cmd">~ $</span> <span class="dir">uname</span> <span class="cmd">-a</span>', delay: 650 },
  { html: '<span class="out">curiosity 6.2 kernel-up x86_64 SRM-AP</span>', delay: 500 },
  { html: '<span class="cmd">~ $</span> <span class="cmd">./focus --list</span>', delay: 650 },
  { html: '<span class="hl">[+] low-level programming</span>', delay: 260 },
  { html: '<span class="hl">[+] computer networking</span>', delay: 260 },
  { html: '<span class="hl">[+] offensive / defensive security</span>', delay: 260 },
  { html: '<span class="cmd">~ $</span> <span class="cmd">echo $MISSION</span>', delay: 700 },
  { html: '<span class="out">"build & safeguard scalable systems — from the kernel up."</span>', delay: 500 }
];

function runTerminal() {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  if (prefersReduced) {
    body.innerHTML = termLines.map(l => `<div>${l.html}</div>`).join('');
    return;
  }
  let i = 0;
  function nextLine() {
    if (i >= termLines.length) {
      body.insertAdjacentHTML('beforeend', '<div><span class="cmd">~ $</span> <span class="cursor"></span></div>');
      return;
    }
    const div = document.createElement('div');
    div.innerHTML = termLines[i].html;
    body.appendChild(div);
    i++;
    setTimeout(nextLine, termLines[i - 1].delay);
  }
  nextLine();
}


// IntersectionObserver alone can miss elements when the page jumps
// past them (keyboard, anchor links); this fallback also fires for
// anything already above the viewport.
function onEnterViewport(el, fn, threshold = 0.12) {
  let done = false;
  const trigger = () => {
    if (done) return;
    done = true;
    fn();
  };
  const check = () => {
    if (done) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight - r.height * threshold || r.bottom <= 0) trigger();
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        trigger();
        io.disconnect();
      }
    });
  }, { threshold });
  io.observe(el);
  window.addEventListener('scroll', () => requestAnimationFrame(check), { passive: true });
  check();
}

const revealEls = document.querySelectorAll('.reveal');
revealEls.forEach((el, i) => {
  el.style.transitionDelay = `${(i % 3) * 90}ms`;
  onEnterViewport(el, () => el.classList.add('visible'));
});

const termEl = document.getElementById('terminal');
if (termEl) onEnterViewport(termEl, runTerminal, 0.05);

const sections = document.querySelectorAll('section, header#hero');
const navAnchors = document.querySelectorAll('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navAnchors.forEach((a) => {
        a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => sectionObserver.observe(s));



const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');

menuToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuToggle.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', open);
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
navLinks.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});


   // CONTACT FORM (Web3Forms)
 

const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = contactForm.querySelector('.submit-btn');
  submitBtn.innerText = 'Transmitting…';
  submitBtn.disabled = true;
  formStatus.innerText = '';

  const formData = new FormData(contactForm);

  if (formData.get('access_key') === 'YOUR_ACCESS_KEY_HERE') {
    formStatus.style.color = '#B3423A';
    formStatus.innerText = 'Owner: set your Web3Forms access key to enable this form.';
    submitBtn.innerText = 'Transmit Message';
    submitBtn.disabled = false;
    return;
  }

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const result = await response.json();
    if (result.success) {
      formStatus.style.color = '#2F7D4F';
      formStatus.innerText = 'Message transmitted successfully.';
      contactForm.reset();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    formStatus.style.color = '#B3423A';
    formStatus.innerText = 'Transmission failed please retry.';
  } finally {
    submitBtn.innerText = 'Transmit Message';
    submitBtn.disabled = false;
  }
});
