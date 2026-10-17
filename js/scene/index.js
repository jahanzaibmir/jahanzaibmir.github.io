// The 4D background. One cloud of points morphs through five 4D shapes as
// the page scrolls, and keeps turning slowly in four dimensions. Scrolling
// also adds a little extra turn, so the shape reacts to the page.
//
// Each section names an empty box in its layout (an "anchor"). The shape
// is drawn inside that box, so it always sits in free space, and when the
// reader moves between sections it travels from one box to the next.
//
// The same frame can also be drawn onto the section card (cards.js), on a
// second canvas with its own WebGL context, so the shape shows on the card
// and lines up exactly with the one on the page.

import { $, clamp, lerp, smoothstep, easeOut, reduceMotion, coarsePointer } from '../lib/env.js';
import { onFrame } from '../lib/ticker.js';
import { where } from '../lib/sections.js';
import { buildShapes, SHAPES } from './shapes.js';
import { rotation4, apply4 } from './math4d.js';
import { createProgram, createBuffer, bindAttrib, perspective, translation } from './gl.js';
import { pointsVertex, pointsFragment, dustVertex, dustFragment } from './shaders.js';
import { createCaption } from './caption.js';

const FOV = (30 * Math.PI) / 180;
const CAM = 7;
const CAPTION_ROOM = 96; // space kept under a shape for its label
const WIDE = window.matchMedia('(min-width: 960px)'); // labels only show here
const ATTRS = {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  powerPreference: 'high-performance'
};

// One entry per section, in page order.
// fit: size inside the anchor box. alpha: brightness of a single point,
// lower for shapes with many points per edge. dist: how strong the 4D
// perspective is. fade: how visible the whole shape is in that section.
const LOOKS = [
  { anchor: '.hero-object', fit: 1, alpha: 0.2, dist: 2.25, fade: 1, caption: 1 },
  { anchor: '#about .rail-object', fit: 0.92, alpha: 0.2, dist: 2.45, fade: 0.9, caption: 1 },
  { anchor: '#work .work-stage', fit: 1.5, alpha: 0.42, dist: 2.45, fade: 0.6, caption: 0 },
  { anchor: '#skills .rail-object', fit: 0.92, alpha: 0.9, dist: 2.6, fade: 0.9, caption: 1 },
  { anchor: '#contact .rail-object', fit: 0.92, alpha: 0.75, dist: 2.5, fade: 0.9, caption: 1 }
];

// The section cards steer the shape through this. It does nothing until the
// scene has started, so cards still work without WebGL.
//   begin(n): move onto the card and morph straight to shape n
//   release(): head back into the page
//   mirror: draw onto the card's canvas too
//   covered: the card hides the page completely, so skip the page canvas
export const sceneCards = {
  begin() {},
  release() {},
  mirror: false,
  covered: false
};

