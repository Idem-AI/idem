/**
 * `ts-node --transpile-only scripts/build-lottie-library.ts` — écrit la PETITE sélection d'animations Lottie internes
 * (`motion/lottie-library/`), dessinées ici en code pour IDEM (aucune licence tierce). Traits d'une seule couleur :
 * le moteur les recolore à la couleur de la marque au rendu (`assets/lottie.ts#recolorLottie`).
 *
 * Chaque animation se trace (trim path), tient, puis reste posée : un objet de scène, pas une boucle.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '../motion/lottie-library');
const FR = 30;
const INK = [0.12, 0.43, 0.29, 1];
type Pt = [number, number];

const ease = { o: { x: [0.3], y: [0] }, i: { x: [0.1], y: [1] } };
const anim = (frames: [number, number[]][]) => ({ a: 1, k: frames.map(([t, s], i) => (i < frames.length - 1 ? { t, s, ...ease } : { t, s })) });
const stat = (k: unknown) => ({ a: 0, k });

function path_(points: Pt[], closed = false, curves?: { i: Pt[]; o: Pt[] }) {
  return { ty: 'sh', ks: stat({ c: closed, v: points, i: curves?.i ?? points.map(() => [0, 0]), o: curves?.o ?? points.map(() => [0, 0]) }) };
}

/** Un groupe de traits qui se tracent de `from` à `to` (images). */
function strokeGroup(paths: ReturnType<typeof path_>[], width: number, from: number, to: number) {
  return {
    ty: 'gr',
    it: [
      ...paths,
      { ty: 'st', c: stat(INK), o: stat(100), w: stat(width), lc: 2, lj: 2 },
      { ty: 'tm', s: stat(0), e: anim([[from, [0]], [to, [100]]]), o: stat(0), m: 1 },
      { ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100) },
    ],
  };
}

function file(name: string, w: number, h: number, seconds: number, groups: unknown[], scale?: [number, [number, number][]]) {
  const op = Math.round(seconds * FR);
  return {
    v: '5.7.0',
    fr: FR,
    ip: 0,
    op,
    w,
    h,
    nm: name,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: name,
        sr: 1,
        ks: { o: stat(100), r: stat(0), p: stat([w / 2, h / 2, 0]), a: stat([w / 2, h / 2, 0]), s: scale ? anim(scale[1].map(([t, v]) => [t, [v, v, 100]])) : stat([100, 100, 100]) },
        ao: 0,
        shapes: groups,
        ip: 0,
        op,
        st: 0,
        bm: 0,
      },
    ],
  };
}

const C = 0.5523;
const circle = (cx: number, cy: number, r: number) =>
  path_(
    [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]],
    true,
    { i: [[-r * C, 0], [0, -r * C], [r * C, 0], [0, r * C]], o: [[r * C, 0], [0, r * C], [-r * C, 0], [0, -r * C]] }
  );

const library = [
  {
    id: 'check',
    note: 'a circle then a check mark drawing themselves (done, validated, success)',
    data: file('check', 400, 400, 1.6, [strokeGroup([path_([[128, 206], [178, 256], [276, 152]])], 26, 14, 30), strokeGroup([circle(200, 200, 150)], 18, 0, 20)], [0, [[30, 100], [36, 106], [44, 100]] as [number, number][]]),
  },
  {
    id: 'burst',
    note: 'eight short rays bursting outward from a center (highlight, new, celebration)',
    data: file(
      'burst',
      400,
      400,
      1.2,
      Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        const p = (r: number): Pt => [200 + Math.cos(a) * r, 200 + Math.sin(a) * r];
        // Le trait naît près du centre et file vers l'extérieur (début ET fin de la coupe animés).
        return {
          ty: 'gr',
          it: [
            path_([p(70), p(170)]),
            { ty: 'st', c: stat(INK), o: stat(100), w: stat(16), lc: 2, lj: 2 },
            { ty: 'tm', s: anim([[6, [0]], [24, [100]]]), e: anim([[0, [0]], [16, [100]]]), o: stat(0), m: 1 },
            { ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100) },
          ],
        };
      })
    ),
  },
  {
    id: 'arrow',
    note: 'a curved arrow drawing itself from left to right (pointing at something, next step)',
    data: file('arrow', 480, 240, 1.4, [
      strokeGroup([path_([[50, 170], [400, 110]], false, { i: [[0, 0], [-120, -60]], o: [[120, 40], [0, 0]] })], 18, 0, 22),
      strokeGroup([path_([[350, 70], [404, 110], [360, 160]])], 18, 18, 30),
    ]),
  },
  {
    id: 'underline',
    note: 'a hand-drawn wavy underline tracing itself (emphasis under a word)',
    data: file('underline', 600, 120, 1, [
      strokeGroup([path_([[30, 70], [200, 54], [380, 74], [570, 50]], false, { i: [[0, 0], [-60, -8], [-60, -6], [-60, 8]], o: [[60, -10], [60, 8], [60, 6], [0, 0]] })], 14, 0, 18),
    ]),
  },
];

fs.mkdirSync(DIR, { recursive: true });
for (const a of library) fs.writeFileSync(path.join(DIR, `${a.id}.json`), JSON.stringify(a.data));
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(library.map((a) => ({ id: a.id, note: a.note, file: `${a.id}.json` })), null, 2));
console.log(`${library.length} animations → ${DIR}`);
