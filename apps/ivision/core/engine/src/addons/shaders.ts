/**
 * Les shaders des fonds de matière (addon `ogl`).
 *
 * Chaque effet est une fonction pure de `uTime` (secondes, posées par le moteur), de la graine
 * et des quatre couleurs de la surface : la même image à chaque lecture. Aucune texture, aucun
 * hasard libre (le bruit vient de `hash21`, une fonction de la position).
 *
 * Sortie : couleur PRÉMULTIPLIÉE (le canevas est composé sur la surface de la scène), d'opacité
 * `uStrength` : le fond colore la surface, il ne la remplace pas — le texte reste lisible.
 *
 * Écrits pour ce moteur (GLSL ES 1.00, accepté par WebGL 1 et 2). Les idées — rideaux d'aurore,
 * satin, plasma, encre dans l'eau, dégradé à points, courbes de niveau, vagues, métaballes — sont
 * celles de React Bits, Vanta.js, Granim.js, WebGL Fluid Simulation et Shader Park ; aucune ligne
 * n'en est copiée.
 */

const HEAD = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
uniform float uScale;
uniform float uSeed;
uniform float uStrength;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.02 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}
vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.35, t));
  c = mix(c, uC3, smoothstep(0.3, 0.7, t));
  return mix(c, uC4, smoothstep(0.65, 1.0, t));
}
vec2 coords() {
  return (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
}
/** Couleur droite + opacité → couleur prémultipliée, de la force du fond. */
vec4 outColor(vec3 col, float a) {
  float A = clamp(a, 0.0, 1.0) * uStrength;
  return vec4(min(col * A, vec3(A)), A);
}
`;

const aurora = `${HEAD}
void main() {
  vec2 p = coords();
  float t = uTime * 0.16 + uSeed;
  vec3 col = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (1.3 + fi * 0.4) * uScale + t * (0.6 + fi * 0.25) + fi * 3.1;
    float base = -0.18 + fi * 0.16 + 0.2 * sin(x * 1.4 + fbm(vec2(x * 0.7, t + fi)) * 3.0);
    float d = p.y - base;
    float curtain = exp(-pow(max(d, 0.0) * 3.0, 1.15)) * smoothstep(-0.3, 0.0, d);
    float rays = 0.5 + 0.5 * fbm(vec2(p.x * 9.0 * uScale + fi * 7.0, t * 1.4));
    float k = curtain * rays;
    vec3 c = fi < 0.5 ? uC1 : (fi < 1.5 ? uC2 : uC3);
    col += c * k;
    a += k;
  }
  gl_FragColor = outColor(col / max(a, 0.001), a);
}`;

const silk = `${HEAD}
void main() {
  vec2 p = coords() * 2.6 * uScale;
  float t = uTime * 0.14 + uSeed;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p.x += 0.55 / fi * sin(fi * p.y * 1.6 + t * fi + uSeed);
    p.y += 0.55 / fi * cos(fi * p.x * 1.4 + t * fi * 0.8);
  }
  float v = 0.5 + 0.5 * sin(p.x * 2.1 + p.y * 1.3 + 1.2);
  v = smoothstep(0.0, 1.0, v);
  vec3 col = pal(v) + vec3(pow(v, 7.0) * 0.18);
  gl_FragColor = outColor(col, 1.0);
}`;

const plasma = `${HEAD}
void main() {
  vec2 p = coords() * 3.2 * uScale;
  float t = uTime * 0.35 + uSeed;
  float v = sin(p.x + t) + sin(p.y * 1.3 + t * 1.3) + sin((p.x + p.y) * 0.9 + t * 0.7) + sin(length(p) * 1.8 - t * 1.5);
  v = v * 0.25 + 0.5;
  gl_FragColor = outColor(pal(v), 1.0);
}`;

const fluid = `${HEAD}
void main() {
  vec2 p = coords() * 1.8 * uScale;
  float t = uTime * 0.12 + uSeed;
  vec2 q = vec2(fbm(p + t * 0.4), fbm(p + vec2(5.2, 1.3) - t * 0.3));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.5), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.35));
  float f = fbm(p + 3.5 * r);
  vec3 col = pal(smoothstep(0.15, 0.85, f));
  col = mix(col, uC4, clamp(length(q) * 0.45, 0.0, 1.0) * 0.35);
  gl_FragColor = outColor(col, 1.0);
}`;

const mesh = `${HEAD}
void main() {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = vUv * asp;
  float t = uTime * 0.22 + uSeed;
  vec2 c1 = vec2(0.28 + 0.2 * sin(t * 0.7), 0.3 + 0.2 * cos(t * 0.9)) * asp;
  vec2 c2 = vec2(0.72 + 0.18 * cos(t * 0.6), 0.28 + 0.2 * sin(t * 0.8)) * asp;
  vec2 c3 = vec2(0.3 + 0.2 * cos(t * 0.5 + 1.0), 0.72 + 0.16 * sin(t * 0.7)) * asp;
  vec2 c4 = vec2(0.7 + 0.2 * sin(t * 0.6 + 2.0), 0.74 + 0.16 * cos(t * 0.5)) * asp;
  float k = 3.2 / uScale;
  float w1 = 1.0 / (0.02 + pow(distance(p, c1), k));
  float w2 = 1.0 / (0.02 + pow(distance(p, c2), k));
  float w3 = 1.0 / (0.02 + pow(distance(p, c3), k));
  float w4 = 1.0 / (0.02 + pow(distance(p, c4), k));
  vec3 col = (w1 * uC1 + w2 * uC2 + w3 * uC3 + w4 * uC4) / (w1 + w2 + w3 + w4);
  col += (hash21(gl_FragCoord.xy) - 0.5) * 0.025;
  gl_FragColor = outColor(col, 1.0);
}`;

const topology = `${HEAD}
void main() {
  vec2 p = coords() * 1.7 * uScale;
  float t = uTime * 0.05 + uSeed;
  float h = fbm(p + vec2(t, -t * 0.6));
  float e = 0.01;
  float gx = (fbm(p + vec2(e, 0.0) + vec2(t, -t * 0.6)) - h) / e;
  float gy = (fbm(p + vec2(0.0, e) + vec2(t, -t * 0.6)) - h) / e;
  float g = length(vec2(gx, gy)) + 0.001;
  float n = 13.0;
  float dist = abs(fract(h * n) - 0.5) / (n * g);
  float px = 1.7 * uScale / uRes.y;
  float line = 1.0 - smoothstep(px * 0.7, px * 1.9, dist);
  vec3 col = mix(uC1, uC2, smoothstep(0.3, 0.7, h));
  gl_FragColor = outColor(col, line * 0.9);
}`;

const waves = `${HEAD}
void main() {
  vec2 uv = vUv;
  float t = uTime * 0.25 + uSeed;
  vec3 col = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = 0.78 - fi * 0.13 + 0.05 * sin(uv.x * (3.0 + fi * 1.3) * uScale + t * (1.0 + fi * 0.3) + fi * 2.0) + 0.03 * sin(uv.x * (7.0 + fi * 2.0) * uScale - t * 1.3 + fi);
    float below = smoothstep(0.004, -0.004, uv.y - y);
    float ridge = smoothstep(0.012, 0.0, abs(uv.y - y));
    vec3 c = fi < 0.5 ? uC1 : (fi < 1.5 ? uC2 : (fi < 2.5 ? uC3 : (fi < 3.5 ? uC4 : uC2)));
    float la = below * (0.22 + 0.06 * fi) + ridge * 0.5;
    col = mix(col, c, la);
    a = a + la * (1.0 - a);
  }
  gl_FragColor = outColor(col, a);
}`;

const blobs = `${HEAD}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float map(vec3 p, float t) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec3 c = vec3(sin(t * 0.7 + fi * 1.7) * 0.95, cos(t * 0.6 + fi * 2.3) * 0.75, sin(t * 0.5 + fi * 3.1) * 0.4);
    d = smin(d, length(p - c) - (0.46 + 0.12 * sin(fi + t)), 0.6);
  }
  return d;
}
void main() {
  vec2 p = coords() * 2.0 / uScale;
  float t = uTime * 0.5 + uSeed;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(p, -1.7));
  float dist = 0.0;
  float minD = 1e5;
  bool hit = false;
  for (int i = 0; i < 40; i++) {
    float d = map(ro + rd * dist, t);
    minD = min(minD, d);
    if (d < 0.003) {
      hit = true;
      break;
    }
    dist += d;
    if (dist > 8.0) break;
  }
  vec3 col = uC1;
  float a = exp(-max(minD, 0.0) * 5.0) * 0.28;
  if (hit) {
    vec3 pos = ro + rd * dist;
    vec2 e = vec2(0.004, 0.0);
    vec3 n = normalize(vec3(map(pos + e.xyy, t) - map(pos - e.xyy, t), map(pos + e.yxy, t) - map(pos - e.yxy, t), map(pos + e.yyx, t) - map(pos - e.yyx, t)));
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
    float light = clamp(dot(n, normalize(vec3(0.5, 0.8, 0.6))), 0.0, 1.0);
    col = mix(pal(0.2 + 0.5 * (n.y * 0.5 + 0.5)), uC4, fres * 0.6) * (0.55 + 0.6 * light) + vec3(pow(light, 18.0) * 0.35);
    a = 1.0;
  }
  gl_FragColor = outColor(col, a);
}`;

export const SHADERS: Record<string, string> = { aurora, silk, plasma, fluid, mesh, topology, waves, blobs };
export const SHADER_IDS = Object.keys(SHADERS);

export const VERTEX = `attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