export function initScene() {
  const canvas = $('.scene');
  if (!canvas) return;

  const small = coarsePointer || Math.min(window.innerWidth, window.innerHeight) < 700;
  const N = small ? 7200 : 14400;
  const data = buildShapes(N, small);
  const dust = makeDust(small ? 220 : 520);

  const main = createTarget(canvas, data, dust);
  if (!main) return;
  const cardTarget = createTarget($('#card .card-scene'), data, dust);

  const extents = measureExtents(data.shapes);
  const anchors = LOOKS.map((l) => $(l.anchor));
  const caption = createCaption($('.figure'));
  const last = SHAPES.length - 1;

  /* ---------- Size ---------- */

  let W = 0;
  let H = 0;
  let dpr = 1;
  let sized = false;
  window.addEventListener('resize', () => { sized = false; });

  function resize() {
    sized = true;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
  }

  /* ---------- Where the shape sits ---------- */

  function anchorPose(i) {
    const look = LOOKS[i];
    const el = anchors[i];
    if (el) {
      const r = el.getBoundingClientRect();
      const h = r.height - (look.caption && WIDE.matches ? CAPTION_ROOM : 0);
      if (r.width > 140 && h > 120 && r.height < H * 1.1) {
        return {
          x: r.left + r.width / 2,
          y: r.top + h / 2,
          r: (Math.min(r.width, h) / 2) * look.fit,
          fade: look.fade,
          caption: look.caption
        };
      }
    }
    // no room in the layout (phones): sit behind the text, faint
    return { x: W / 2, y: H * 0.46, r: Math.min(W, H) * 0.46, fade: 0.3, caption: 0 };
  }

  const pose = { x: 0, y: 0, r: 0, fade: 0, caption: 0 };
  let posed = false;

  /* ---------- Section cards ---------- */

  // While a card is up the shape moves onto it and morphs straight from the
  // shape it was to the one the card is for, skipping those in between.
  // When the card lifts the shape glides back into the page.
  const cardBox = $('#card .card-object');
  let card = null;
  let mirrored = false;

  sceneCards.begin = (to) => {
    const from = card && card.k < 1 ? card.to : Math.min(Math.round(where.smooth), last);
    card = { from, to, start: performance.now() / 1000 + 0.28, k: 0, eased: 0, focus: true };
  };
  sceneCards.release = () => {
    if (card) card.focus = false;
  };

  function cardPose() {
    const r = cardBox ? cardBox.getBoundingClientRect() : null;
    if (!r || r.width < 60 || r.height < 60) return { x: W * 0.68, y: H * 0.45, r: Math.min(W, H) * 0.3, fade: 1, caption: 0 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: (Math.min(r.width, r.height) / 2) * 0.96, fade: 1, caption: 0 };
  }

  /* ---------- Start up ---------- */

  let lifted = false;
  let introStart = 0;
  document.addEventListener('intro:lift', () => {
    lifted = true;
    introStart = performance.now() / 1000 + (reduceMotion ? -10 : 0.2);
    canvas.classList.add('is-on');
  });

  /* ---------- Draw ---------- */

  const f = {
    rot: new Float32Array(16),
    view: new Float32Array(16),
    camView: new Float32Array(16),
    proj: new Float32Array(16)
  };
  const angles = [0, 0, 0, 0, 0, 0];
  let spin = 0;

  onFrame((fr) => {
    if (!lifted) return;
    if (!sized) resize();

    const fs = where.smooth;
    let a = Math.min(Math.floor(fs), last);
    let b = Math.min(a + 1, last);
    let t = a === b ? 0 : fs - a;
    let pulse = 0;
    let cardSpin = 0;

    if (card) {
      const k = clamp((fr.time - card.start) / 1.15);
      const eased = k * k * (3 - 2 * k);
      cardSpin = (eased - card.eased) * 1.6;
      card.k = k;
      card.eased = eased;
      if (card.from === card.to) {
        // same shape: let it breathe out and back in instead of morphing
        a = b = card.to;
        t = 0;
        pulse = Math.sin(Math.PI * k);
      } else {
        a = card.from;
        b = card.to;
        t = k;
      }
      if (k >= 1 && !card.focus) card = null;
    }
    const e = smoothstep(0, 1, t);

    // pose: follow the anchors, eased so the shape glides between them
    let target;
    if (card && card.focus) {
      target = cardPose();
    } else {
      const base = Math.min(Math.floor(fs), last);
      const pa = anchorPose(base);
      const pb = anchorPose(Math.min(base + 1, last));
      const pe = smoothstep(0, 1, fs - base);
      target = {
        x: lerp(pa.x, pb.x, pe),
        y: lerp(pa.y, pb.y, pe),
        r: lerp(pa.r, pb.r, pe),
        fade: lerp(pa.fade, pb.fade, pe),
        caption: card ? 0 : lerp(pa.caption, pb.caption, pe)
      };
    }
    const follow = posed && !reduceMotion ? 1 - Math.exp(-fr.dt * (card ? 6 : 9)) : 1;
    for (const key in target) pose[key] += (target[key] - pose[key]) * follow;
    posed = true;

    // turning: a slow drift in time, plus a push from scrolling
    const time = reduceMotion ? 7 : fr.time;
    if (!reduceMotion) spin += fr.vy * fr.dt * 0.00042 + cardSpin;
    angles[0] = 0.16;
    angles[1] = 0.45 + time * 0.012;
    angles[2] = time * 0.15 + spin;
    angles[3] = 0.3 + time * 0.065;
    angles[4] = 0.55;
    angles[5] = time * 0.085 + spin * 0.6;
    rotation4(f.rot, angles);

    const intro = reduceMotion ? 1 : easeOut(clamp((fr.time - introStart) / 2.8));

    // camera
    const aspect = W / H;
    perspective(f.proj, FOV, aspect, 0.1, 100);
    const halfH = Math.tan(FOV / 2) * CAM;
    const halfW = halfH * aspect;
    translation(f.view, (pose.x / W * 2 - 1) * halfW, (1 - pose.y / H * 2) * halfH, -CAM);
    translation(f.camView, 0, 0, -CAM);

    // everything both canvases need for this frame
    f.bw = Math.round(W * dpr);
    f.bh = Math.round(H * dpr);
    f.a = a;
    f.b = b;
    f.t = t;
    f.gather = intro * (1 - 0.3 * pulse);
    f.intro = intro;
    f.dist = lerp(LOOKS[a].dist, LOOKS[b].dist, e);
    // sized so the shape's usual reach fills its box
    f.scale = (pose.r / H) * 2 * halfH / (lerp(extents[a], extents[b], e) * 1.14);
    f.point = 1.55 * dpr;
    f.alphaA = LOOKS[a].alpha;
    f.alphaB = LOOKS[b].alpha;
    f.fade = pose.fade;
    f.scroll = (fr.y / H) * 2.2;
    f.time = time;
    f.n = N;
    f.dustN = dust.length / 4;

    if (!sceneCards.covered) drawTarget(main, f);
    if (cardTarget) {
      if (sceneCards.mirror) {
        drawTarget(cardTarget, f);
        mirrored = true;
      } else if (mirrored) {
        clearTarget(cardTarget);
        mirrored = false;
      }
    }

    // the label: fades out mid morph and swaps its text at the halfway point
    if (caption) {
      caption.setShape(Math.min(Math.round(fs), last));
      caption.setAngles(angles, fr.time);
      const alpha = pose.caption * Math.pow(1 - Math.sin(Math.PI * t), 2) * intro;
      const x = Math.min(Math.max(pose.x - pose.r * 0.86, 16), W - 270);
      const y = Math.min(Math.max(pose.y + pose.r + 18, 90), H - 112);
      caption.place(x, y, alpha);
    }
  });
}

