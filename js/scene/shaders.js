// GLSL for the scene. Written for WebGL 1 so it also runs in WebGL 2.
//
// Every point carries its position in two shapes (A and B) plus a start
// position. The vertex shader blends between them, turns the result in 4D,
// projects it down to 3D, then the camera projects that onto the screen.

export const pointsVertex = /* glsl */ `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aStart;
attribute float aSizeA;
attribute float aSizeB;
attribute float aSeed;

uniform mat4 uRot;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uMorph;
uniform float uIntro;
uniform float uDist;
uniform float uScale;
uniform float uPoint;
uniform float uAlphaA;
uniform float uAlphaB;
uniform float uFade;
uniform float uCam;

varying float vAlpha;

float ease(float t) { return t * t * (3.0 - 2.0 * t); }

void main() {
  // each point starts its trip a little later than the one before
  float m = ease(clamp((uMorph - aSeed * 0.45) / 0.55, 0.0, 1.0));
  vec4 p = mix(aA, aB, m);

  // swell outward mid trip, so shapes pass through each other softly
  float trip = sin(m * 3.14159265);
  p *= 1.0 + trip * (0.12 + 0.3 * aSeed);

  float k0 = ease(clamp((uIntro - aSeed * 0.5) / 0.5, 0.0, 1.0));
  p = mix(aStart, p, k0);

  p = uRot * p;

  // 4D to 3D: nearer the 4D eye means bigger
  float k = uDist / max(uDist - p.w, 0.45);
  vec3 q = p.xyz * k * uScale;

  vec4 eye = uView * vec4(q, 1.0);
  gl_Position = uProj * eye;

  float depth = clamp((k - 0.62) / 1.25, 0.0, 1.0);
  float size = mix(aSizeA, aSizeB, m) * uPoint * k * (uCam / max(-eye.z, 0.1));
  float alpha = mix(uAlphaA, uAlphaB, m) * (0.22 + 0.78 * depth) * (0.35 + 0.65 * k0) * uFade;

  // points smaller than 1.5px flicker, so fade them instead of shrinking
  alpha *= clamp(size / 1.5, 0.0, 1.0);
  gl_PointSize = clamp(size, 1.5, 7.0);
  vAlpha = alpha * (1.0 + trip * 0.4);
}
`;

export const pointsFragment = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.08, length(c)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

// Dust: a few faint specks far away that drift past at different speeds
// as you scroll, which gives the space some depth.
export const dustVertex = /* glsl */ `
attribute vec4 aPos;

uniform mat4 uView;
uniform mat4 uProj;
uniform float uScroll;
uniform float uTime;
uniform float uPoint;
uniform float uFade;
uniform float uCam;

varying float vAlpha;

void main() {
  vec3 p = aPos.xyz;
  float near = clamp((p.z + 14.0) / 16.0, 0.0, 1.0);
  p.y = mod(p.y + uScroll * (0.25 + near * 0.9) + uTime * 0.03 * (0.5 + aPos.w), 16.0) - 8.0;
  p.x += sin(uTime * 0.05 + aPos.w * 6.2831) * 0.3;
  vec4 eye = uView * vec4(p, 1.0);
  gl_Position = uProj * eye;
  float size = uPoint * (0.6 + aPos.w) * (uCam / max(-eye.z, 0.1));
  gl_PointSize = clamp(size, 1.0, 4.0);
  vAlpha = (0.08 + 0.22 * near) * uFade * clamp(size, 0.0, 1.0);
}
`;

export const dustFragment = pointsFragment;
