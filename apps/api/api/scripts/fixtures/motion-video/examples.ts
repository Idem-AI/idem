/**
 * EXEMPLES PAR TYPE DE MOTION — un cas complet pour chacun des 8 types.
 *
 * Médias réels : photos et vidéos Pexels (recherche réelle), un modèle 3D GLB
 * « importé » (une bouteille fabriquée avec three.js puis exportée), une
 * animation Lottie « importée » écrite à la main, un clip vidéo « importé »
 * (téléchargé sur Pexels). Musique et effets sonores viennent des vraies
 * banques (Openverse, ccMixter, Freesound via Openverse).
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { VideoBrief, VideoScope, VideoType } from '../../../models/motionVideo.model';

export interface ExampleCase {
  id: string;
  type: VideoType;
  brandId: string;
  brief: VideoBrief;
  scope: VideoScope;
  /** Fichiers « importés » par l'utilisateur (clés de `prepareImports`). */
  imports?: ('photo:bottle-1' | 'photo:bottle-2' | 'photo:pagne-1' | 'photo:pagne-2' | 'photo:pagne-3' | 'glb:bottle' | 'lottie:stars' | 'clip:market')[];
  /** Réponses du « petit modèle » simulé, par clé de case. */
  answers: Record<string, string | string[]>;
}

