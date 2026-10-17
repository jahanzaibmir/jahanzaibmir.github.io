// Rotation in four dimensions happens in a plane, not around an axis. There
// are six planes: XY, XZ, XW, YZ, YW and ZW. These helpers build one 4x4
// matrix from an angle in each plane. Matrices are column major, the layout
// WebGL expects.

const PLANES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

export function identity(out = new Float32Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// out = out * R, where R turns the plane of axes i and j by angle a.
// Only columns i and j change.
function turn(out, i, j, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let r = 0; r < 4; r++) {
    const mi = out[i * 4 + r];
    const mj = out[j * 4 + r];
    out[i * 4 + r] = mi * c + mj * s;
    out[j * 4 + r] = mj * c - mi * s;
  }
}

// angles: [xy, xz, xw, yz, yw, zw] in radians
export function rotation4(out, angles) {
  identity(out);
  for (let p = 0; p < 6; p++) {
    if (angles[p]) turn(out, PLANES[p][0], PLANES[p][1], angles[p]);
  }
  return out;
}

export function apply4(m, v, out) {
  for (let r = 0; r < 4; r++) {
    out[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
  }
  return out;
}

// Perspective from 4D down to 3D: points with a larger w are nearer the
// 4D eye, so they come out bigger. This is what makes the inner cube of a
// tesseract look smaller than the outer one.
export function project4(v, dist, out) {
  const k = dist / Math.max(dist - v[3], 0.4);
  out[0] = v[0] * k;
  out[1] = v[1] * k;
  out[2] = v[2] * k;
  out[3] = k;
  return out;
}
