/**
 * ANIMATIONS LOTTIE INTÉGRÉES — écrites par le code, aux couleurs de la marque.
 *
 * De vrais fichiers Lottie (format Bodymovin), joués par lottie-web dans la
 * vidéo, sans banque externe ni licence à vérifier : confettis, coche validée,
 * étincelles, onde, éclat, cœur. L'utilisateur peut aussi importer ses propres
 * Lottie (LottieFiles, After Effects) : ils passent par le même lecteur.
 */

export type BuiltinLottie = 'confetti' | 'check' | 'sparkle' | 'pulse' | 'burst' | 'heart';

export const BUILTIN_LOTTIES: BuiltinLottie[] = ['confetti', 'check', 'sparkle', 'pulse', 'burst', 'heart'];

type Vec = number[];
type Rgba = [number, number, number, number];

const W = 512;
const C = W / 2;

function rgba(hex: string, alpha = 1): Rgba {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

const fixed = (k: number | Vec) => ({ a: 0, k });

/** Propriété animée : liste [image, valeur], courbe douce entre chaque clé. */
function anim(keys: [number, number | Vec][], ease: 'out' | 'inout' | 'linear' = 'out') {
  const curve = ease === 'linear' ? { o: [0, 0], i: [1, 1] } : ease === 'inout' ? { o: [0.42, 0], i: [0.58, 1] } : { o: [0.16, 1], i: [0.3, 1] };
  return {
    a: 1,
    k: keys.map(([t, v], idx) => ({
      t,
      s: Array.isArray(v) ? v : [v],
      ...(idx < keys.length - 1 ? { o: { x: [curve.o[0]], y: [curve.o[1]] }, i: { x: [curve.i[0]], y: [curve.i[1]] } } : {}),
    })),
  };
}

const transform = (extra: Record<string, unknown> = {}) => ({
  ty: 'tr',
  p: fixed([0, 0]),
  a: fixed([0, 0]),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
  sk: fixed(0),
  sa: fixed(0),
  ...extra,
});

const fill = (color: Rgba) => ({ ty: 'fl', c: fixed(color), o: fixed(100), r: 1 });
const stroke = (color: Rgba, width: number) => ({ ty: 'st', c: fixed(color), o: fixed(100), w: fixed(width), lc: 2, lj: 2 });
const path = (v: Vec[], closed = false, i?: Vec[], o?: Vec[]) => ({
  ty: 'sh',
  ks: fixed({ i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]), v, c: closed } as any),
});

function layer(ind: number, op: number, shapes: unknown[], ks: Record<string, unknown> = {}, ip = 0) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: `l${ind}`,
    sr: 1,
    ks: { o: fixed(100), r: fixed(0), p: fixed([C, C, 0]), a: fixed([0, 0, 0]), s: fixed([100, 100, 100]), ...ks },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

function root(name: string, op: number, layers: unknown[]) {
  return { v: '5.7.4', fr: 30, ip: 0, op, w: W, h: W, nm: name, ddd: 0, assets: [], layers };
}