/* ---------- Canvases the scene can draw into ---------- */

// A canvas with its own WebGL context and its own copy of the buffers.
function createTarget(canvas, data, dust) {
  const gl = canvas && (canvas.getContext('webgl2', ATTRS) || canvas.getContext('webgl', ATTRS));
  if (!gl) return null;
  const target = { canvas, gl, res: null, lost: false };

  const setup = () => {
    target.res = {
      points: createProgram(gl, pointsVertex, pointsFragment),
      dust: createProgram(gl, dustVertex, dustFragment),
      pos: data.shapes.map((s) => createBuffer(gl, s.pos)),
      size: data.shapes.map((s) => createBuffer(gl, s.size)),
      start: createBuffer(gl, data.start),
      seed: createBuffer(gl, data.seed),
      dustBuf: createBuffer(gl, dust)
    };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
  };

  try {
    setup();
  } catch (err) {
    console.warn('4D background is off:', err.message);
    return null;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    target.lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      setup();
      target.lost = false;
    } catch {
      target.res = null;
    }
  });
  return target;
}

function drawTarget(target, f) {
  const { gl, res, canvas } = target;
  if (target.lost || !res) return;
  if (canvas.width !== f.bw || canvas.height !== f.bh) {
    canvas.width = f.bw;
    canvas.height = f.bh;
  }
  gl.viewport(0, 0, f.bw, f.bh);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // the shape
  const P = res.points;
  gl.useProgram(P.program);
  bindAttrib(gl, P.attribs.aA, res.pos[f.a], 4);
  bindAttrib(gl, P.attribs.aB, res.pos[f.b], 4);
  bindAttrib(gl, P.attribs.aStart, res.start, 4);
  bindAttrib(gl, P.attribs.aSizeA, res.size[f.a], 1);
  bindAttrib(gl, P.attribs.aSizeB, res.size[f.b], 1);
  bindAttrib(gl, P.attribs.aSeed, res.seed, 1);
  const U = P.uniforms;
  gl.uniformMatrix4fv(U.uRot, false, f.rot);
  gl.uniformMatrix4fv(U.uView, false, f.view);
  gl.uniformMatrix4fv(U.uProj, false, f.proj);
  gl.uniform1f(U.uMorph, f.t);
  gl.uniform1f(U.uIntro, f.gather);
  gl.uniform1f(U.uDist, f.dist);
  gl.uniform1f(U.uScale, f.scale);
  gl.uniform1f(U.uPoint, f.point);
  gl.uniform1f(U.uAlphaA, f.alphaA);
  gl.uniform1f(U.uAlphaB, f.alphaB);
  gl.uniform1f(U.uFade, f.fade);
  gl.uniform1f(U.uCam, CAM);
  gl.uniform3f(U.uColor, 0.93, 0.93, 0.93);
  gl.drawArrays(gl.POINTS, 0, f.n);
  disableAttribs(gl, P.attribs);

  // the dust
  const D = res.dust;
  const DU = D.uniforms;
  gl.useProgram(D.program);
  bindAttrib(gl, D.attribs.aPos, res.dustBuf, 4);
  gl.uniformMatrix4fv(DU.uView, false, f.camView);
  gl.uniformMatrix4fv(DU.uProj, false, f.proj);
  gl.uniform1f(DU.uScroll, f.scroll);
  gl.uniform1f(DU.uTime, f.time);
  gl.uniform1f(DU.uPoint, 1.4 * (f.point / 1.55));
  gl.uniform1f(DU.uFade, f.intro);
  gl.uniform1f(DU.uCam, CAM);
  gl.uniform3f(DU.uColor, 0.85, 0.85, 0.85);
  gl.drawArrays(gl.POINTS, 0, f.dustN);
  disableAttribs(gl, D.attribs);
}

