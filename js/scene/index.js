// The 4D background. One cloud of points morphs through five 4D shapes as
// the page scrolls, and keeps turning slowly in four dimensions. Scrolling
// also adds a little extra turn, so the shape reacts to the page.
//
// Each section names an empty box in its layout (an "anchor"). The shape
// is drawn inside that box, so it always sits in free space, and when the
// reader moves between sections it travels from one box to the next.

import { $, lerp, smoothstep, easeOut, reduceMotion, coarsePointer } from '../lib/env.js';
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

export function initScene() {
  const canvas = $('.scene');
  if (!canvas) return;

  const attrs = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance'
  };
  const gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
  if (!gl) return;

  const small = coarsePointer || Math.min(window.innerWidth, window.innerHeight) < 700;
  const N = small ? 7200 : 14400;
  const data = buildShapes(N, small);
  const extents = measureExtents(data.shapes);
  const dust = makeDust(small ? 220 : 520);
  const anchors = LOOKS.map((l) => $(l.anchor));
  const caption = createCaption($('.figure'));

  let res = null;
  let lost = false;

  function setup() {
    res = {
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
  }

  try {
    setup();
  } catch (err) {
    console.warn('4D background is off:', err.message);
    return;
  }

  /* ---------- Size ---------- */

  let W = 0;
  let H = 0;
  let dpr = 1;
  let sized = false;
  window.addEventListener('resize', () => { sized = false; });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      setup();
      lost = false;
      sized = false;
    } catch {
      res = null;
    }
  });

  function resize() {
    sized = true;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
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

  /* ---------- Start up ---------- */

  let lifted = false;
  let introStart = 0;
  document.addEventListener('intro:lift', () => {
    lifted = true;
    introStart = performance.now() / 1000 + (reduceMotion ? -10 : 0.2);
    canvas.classList.add('is-on');
  });

  /* ---------- Draw ---------- */

  const rot = new Float32Array(16);
  const view = new Float32Array(16);
  const camView = new Float32Array(16);
  const proj = new Float32Array(16);
  const angles = [0, 0, 0, 0, 0, 0];
  let spin = 0;
  const last = SHAPES.length - 1;

  onFrame((fr) => {
    if (!lifted || lost || !res) return;
    if (!sized) resize();

    const fs = where.smooth;
    const a = Math.min(Math.floor(fs), last);
    const b = Math.min(a + 1, last);
    const t = a === b ? 0 : fs - a;
    const e = smoothstep(0, 1, t);

    // pose: follow the anchors, eased so the shape glides between them
    const pa = anchorPose(a);
    const pb = anchorPose(b);
    const target = {
      x: lerp(pa.x, pb.x, e),
      y: lerp(pa.y, pb.y, e),
      r: lerp(pa.r, pb.r, e),
      fade: lerp(pa.fade, pb.fade, e),
      caption: lerp(pa.caption, pb.caption, e)
    };
    const follow = posed && !reduceMotion ? 1 - Math.exp(-fr.dt * 9) : 1;
    for (const key in target) pose[key] += (target[key] - pose[key]) * follow;
    posed = true;

    // turning: a slow drift in time, plus a push from scrolling
    const time = reduceMotion ? 7 : fr.time;
    if (!reduceMotion) spin += fr.vy * fr.dt * 0.00042;
    angles[0] = 0.16;
    angles[1] = 0.45 + time * 0.012;
    angles[2] = time * 0.15 + spin;
    angles[3] = 0.3 + time * 0.065;
    angles[4] = 0.55;
    angles[5] = time * 0.085 + spin * 0.6;
    rotation4(rot, angles);

    const intro = reduceMotion ? 1 : easeOut(Math.min(1, Math.max(0, (fr.time - introStart) / 2.8)));

    // camera
    const aspect = W / H;
    perspective(proj, FOV, aspect, 0.1, 100);
    const halfH = Math.tan(FOV / 2) * CAM;
    const halfW = halfH * aspect;
    translation(view, (pose.x / W * 2 - 1) * halfW, (1 - pose.y / H * 2) * halfH, -CAM);
    translation(camView, 0, 0, -CAM);

    // sized so the shape's usual reach fills its box
    const dist = lerp(LOOKS[a].dist, LOOKS[b].dist, e);
    const reach = lerp(extents[a], extents[b], e);
    const scale = (pose.r / H) * 2 * halfH / (reach * 1.14);

    gl.clear(gl.COLOR_BUFFER_BIT);

    // the shape
    const P = res.points;
    gl.useProgram(P.program);
    bindAttrib(gl, P.attribs.aA, res.pos[a], 4);
    bindAttrib(gl, P.attribs.aB, res.pos[b], 4);
    bindAttrib(gl, P.attribs.aStart, res.start, 4);
    bindAttrib(gl, P.attribs.aSizeA, res.size[a], 1);
    bindAttrib(gl, P.attribs.aSizeB, res.size[b], 1);
    bindAttrib(gl, P.attribs.aSeed, res.seed, 1);
    const U = P.uniforms;
    gl.uniformMatrix4fv(U.uRot, false, rot);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniform1f(U.uMorph, t);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uDist, dist);
    gl.uniform1f(U.uScale, scale);
    gl.uniform1f(U.uPoint, 1.55 * dpr);
    gl.uniform1f(U.uAlphaA, LOOKS[a].alpha);
    gl.uniform1f(U.uAlphaB, LOOKS[b].alpha);
    gl.uniform1f(U.uFade, pose.fade);
    gl.uniform1f(U.uCam, CAM);
    gl.uniform3f(U.uColor, 0.93, 0.93, 0.93);
    gl.drawArrays(gl.POINTS, 0, N);
    disableAttribs(gl, P.attribs);

    // the dust
    const D = res.dust;
    gl.useProgram(D.program);
    bindAttrib(gl, D.attribs.aPos, res.dustBuf, 4);
    gl.uniformMatrix4fv(D.uniforms.uView, false, camView);
    gl.uniformMatrix4fv(D.uniforms.uProj, false, proj);
    gl.uniform1f(D.uniforms.uScroll, (fr.y / H) * 2.2);
    gl.uniform1f(D.uniforms.uTime, time);
    gl.uniform1f(D.uniforms.uPoint, 1.4 * dpr);
    gl.uniform1f(D.uniforms.uFade, intro);
    gl.uniform1f(D.uniforms.uCam, CAM);
    gl.uniform3f(D.uniforms.uColor, 0.85, 0.85, 0.85);
    gl.drawArrays(gl.POINTS, 0, dust.length / 4);
    disableAttribs(gl, D.attribs);

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

function disableAttribs(gl, attribs) {
  for (const name in attribs) {
    if (attribs[name] >= 0) gl.disableVertexAttribArray(attribs[name]);
  }
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
