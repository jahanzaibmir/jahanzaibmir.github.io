// The 4D shapes the background moves through, one per section. Each shape
// is turned into the same number of points so any shape can morph into any
// other: point i of one shape simply travels to point i of the next.
// Every shape fits inside a 4D sphere of radius 1.

const PHI = (1 + Math.sqrt(5)) / 2;

export const SHAPES = [
  { name: 'Tesseract', note: 'A cube in four dimensions. 16 corners and 32 edges.' },
  { name: '16 cell', note: 'The 4D version of an octahedron. 8 corners and 24 edges.' },
  { name: '24 cell', note: 'A shape that only exists in 4D. 24 corners and 96 edges.' },
  { name: '600 cell', note: 'Made of 600 tetrahedra. 120 corners and 720 edges.' },
  { name: 'Hopf fibration', note: 'A 4D sphere made of circles that all link together.' }
];

/* ---------- Corners ---------- */

export function tesseractCorners() {
  const v = [];
  for (let i = 0; i < 16; i++) {
    v.push([i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5, i & 8 ? 0.5 : -0.5]);
  }
  return v;
}

function cell16Corners() {
  const v = [];
  for (let axis = 0; axis < 4; axis++) {
    for (const s of [1, -1]) {
      const p = [0, 0, 0, 0];
      p[axis] = s;
      v.push(p);
    }
  }
  return v;
}

function cell24Corners() {
  const v = [];
  const r = Math.SQRT1_2;
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (const sa of [1, -1]) {
        for (const sb of [1, -1]) {
          const p = [0, 0, 0, 0];
          p[a] = sa * r;
          p[b] = sb * r;
          v.push(p);
        }
      }
    }
  }
  return v;
}

function evenPermutations() {
  const out = [];
  const perm = (arr, rest) => {
    if (!rest.length) {
      let inversions = 0;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (arr[i] > arr[j]) inversions++;
      if (inversions % 2 === 0) out.push(arr);
      return;
    }
    rest.forEach((x, i) => perm([...arr, x], rest.filter((_, j) => j !== i)));
  };
  perm([], [0, 1, 2, 3]);
  return out;
}

function cell600Corners() {
  const v = cell16Corners();
  for (let i = 0; i < 16; i++) {
    v.push([i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5, i & 8 ? 0.5 : -0.5]);
  }
  // even permutations of (±φ, ±1, ±1/φ, 0) / 2
  const base = [PHI / 2, 0.5, 1 / (2 * PHI), 0];
  for (const order of evenPermutations()) {
    for (let s = 0; s < 8; s++) {
      const vals = [base[0] * (s & 1 ? -1 : 1), base[1] * (s & 2 ? -1 : 1), base[2] * (s & 4 ? -1 : 1), 0];
      const p = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) p[order[k]] = vals[k];
      v.push(p);
    }
  }
  return v;
}

// Edges join every pair of corners at the shortest distance found
export function edgesOf(corners) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  let min = Infinity;
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) min = Math.min(min, d(corners[i], corners[j]));
  }
  const edges = [];
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      if (Math.abs(d(corners[i], corners[j]) - min) < 1e-6) edges.push([i, j]);
    }
  }
  return edges;
}

/* ---------- Turning shapes into points ---------- */

// Spread N points along the edges, evenly. The ends of each edge (the
// corners) are drawn a little larger.
function alongEdges(corners, edges, N) {
  const pos = new Float32Array(N * 4);
  const size = new Float32Array(N);
  const per = Math.floor(N / edges.length);
  let extra = N - per * edges.length;
  let k = 0;
  edges.forEach(([a, b]) => {
    const count = per + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    const A = corners[a];
    const B = corners[b];
    for (let j = 0; j < count; j++) {
      const t = count === 1 ? 0.5 : j / (count - 1);
      for (let c = 0; c < 4; c++) pos[k * 4 + c] = A[c] + (B[c] - A[c]) * t;
      size[k] = j === 0 || j === count - 1 ? 2.4 : 1;
      k++;
    }
  });
  return { pos, size };
}

// Hopf fibration: every point of an ordinary sphere becomes a circle in the
// 4D sphere, and no two circles touch, yet every pair is linked. Here a few
// rings of base points give families of circles lying on nested tori.
function hopf(N, small) {
  const rings = small
    ? [[0.42, 6], [0.785, 12], [1.15, 6]]
    : [[0.36, 10], [0.62, 12], [0.95, 14], [1.21, 12]];
  const fibres = [];
  rings.forEach(([eta, count], r) => {
    for (let j = 0; j < count; j++) fibres.push([eta, (j / count) * Math.PI * 2 + r * 0.35]);
  });
  const pos = new Float32Array(N * 4);
  const size = new Float32Array(N);
  const per = Math.floor(N / fibres.length);
  let k = 0;
  fibres.forEach(([eta, phase], f) => {
    const count = f === fibres.length - 1 ? N - k : per;
    const ce = Math.cos(eta);
    const se = Math.sin(eta);
    for (let j = 0; j < count; j++) {
      const t = (j / count) * Math.PI * 2;
      pos[k * 4] = ce * Math.cos(t + phase);
      pos[k * 4 + 1] = ce * Math.sin(t + phase);
      pos[k * 4 + 2] = se * Math.cos(t);
      pos[k * 4 + 3] = se * Math.sin(t);
      size[k] = 1;
      k++;
    }
  });
  return { pos, size };
}

// Where points start before the first shape assembles: a loose shell
// around the middle
function scatter(N, rand) {
  const pos = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    let x, y, z, w, len;
    do {
      x = rand() * 2 - 1;
      y = rand() * 2 - 1;
      z = rand() * 2 - 1;
      w = rand() * 2 - 1;
      len = Math.hypot(x, y, z, w);
    } while (len > 1 || len < 0.05);
    const r = 1.35 + rand() * 0.5;
    pos[i * 4] = (x / len) * r;
    pos[i * 4 + 1] = (y / len) * r;
    pos[i * 4 + 2] = (z / len) * r;
    pos[i * 4 + 3] = (w / len) * r * 0.5;
  }
  return pos;
}

// small seeded random, so the page looks the same on every visit
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildShapes(N, small) {
  const rand = seeded(1318);
  const t = tesseractCorners();
  const c16 = cell16Corners();
  const c24 = cell24Corners();
  const c600 = cell600Corners();

  const shapes = [
    alongEdges(t, edgesOf(t), N),
    alongEdges(c16, edgesOf(c16), N),
    alongEdges(c24, edgesOf(c24), N),
    alongEdges(c600, edgesOf(c600), N),
    hopf(N, small)
  ];

  // each point leaves a little after the one before it, with some jitter,
  // so a morph runs through the shape like a wave
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) seed[i] = 0.72 * (i / N) + 0.28 * rand();

  return { shapes, start: scatter(N, rand), seed };
}