function clearTarget(target) {
  if (target.lost || !target.res) return;
  target.gl.clear(target.gl.COLOR_BUFFER_BIT);
}

function disableAttribs(gl, attribs) {
  for (const name in attribs) {
    if (attribs[name] >= 0) gl.disableVertexAttribArray(attribs[name]);
  }
}

// How far each shape usually reaches across the screen once turned and
// projected. Sizing by this keeps every shape looking the same size.
function measureExtents(shapes) {
  const m = new Float32Array(16);
  const angles = [0, 0, 0, 0, 0, 0];
  const v = [0, 0, 0, 0];
  const out = [0, 0, 0, 0];
  return shapes.map((shape, i) => {
    const dist = LOOKS[i].dist;
    const samples = 24;
    let total = 0;
    for (let s = 0; s < samples; s++) {
      for (let j = 0; j < 6; j++) angles[j] = ((s + 1) * (j + 1.618) * 2.399) % (Math.PI * 2);
      rotation4(m, angles);
      let max = 0;
      for (let p = 0; p < shape.pos.length; p += 4 * 17) {
        v[0] = shape.pos[p];
        v[1] = shape.pos[p + 1];
        v[2] = shape.pos[p + 2];
        v[3] = shape.pos[p + 3];
        apply4(m, v, out);
        const k = dist / (dist - out[3]);
        const near = CAM / (CAM - out[2] * k * 0.6);
        max = Math.max(max, Math.hypot(out[0], out[1]) * k * near);
      }
      total += max;
    }
    return total / samples;
  });
}

// x, y, z and a size between 0 and 1
function makeDust(count) {
  const out = new Float32Array(count * 4);
  let s = 77;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    out[i * 4] = (rand() * 2 - 1) * 12;
    out[i * 4 + 1] = (rand() * 2 - 1) * 8;
    out[i * 4 + 2] = -14 + rand() * 16;
    out[i * 4 + 3] = rand();
  }
  return out;
}