export const EXAMPLES: ExampleCase[] = [
  {
    id: '1-kinetic-kofi',
    type: 'kinetic',
    brandId: 'kofi',
    scope: { durationSec: 15, formats: ['story'], quality: 'hd' },
    brief: {
      objective: 'recruitment',
      message: 'We are hiring two junior developers in Accra',
      details: 'Full remote possible, mentoring by senior engineers, 12 developers already on the team. Apply at kofitech.africa.',
      musicMood: 'upbeat',
      style: 'auto',
      language: 'en',
      allowStock: true,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      kicker: 'We’re hiring',
      title: ['Code that matters', 'Grow with us'],
      l1: ['Build', 'Learn'],
      l2: ['Ship', 'Grow'],
      l3: ['Learn', 'Lead'],
      l4: ['Join Kofi Tech', 'Your next chapter'],
      lead: 'At Kofi Tech it’s',
      w1: 'Remote',
      w2: 'Mentoring',
      w3: 'Impact',
      sub: 'Real products for African SMEs',
      b1: 'Full remote possible',
      b2: 'Mentoring by seniors',
      b3: '12 developers already',
      action: 'Apply now',
      contact: 'kofitech.africa',
      tagline: 'Software for African SMEs',
    },
  },
  {
    id: '2-product-bissap',
    type: 'product',
    brandId: 'bissap',
    imports: ['photo:bottle-1', 'photo:bottle-2'],
    scope: { durationSec: 15, formats: ['square'], quality: 'hd' },
    brief: {
      objective: 'product',
      message: 'Notre nouveau jus de bissap au gingembre, sans sucre ajouté',
      details: 'La bouteille de 50 cl à 1 000 F. Pressé chaque matin à Dakar.',
      musicMood: 'calm',
      style: 'auto',
      language: 'fr',
      allowStock: true,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      visual: 'hibiscus juice bottle',
      kicker: 'Nouveau',
      title: ['Le bissap qui réveille', 'Pressé ce matin'],
      name: ['Bissap gingembre', 'Bissap nature'],
      tagline: ['Pressé chaque matin à Dakar', 'Frais, local, sans sucre'],
      price: '1 000 F',
      b1: 'Sans sucre ajouté',
      b2: 'Pressé à Dakar',
      b3: 'Bouteille de 50 cl',
      caption: 'Nos jus du matin',
      sub: 'Des fruits choisis un à un',
      action: 'Commandez-le',
    },
  },
  {
    id: '3-promo-wax',
    type: 'promo',
    brandId: 'wax',
    scope: { durationSec: 15, formats: ['story'], quality: 'hd' },
    brief: {
      objective: 'promotion',
      message: 'Les soldes de fin d’année chez Wax & Co : -30 % sur tous les pagnes',
      details: 'Pagne wax premium à 15 000 FCFA au lieu de 21 500 FCFA. Livraison 24h à Abidjan. Offre valable jusqu’au 31 décembre. Commandez sur WhatsApp au +225 07 08 09 10 11.',
      musicMood: 'afro',
      style: 'auto',
      language: 'fr',
      allowStock: true,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      visual: 'african wax fabric',
      kicker: 'Soldes',
      title: 'Vos pagnes à prix doux',
      oldPrice: '21 500 FCFA',
      price: '15 000 FCFA',
      badge: '-30 %',
      note: 'Jusqu’au 31 décembre',
      name: 'Pagne wax premium',
      tagline: 'Des motifs qui racontent votre histoire',
      b1: 'Livraison 24h à Abidjan',
      b2: 'Paiement Mobile Money',
      b3: 'Retour gratuit',
      action: 'Commandez sur WhatsApp',
      contact: '+225 07 08 09 10 11',
    },
  },
  {
    id: '4-footage-mama',
    type: 'footage',
    brandId: 'mama',
    imports: ['clip:market'],
    scope: { durationSec: 15, formats: ['story'], quality: 'standard' },
    brief: {
      objective: 'event',
      message: 'Soirée dégustation samedi 12 octobre à 19h chez Mama Afia',
      details: 'Au menu : kelewele, attiéké poisson, jus de baobab. Entrée libre, au Boulevard du 13 Janvier à Lomé.',
      musicMood: 'afro',
      style: 'auto',
      language: 'fr',
      allowStock: true,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      visual: 'african street food cooking',
      kicker: ['Soirée dégustation', 'Au menu'],
      title: ['Venez goûter la cuisine de Mama', 'Des plats faits maison', 'On vous attend'],
      sub: ['Samedi 12 octobre, 19h', 'Kelewele, attiéké poisson', 'Entrée libre'],
      date: 'Samedi 12 octobre',
      time: '19h',
      place: 'Boulevard du 13 Janvier, Lomé',
      b1: 'Entrée libre',
      b2: 'Cuisine maison',
      b3: 'Ambiance familiale',
      action: 'Réservez votre table',
    },
  },
  {
    id: '5-showcase3d-bissap',
    type: 'showcase3d',
    brandId: 'bissap',
    imports: ['glb:bottle', 'photo:bottle-1', 'photo:bottle-2'],
    scope: { durationSec: 15, formats: ['portrait'], quality: 'standard' },
    brief: {
      objective: 'product',
      message: 'Découvrez la nouvelle bouteille Bissap Délices',
      details: 'Verre recyclable, 50 cl, pressé à Dakar. 1 000 F la bouteille.',
      musicMood: 'epic',
      style: 'auto',
      language: 'fr',
      allowStock: false,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      kicker: 'Nouveau',
      title: ['La nouvelle bouteille', 'Vue sous tous les angles', 'Nos jus en images'],
      sub: ['Verre recyclable, 50 cl', 'Pressé chaque matin à Dakar'],
      name: 'Bissap Délices',
      price: '1 000 F',
      b1: 'Verre recyclable',
      b2: 'Pressé à Dakar',
      b3: 'Sans sucre ajouté',
      action: 'Goûtez-la',
      tagline: 'Pressé chaque matin',
    },
  },
  {
    id: '6-illustrated-wax',
    type: 'illustrated',
    brandId: 'wax',
    imports: ['lottie:stars'],
    scope: { durationSec: 15, formats: ['story'], quality: 'standard' },
    brief: {
      objective: 'opening',
      message: 'Ouverture de notre deuxième boutique à Cocody le samedi 5 novembre',
      details: 'Rue des Jardins, Cocody. Plus de 2 000 clients nous font déjà confiance.',
      musicMood: 'upbeat',
      style: 'auto',
      language: 'fr',
      allowStock: false,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      kicker: 'Grande ouverture',
      title: ['Une nouvelle boutique', '2 000 clients ravis', 'On vous attend'],
      sub: ['Rue des Jardins, Cocody', 'Merci pour votre confiance'],
      date: 'Samedi 5 novembre',
      place: 'Rue des Jardins, Cocody',
      b1: 'Plus grande',
      b2: 'Plus de choix',
      b3: 'Même qualité',
      lead: 'Chez Wax & Co',
      w1: 'Couleurs',
      w2: 'Qualité',
      w3: 'Fierté',
      action: 'Venez nous voir',
    },
  },
  {
    id: '7-slideshow-mama',
    type: 'slideshow',
    brandId: 'mama',
    scope: { durationSec: 15, formats: ['landscape'], quality: 'standard' },
    brief: {
      objective: 'announce',
      message: 'Chez Mama Afia, la cuisine ghanéenne et ivoirienne arrive à Lomé',
      details: 'Plats maison, produits du marché, ouvert tous les jours de 11h à 23h.',
      musicMood: 'afro',
      style: 'auto',
      language: 'fr',
      allowStock: true,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      visual: 'west african food dishes',
      kicker: 'Nouveau à Lomé',
      title: ['La cuisine de Mama', 'Fait maison, chaque jour'],
      caption: ['Nos plats du jour', 'Produits du marché'],
      name: 'Plats maison',
      tagline: 'Ouvert tous les jours de 11h à 23h',
      sub: 'Ghana et Côte d’Ivoire dans l’assiette',
      action: 'Venez goûter',
    },
  },
  {
    id: '8-logo-wax',
    type: 'logo',
    brandId: 'wax',
    scope: { durationSec: 6, formats: ['square'], quality: 'hd' },
    brief: {
      objective: 'announce',
      message: 'Wax & Co, le wax authentique',
      musicMood: 'epic',
      style: 'auto',
      language: 'fr',
      allowStock: false,
      allowGenerate: false,
      sfx: true,
    },
    answers: {
      l1: 'Authentique',
      l2: 'Coloré',
      l3: 'Fier',
      l4: 'Wax & Co',
      tagline: 'Le wax authentique',
    },
  },
];

