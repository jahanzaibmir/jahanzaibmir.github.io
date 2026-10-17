// The boot logo: a small tesseract drawn on a 2D canvas. Its edges draw
// themselves in one after another while it turns in four dimensions.
// It needs no WebGL, so it shows instantly while everything else loads.

import { tesseractCorners, edgesOf } from '../scene/shapes.js';
import { rotation4, apply4, project4 } from '../scene/math4d.js';

export function startLogo(canvas) {
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = canvas.clientWidth || 136;
  const size = Math.round(cssSize * dpr);
  canvas.width = size;
  canvas.height = size;

  const corners = tesseractCorners();
  const edges = edgesOf(corners);
  const m = new Float32Array(16);
  const angles = [0.2, 0, 0, 0.35, 0, 0];
  const v = [0, 0, 0, 0];
  const pts = corners.map(() => [0, 0, 0]);
  const half = size / 2;
  const t0 = performance.now();
  let raf = 0;

  const draw = (now) => {
    const t = (now - t0) / 1000;
    angles[1] = 0.5 + t * 0.18;
    angles[2] = t * 0.85;
    angles[5] = t * 0.5;
    rotation4(m, angles);

    corners.forEach((c, i) => {
      apply4(m, c, v);
      project4(v, 2.2, v);
      const zk = 3.4 / (3.4 - v[2]);
      pts[i][0] = half + v[0] * zk * size * 0.3;
      pts[i][1] = half - v[1] * zk * size * 0.3;
      pts[i][2] = v[3];
    });

    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.3 * dpr;

    let drawn = 0;
    edges.forEach(([a, b], i) => {
      const p = Math.min(1, Math.max(0, (t - 0.15 - i * 0.024) / 0.4));
      if (p <= 0) return;
      drawn++;
      const e = 1 - Math.pow(1 - p, 3);
      const A = pts[a];
      const B = pts[b];
      const depth = Math.min(1, Math.max(0, ((A[2] + B[2]) / 2 - 0.65) / 1.1));
      ctx.strokeStyle = `rgba(242, 242, 242, ${(0.22 + 0.78 * depth).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(A[0] + (B[0] - A[0]) * e, A[1] + (B[1] - A[1]) * e);
      ctx.stroke();
    });

    // corners appear once their edges have started
    if (drawn > 4) {
      const a = Math.min(1, (drawn - 4) / 20);
      pts.forEach(([x, y, k]) => {
        ctx.fillStyle = `rgba(242, 242, 242, ${(a * (0.35 + 0.65 * Math.min(1, (k - 0.65) / 1.1))).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.9 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => cancelAnimationFrame(raf);
}
