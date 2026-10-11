/**
 * Addon PixiJS 7 + pixi-filters : une image, une pile de filtres, rendue à la demande.
 *
 * Aucune boucle : l'application est créée sans ticker (`autoStart: false`) et le kit donne à
 * chaque image les paramètres de l'instant ; `render` pose chaque filtre puis dessine une fois.
 * Tout ce qui varie dans le temps est une fonction de `lt` (secondes) ; le seul hasard — les
 * tranches du glitch — vient d'une graine par fenêtre de temps, jamais de Math.random.
 *
 * PixiJS 7 plutôt que 8 : son constructeur est synchrone (le moteur a besoin que la toile soit
 * prête au moment où la scène devient visible, sans attendre une promesse).
 */
import { Application, BaseTexture, Container, DisplacementFilter, Filter, Point, Rectangle, Sprite, Texture, WRAP_MODES } from 'pixi.js';
import { BulgePinchFilter, CRTFilter, GlitchFilter, PixelateFilter, RGBSplitFilter, ShockwaveFilter, TwistFilter, ZoomBlurFilter } from 'pixi-filters';
import { GlInstance, registerAddon } from '../shared';

/** Le bruit de déplacement de « wavy » : une texture lisse, tirée d'une fonction de la position (graine fixe). */
function noiseTexture(seed: number): Texture {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const h = (x: number, y: number) => {
    const v = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 0.5) * 43758.5453;
    return v - Math.floor(v);
  };
  const smooth = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const cc = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  };
  // Un bruit qui boucle : on lit une grille de période 8 cellules.
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const gx = (x / N) * 8;
      const gy = (y / N) * 8;
      const v = Math.floor(255 * (0.5 * smooth(gx % 8, gy % 8) + 0.5 * smooth((gx * 2) % 8, (gy * 2) % 8)));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = v;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = Texture.from(c);
  t.baseTexture.wrapMode = WRAP_MODES.REPEAT;
  return t;
}

interface Params {
  /** Secondes depuis l'entrée des éléments de la scène. */
  lt: number;
  /** Avancement 0 → 1 d'un effet « d'entrée » (pixelate). */
  p: number;
  /** Intensité de l'effet, en part de sa valeur de référence (1 = normal). */
  amount: number;
  /** Zoom lent de l'image (part de la taille, ex. 0,06 = 6 % sur la scène). */
  zoom: number;
  /** Durée de la scène, pour le zoom lent. */
  span: number;
}