/** Cas facultatif (`--generate`) : rien d'importé, Pexels coupé → photos et clips générés (GLM-Image, CogVideoX-3), voix off. */
export const GENERATED_EXAMPLE: ExampleCase = {
  id: '9-footage-generated-bissap',
  type: 'footage',
  brandId: 'bissap',
  scope: { durationSec: 15, formats: ['story'], quality: 'standard' },
  brief: {
    objective: 'product',
    message: 'Le jus de bissap pressé chaque matin à Dakar',
    details: 'Sans sucre ajouté, 1 000 F la bouteille.',
    musicMood: 'calm',
    style: 'auto',
    language: 'fr',
    allowStock: false,
    allowGenerate: true,
    sfx: true,
    // Voix off en français : dite par le repli (GLM-TTS ne parle que chinois et anglais).
    voice: true,
  },
  answers: {
    visual: 'fresh red hibiscus juice poured into a glass bottle on a wooden table, morning light',
    title: ['Pressé chaque matin', 'Sans sucre ajouté', 'Goûtez la fraîcheur'],
    sub: ['À Dakar, depuis 2019', 'Juste des fleurs d’hibiscus'],
    name: 'Bissap Délices',
    price: '1 000 F',
    action: 'Commandez',
  },
};

// ─── Fichiers « importés » ──────────────────────────────────────────────────

/** Animation Lottie écrite à la main : cinq étoiles d'avis qui apparaissent l'une après l'autre. */
export function starsLottie(color = '#f2a93b'): Record<string, unknown> {
  const hex = color.replace('#', '');
  const c = [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, 1];
  const star = (r: number) => {
    const v: number[][] = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      v.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    return { ty: 'sh', ks: { a: 0, k: { i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), v, c: true } } };
  };
  const layers = [0, 1, 2, 3, 4].map((i) => ({
    ddd: 0,
    ind: i + 1,
    ty: 4,
    nm: `star${i}`,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: [{ t: i * 6, s: [-40], o: { x: [0.2], y: [1] }, i: { x: [0.3], y: [1] } }, { t: i * 6 + 14, s: [0] }] },
      p: { a: 0, k: [56 + i * 100, 256, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: i * 6, s: [0, 0, 100], o: { x: [0.2], y: [1] }, i: { x: [0.3], y: [1.4] } },
          { t: i * 6 + 12, s: [120, 120, 100], o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } },
          { t: i * 6 + 18, s: [100, 100, 100] },
        ],
      },
    },
    ao: 0,
    shapes: [{ ty: 'gr', it: [star(42), { ty: 'fl', c: { a: 0, k: c }, o: { a: 0, k: 100 }, r: 1 }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }],
    ip: 0,
    op: 60,
    st: 0,
    bm: 0,
  }));
  return { v: '5.7.4', fr: 30, ip: 0, op: 60, w: 512, h: 512, nm: 'stars', ddd: 0, assets: [], layers };
}

/**
 * Modèle 3D GLB : une bouteille (corps tourné, étiquette, bouchon) aux couleurs
 * de la marque, construite avec three.js dans Chromium puis exportée en GLB.
 */
export async function makeBottleGlb(file: string, colors: { glass: string; label: string; cap: string }): Promise<void> {
  if (fs.existsSync(file)) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  const bundle = await esbuild.build({
    stdin: {
      contents: "import * as THREE from 'three'; import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'; window.THREE = THREE; window.GLTFExporter = GLTFExporter;",
      resolveDir: path.resolve(path.dirname(require.resolve('three')), '..'),
    },
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    logLevel: 'error',
  });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.setContent(`<script>${bundle.outputFiles[0].text}</script>`);
    const base64: string = await page.evaluate((c: any) => {
      const T = (window as any).THREE;
      const scene = new T.Scene();
      const profile = [[0, 0], [0.42, 0], [0.46, 0.05], [0.46, 1.25], [0.4, 1.45], [0.2, 1.62], [0.16, 1.85], [0.16, 2.0]].map((p: number[]) => new T.Vector2(p[0], p[1]));
      const body = new T.Mesh(new T.LatheGeometry(profile, 64), new T.MeshStandardMaterial({ color: c.glass, roughness: 0.15, metalness: 0.05 }));
      const label = new T.Mesh(new T.CylinderGeometry(0.47, 0.47, 0.6, 64, 1, true), new T.MeshStandardMaterial({ color: c.label, roughness: 0.6, side: T.DoubleSide }));
      label.position.y = 0.7;
      const cap = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.18, 48), new T.MeshStandardMaterial({ color: c.cap, roughness: 0.4, metalness: 0.3 }));
      cap.position.y = 2.06;
      scene.add(body, label, cap);
      return new Promise<string>((resolve, reject) => {
        new (window as any).GLTFExporter().parse(
          scene,
          (glb: ArrayBuffer) => {
            const bytes = new Uint8Array(glb);
            let s = '';
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
            resolve(btoa(s));
          },
          reject,
          { binary: true }
        );
      });
    }, colors);
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
  }
}