/** PRNG déterministe : la même marque obtient les mêmes confettis. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function confetti(colors: string[]) {
  const r = prng(7);
  const op = 75;
  const layers = Array.from({ length: 64 }, (_, i) => {
    const angle = r() * Math.PI * 2;
    const dist = 110 + r() * 150;
    const x = C + Math.cos(angle) * dist;
    const y = C + Math.sin(angle) * dist * 0.75 - 40;
    const color = rgba(colors[i % colors.length]);
    const isRect = i % 3 !== 0;
    const shape = isRect
      ? { ty: 'rc', p: fixed([0, 0]), s: fixed([30 + r() * 14, 15 + r() * 7]), r: fixed(4), d: 1 }
      : { ty: 'el', p: fixed([0, 0]), s: fixed([22, 22]), d: 1 };
    return layer(i + 1, op, [{ ty: 'gr', it: [shape, fill(color), transform()] }], {
      p: anim([[0, [C, C + 20, 0]], [22, [x, y, 0]], [op, [x + (r() - 0.5) * 60, y + 160 + r() * 80, 0]]]),
      r: anim([[0, 0], [op, (r() - 0.5) * 720]], 'linear'),
      s: anim([[0, [0, 0, 100]], [8, [100, 100, 100]]]),
      o: anim([[0, 100], [op - 20, 100], [op, 0]], 'linear'),
    });
  });
  return root('confetti', op, layers);
}

function check(primary: string, accent: string, ink: string) {
  const op = 60;
  const circle = layer(2, op, [
    { ty: 'gr', it: [{ ty: 'el', p: fixed([0, 0]), s: fixed([300, 300]), d: 1 }, fill(rgba(primary)), transform()] },
  ], { s: anim([[0, [0, 0, 100]], [16, [100, 100, 100]]]) });
  const tick = layer(1, op, [
    {
      ty: 'gr',
      it: [
        path([[-70, 4], [-18, 56], [78, -52]]),
        stroke(rgba(ink), 30),
        { ty: 'tm', s: fixed(0), e: anim([[14, 0], [34, 100]], 'inout'), o: fixed(0), m: 1 },
        transform(),
      ],
    },
  ]);
  const rays = layer(3, op, Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return {
      ty: 'gr',
      it: [
        path([[Math.cos(a) * 175, Math.sin(a) * 175], [Math.cos(a) * 225, Math.sin(a) * 225]]),
        stroke(rgba(accent), 14),
        { ty: 'tm', s: anim([[30, 0], [44, 100]], 'out'), e: anim([[26, 0], [38, 100]], 'out'), o: fixed(0), m: 1 },
        transform(),
      ],
    };
  }));
  return root('check', op, [tick, circle, rays]);
}

const starPath = (r: number) => {
  const k = r * 0.18;
  return path([[0, -r], [k, -k], [r, 0], [k, k], [0, r], [-k, k], [-r, 0], [-k, -k]], true);
};

function sparkle(colors: string[]) {
  const op = 60;
  const spots: [number, number, number, number][] = [[0, 0, 120, 0], [-150, -110, 55, 10], [140, -130, 45, 18], [160, 120, 60, 6], [-140, 140, 40, 24]];
  return root('sparkle', op, spots.map(([x, y, size, delay], i) =>
    layer(i + 1, op, [{ ty: 'gr', it: [starPath(size), fill(rgba(colors[i % colors.length])), transform()] }], {
      p: fixed([C + x, C + y, 0]),
      s: anim([[delay, [0, 0, 100]], [delay + 14, [100, 100, 100]], [delay + 30, [70, 70, 100]], [Math.min(op, delay + 44), [0, 0, 100]]], 'inout'),
      r: anim([[delay, -30], [Math.min(op, delay + 44), 45]], 'linear'),
    })
  ));
}

function pulse(primary: string, accent: string) {
  const op = 60;
  const rings = [0, 15, 30].map((delay, i) =>
    layer(i + 2, op, [{ ty: 'gr', it: [{ ty: 'el', p: fixed([0, 0]), s: fixed([420, 420]), d: 1 }, stroke(rgba(primary), 10), transform()] }], {
      s: anim([[delay, [15, 15, 100]], [delay + 30, [100, 100, 100]]], 'out'),
      o: anim([[delay, 90], [delay + 30, 0]], 'linear'),
    })
  );
  const dot = layer(1, op, [{ ty: 'gr', it: [{ ty: 'el', p: fixed([0, 0]), s: fixed([120, 120]), d: 1 }, fill(rgba(accent)), transform()] }], {
    s: anim([[0, [100, 100, 100]], [15, [118, 118, 100]], [30, [100, 100, 100]], [45, [118, 118, 100]], [60, [100, 100, 100]]], 'inout'),
  });
  return root('pulse', op, [dot, ...rings]);
}

function burst(primary: string, accent: string) {
  const op = 50;
  const rays = layer(2, op, Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 2 === 0;
    return {
      ty: 'gr',
      it: [
        path([[Math.cos(a) * 90, Math.sin(a) * 90], [Math.cos(a) * (long ? 230 : 180), Math.sin(a) * (long ? 230 : 180)]]),
        stroke(rgba(long ? primary : accent), long ? 18 : 12),
        { ty: 'tm', s: anim([[10, 0], [30, 100]], 'out'), e: anim([[4, 0], [20, 100]], 'out'), o: fixed(0), m: 1 },
        transform(),
      ],
    };
  }));
  const core = layer(1, op, [{ ty: 'gr', it: [{ ty: 'el', p: fixed([0, 0]), s: fixed([150, 150]), d: 1 }, fill(rgba(primary)), transform()] }], {
    s: anim([[0, [0, 0, 100]], [10, [120, 120, 100]], [18, [95, 95, 100]], [24, [100, 100, 100]]], 'out'),
  });
  return root('burst', op, [core, rays]);
}

function heart(primary: string, accent: string) {
  const op = 60;
  // Cœur en courbes de Bézier (deux lobes et une pointe).
  const v: Vec[] = [[0, -60], [110, -40], [0, 130], [-110, -40]];
  const i: Vec[] = [[-40, -70], [20, -90], [70, 0], [-30, 80]];
  const o: Vec[] = [[40, -70], [-30, 80], [-70, 0], [-20, -90]];
  const shape = layer(1, op, [{ ty: 'gr', it: [path(v, true, i, o), fill(rgba(primary)), transform()] }], {
    s: anim([[0, [0, 0, 100]], [12, [115, 115, 100]], [20, [100, 100, 100]], [32, [112, 112, 100]], [40, [100, 100, 100]]], 'inout'),
  });
  const ring = layer(2, op, [{ ty: 'gr', it: [{ ty: 'el', p: fixed([0, 20]), s: fixed([380, 380]), d: 1 }, stroke(rgba(accent), 8), transform()] }], {
    s: anim([[10, [40, 40, 100]], [40, [110, 110, 100]]], 'out'),
    o: anim([[10, 100], [40, 0]], 'linear'),
  });
  return root('heart', op, [shape, ring]);
}

/** Une animation intégrée, aux couleurs de la marque. */
export function builtinLottie(name: BuiltinLottie, palette: { primary: string; accent: string; secondary: string; ink: string }): Record<string, unknown> {
  const colors = [palette.primary, palette.accent, palette.secondary];
  switch (name) {
    case 'confetti':
      return confetti(colors);
    case 'check':
      return check(palette.primary, palette.accent, '#ffffff');
    case 'sparkle':
      return sparkle([palette.accent, palette.primary, palette.secondary]);
    case 'pulse':
      return pulse(palette.primary, palette.accent);
    case 'burst':
      return burst(palette.primary, palette.accent);
    default:
      return heart(palette.primary, palette.accent);
  }
}

/** L'animation la plus parlante pour un objectif. */
export function lottieForObjective(objective: string, index = 0): BuiltinLottie {
  const byObjective: Record<string, BuiltinLottie[]> = {
    promotion: ['confetti', 'burst'],
    product: ['sparkle', 'check'],
    announce: ['burst', 'sparkle'],
    event: ['pulse', 'confetti'],
    opening: ['confetti', 'sparkle'],
    testimonial: ['heart', 'check'],
    recruitment: ['check', 'pulse'],
  };
  const list = byObjective[objective] || ['sparkle', 'check'];
  return list[index % list.length];
}