interface Effect {
  filters: Filter[];
  /** Un objet qui doit être dans la scène sans se voir (la carte de déplacement). */
  attach?: Sprite;
  update(q: Params, w: number, h: number): void;
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const EFFECTS: Record<string, (w: number, h: number, seed: number) => Effect> = {
  /** Les canaux rouge et bleu se séparent, puis se rejoignent. */
  rgbSplit: () => {
    const f = new RGBSplitFilter([0, 0], [0, 0], [0, 0]);
    return {
      filters: [f],
      update(q, w) {
        const a = (w / 80) * q.amount * (0.35 + 0.65 * Math.abs(Math.sin(q.lt * 1.7)));
        f.red = [-a, 0];
        f.green = [0, a * 0.3];
        f.blue = [a, 0];
      },
    };
  },
  /** Une onde de choc part du centre, toutes les 1,8 s. */
  shockwave: (w, h) => {
    const f = new ShockwaveFilter([w / 2, h / 2], { amplitude: 38, wavelength: 190, brightness: 1.15, radius: Math.hypot(w, h) * 0.6 }, 0);
    return {
      filters: [f],
      update(q) {
        f.amplitude = 38 * q.amount;
        f.time = (q.lt % 1.8) * 0.9;
      },
    };
  },
  /** Le centre de l'image gonfle puis se creuse. */
  bulge: (w, h) => {
    const f = new BulgePinchFilter({ center: [0.5, 0.5], radius: Math.min(w, h) * 0.62, strength: 0 });
    return {
      filters: [f],
      update(q) {
        f.strength = 0.75 * q.amount * Math.sin(q.lt * 1.3);
      },
    };
  },
  /** L'image se tord autour de son centre. */
  twist: (w, h) => {
    const f = new TwistFilter({ radius: Math.min(w, h) * 0.55, angle: 0, padding: 20, offset: new Point(w / 2, h / 2) });
    return {
      filters: [f],
      update(q) {
        f.angle = 4.2 * q.amount * Math.sin(q.lt * 1.1);
      },
    };
  },
  /** Un flou de zoom qui respire : la vitesse d'un travelling. */
  zoomBlur: (w, h) => {
    const f = new ZoomBlurFilter({ strength: 0.15, center: [w / 2, h / 2], innerRadius: Math.min(w, h) * 0.18 });
    return {
      filters: [f],
      update(q) {
        f.strength = 0.2 * q.amount * (0.5 + 0.5 * Math.sin(q.lt * 1.4));
      },
    };
  },
  /** L'image se révèle : très pixelisée, puis nette (suit `p`). */
  pixelate: () => {
    const f = new PixelateFilter(48);
    return {
      filters: [f],
      update(q) {
        const k = Math.max(0, Math.min(1, q.p));
        f.size = Math.max(1, Math.round(1 + 46 * q.amount * Math.pow(1 - k, 2)));
      },
    };
  },
  /** Des tranches décalées par à-coups (une fenêtre de graine tous les 0,12 s). */
  glitch: (w, h, seed) => {
    const f = new GlitchFilter({ slices: 9, offset: 36, direction: 0, fillMode: 2, seed: 0.5, average: false, red: [-6, 0], green: [0, 0], blue: [6, 0] });
    return {
      filters: [f],
      update(q) {
        const burst = (q.lt * 0.9 + seed * 0.37) % 1 < 0.2;
        f.offset = burst ? 48 * q.amount : 0;
        f.red = burst ? [-10 * q.amount, 0] : [0, 0];
        f.blue = burst ? [10 * q.amount, 0] : [0, 0];
        f.seed = hash(Math.floor(q.lt * 8) + seed);
      },
    };
  },
  /** Une ondulation liquide : l'image est déplacée par un bruit qui dérive. */
  wavy: (w, h, seed) => {
    const tex = noiseTexture(seed);
    const map = new Sprite(tex);
    map.scale.set(Math.max(w, h) / 128 * 1.6);
    map.renderable = false;
    const f = new DisplacementFilter(map, 0);
    return {
      filters: [f],
      attach: map,
      update(q) {
        f.scale.set(34 * q.amount, 34 * q.amount);
        map.position.set(q.lt * 24, q.lt * 14);
      },
    };
  },
  /** Un vieux téléviseur : lignes, bruit, courbure. */
  crt: () => {
    const f = new CRTFilter({ curvature: 2.6, lineWidth: 2.4, lineContrast: 0.22, noise: 0.16, noiseSize: 1.4, vignetting: 0.28, vignettingAlpha: 0.7, vignettingBlur: 0.4, time: 0, seed: 0.3 });
    return {
      filters: [f],
      update(q) {
        f.time = q.lt * 8;
        f.seed = hash(Math.floor(q.lt * 12));
      },
    };
  },
};

registerAddon('pixi', {
  effects: Object.keys(EFFECTS),
  create(canvas, opts): GlInstance | null {
    const make = EFFECTS[opts.effect];
    if (!make) return null;
    const { width: w, height: h, image } = opts;
    const app = new Application({ view: canvas, width: w, height: h, backgroundAlpha: 0, antialias: false, autoStart: false, resolution: 1, preserveDrawingBuffer: true, clearBeforeRender: true });
    app.ticker.stop();
    canvas.style.width = '';
    canvas.style.height = '';
    const texture = new Texture(new BaseTexture(image));
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    // « cover » : l'image remplit la toile sans se déformer.
    const base = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const root = new Container();
    root.filterArea = new Rectangle(0, 0, w, h);
    root.addChild(sprite);
    const effect = make(w, h, opts.seed);
    root.filters = effect.filters;
    app.stage.addChild(root);
    if (effect.attach) app.stage.addChild(effect.attach);
    return {
      render(params) {
        const q = params as Params;
        const grow = 1 + q.zoom * Math.min(1, q.lt / Math.max(1, q.span));
        sprite.position.set(w / 2, h / 2);
        sprite.scale.set(base * grow);
        effect.update(q, w, h);
        app.render();
      },
      dispose() {
        try {
          app.destroy(false, { children: true, texture: true, baseTexture: true });
        } catch {
          /* le contexte est déjà perdu */
        }
        (canvas.getContext('webgl2') || canvas.getContext('webgl'))?.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  },
});
