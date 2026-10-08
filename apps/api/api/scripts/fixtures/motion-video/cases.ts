/**
 * Cas de test des vidéos motion design — et les RÉPONSES DE MODÈLE écrites à la
 * main qui les accompagnent (aucun crédit GLM nécessaire).
 *
 * Plutôt qu'un texte figé (les numéros de cases dépendent de la recette), chaque
 * cas fournit un DICTIONNAIRE de réponses par case, et un « simulateur » qui
 * répond au prompt réel comme le ferait un petit modèle — proprement, en
 * désordre, en JSON, en inventant un prix, ou pas du tout. Le pipeline est donc
 * exercé exactement comme en production, prompt compris.
 */
import { VideoBrief, VideoScope } from '../../../models/motionVideo.model';

export type ModelBehaviour =
  /** Une ligne par case, propre. */
  | 'clean'
  /** Puces, gras, guillemets, emoji, préambule, lignes trop longues, clés inconnues. */
  | 'messy'
  /** Répond en JSON malgré la consigne. */
  | 'json'
  /** Invente un prix et un numéro absents du brief. */
  | 'hallucinate'
  /** Réponse vide : la copie heuristique doit prendre le relais. */
  | 'empty'
  /** Le fournisseur est en panne (pas de crédits GLM). */
  | 'down';

export interface VideoCase {
  id: string;
  brandId: string;
  brief: VideoBrief;
  scope: VideoScope;
  behaviour: ModelBehaviour;
  /** Réponses par clé de case ; un tableau est consommé dans l'ordre (scènes répétées). */
  answers: Record<string, string | string[]>;
  /** Photos du commerce (fichiers générés par `media.ts`). */
  photos?: string[];
  /** Rendu MP4 complet dans le contrôle par défaut. */
  render?: boolean;
}

export const CASES: VideoCase[] = [
  {
    id: 'wax-soldes-story',
    brandId: 'wax',
    behaviour: 'clean',
    render: true,
    photos: ['pagne-1', 'pagne-2', 'pagne-3'],
    scope: { durationSec: 15, formats: ['story'], quality: 'hd' },
    brief: {
      objective: 'promotion',
      message: 'Les soldes de fin d’année chez Wax & Co : -30 % sur tous les pagnes',
      details:
        'Pagne wax premium à 15 000 FCFA au lieu de 21 500 FCFA. Livraison 24h à Abidjan, paiement Mobile Money, retour gratuit. Offre valable jusqu’au 31 décembre. Commandez sur WhatsApp au +225 07 08 09 10 11.',
      musicMood: 'afro',
      style: 'auto',
      language: 'fr',
    },
    answers: {
      kicker: 'Soldes de fin d’année',
      title: ['Vos pagnes à prix doux', 'Pourquoi Wax & Co'],
      name: 'Pagne wax premium',
      tagline: 'Des motifs qui racontent votre histoire',
      price: ['15 000 FCFA', '15 000 FCFA'],
      oldPrice: '21 500 FCFA',
      badge: '-30 %',
      note: 'Jusqu’au 31 décembre',
      b1: 'Livraison 24h à Abidjan',
      b2: 'Paiement Mobile Money',
      b3: 'Retour gratuit',
      action: 'Commandez sur WhatsApp',
      contact: '+225 07 08 09 10 11',
      tagline_logo: 'Le wax authentique',
      lead: 'Chez Wax & Co',
      w1: 'Couleurs',
      w2: 'Qualité',
      w3: 'Style',
      sub: 'Des pagnes choisis un à un',
      caption: 'La collection de fin d’année',
    },
  },
  {
    id: 'bissap-produit-square',
    brandId: 'bissap',
    behaviour: 'messy',
    render: true,
    photos: ['bottle-1', 'bottle-2'],
    scope: { durationSec: 6, formats: ['square'], quality: 'standard' },
    brief: {
      objective: 'product',
      message: 'Notre nouveau jus de bissap au gingembre, sans sucre ajouté',
      details: 'La bouteille de 50 cl à 1 000 F. Pressé chaque matin à Dakar.',
      musicMood: 'calm',
      style: 'premium',
      language: 'fr',
    },
    answers: {
      kicker: 'Nouveau',
      title: 'Le bissap qui réveille vraiment toutes vos papilles dès la première gorgée du matin',
      name: 'Bissap gingembre',
      tagline: 'Pressé chaque matin à Dakar',
      price: '1 000 F',
      b1: 'Sans sucre ajouté',
      b2: 'Pressé à Dakar',
      b3: 'Bouteille 50 cl',
      action: 'Goûtez-le',
    },
  },
  {
    id: 'kofi-recrutement-landscape',
    brandId: 'kofi',
    behaviour: 'json',
    render: true,
    scope: { durationSec: 15, formats: ['landscape', 'portrait'], quality: 'standard' },
    brief: {
      objective: 'recruitment',
      message: 'We are hiring two junior developers in Accra',
      details:
        'Full remote possible, mentoring by senior engineers, 12 developers already on the team. Apply at kofitech.africa before November 30.',
      musicMood: 'corporate',
      style: 'auto',
      language: 'en',
    },
    answers: {
      kicker: 'We’re hiring',
      title: ['Two junior developers wanted', 'Build software that matters'],
      sub: 'Join a team shipping for African SMEs',
      b1: 'Full remote possible',
      b2: 'Mentoring by seniors',
      b3: 'Real products, real users',
      value: '12',
      label: 'developers already on the team',
      lead: 'At Kofi Tech it’s',
      w1: 'Remote',
      w2: 'Growth',
      w3: 'Impact',
      action: 'Apply now',
      contact: 'kofitech.africa',
      caption: 'Our team in Accra',
    },
  },
  {
    id: 'mama-evenement-story',
    brandId: 'mama',
    behaviour: 'hallucinate',
    render: false,
    photos: ['dish-1'],
    scope: { durationSec: 30, formats: ['story'], quality: 'hd' },
    brief: {
      objective: 'event',
      message: 'Soirée dégustation samedi 12 octobre à 19h chez Mama Afia',
      details: 'Au menu : kelewele, attiéké poisson, jus de baobab. Entrée libre, au Boulevard du 13 Janvier à Lomé.',
      musicMood: 'afro',
      style: 'playful',
      language: 'fr',
    },
    answers: {
      kicker: 'Soirée dégustation',
      title: ['Venez goûter la cuisine de Mama', 'Une soirée de saveurs'],
      date: 'Samedi 12 octobre',
      time: '19h',
      place: 'Boulevard du 13 Janvier, Lomé',
      sub: 'Kelewele, attiéké poisson, jus de baobab',
      b1: 'Entrée libre',
      b2: 'Cuisine maison',
      b3: 'Ambiance familiale',
      action: 'Réservez votre table',
      caption: 'Les plats de la soirée',
    },
  },
  {
    id: 'wax-ouverture-sans-modele',
    brandId: 'wax',
    behaviour: 'down',
    render: false,
    scope: { durationSec: 60, formats: ['story', 'square'], quality: 'premium' },
    brief: {
      objective: 'opening',
      message: 'Ouverture de notre deuxième boutique à Cocody le samedi 5 novembre',
      details: 'Rue des Jardins, Cocody. -20 % sur toute la boutique le jour de l’ouverture. Plus de 2 000 clients nous font déjà confiance.',
      musicMood: 'upbeat',
      style: 'energetic',
      language: 'fr',
    },
    answers: {},
  },
  {
    id: 'bissap-avis-empty',
    brandId: 'bissap',
    behaviour: 'empty',
    render: false,
    scope: { durationSec: 15, formats: ['portrait'], quality: 'hd' },
    brief: {
      objective: 'testimonial',
      message: 'Ce que nos clients disent de nos jus',
      details: '« Le meilleur bissap de Dakar, frais et pas trop sucré » — Awa Diop. Plus de 500 clients fidèles chaque mois.',
      musicMood: 'none',
      style: 'auto',
      language: 'fr',
    },
    answers: {},
  },
];

// ─── Le simulateur de petit modèle ──────────────────────────────────────────

const LINE = /^(\d+)\.([a-zA-Z0-9]+) \(max (\d+)/;

/** Répond au prompt réel (cases demandées dans `user`) selon le comportement du cas. */
/**
 * Le DIRECTEUR du film d'auteur (cran Ultra) : un film écrit comme par un bon modèle, à partir
 * des réponses du cas (textes déjà fondés sur le brief), au format demandé par le prompt.
 */
export function simulateDirector(testCase: VideoCase, system: string, user: string): string {
  const range = system.match(/(\d+) to (\d+) shots, total EXACTLY ([\d.]+) s/);
  const [min, max, total] = range ? [Number(range[1]), Number(range[2]), Number(range[3])] : [3, 5, 15];
  const a = testCase.answers;
  const first = (k: string) => (Array.isArray(a[k]) ? (a[k] as string[])[0] : (a[k] as string | undefined));
  const second = (k: string) => (Array.isArray(a[k]) ? (a[k] as string[])[1] : undefined);
  const photo = /MEDIA: #1/.test(user) ? '1' : 'none';
  const body: string[][] = [
    [`TITLE: ${first('title') || testCase.brief.message.slice(0, 55)}`, first('kicker') ? `SUB: ${first('kicker')}` : '', 'VISUAL: A brand-colour block sweeps in from the left; the title rises word by word; photo #1 is framed on the right with a slow parallax.', `MEDIA: ${photo}`, 'HANDOFF: the block widens to fill the frame and becomes the next background.'],
    [`TITLE: ${[first('name'), first('price')].filter(Boolean).join(' à ') || first('l1') || first('b1') || testCase.brief.message.slice(0, 55)}`, first('oldPrice') ? `SUB: au lieu de ${first('oldPrice')}` : '', 'VISUAL: The price lands like a stamp; a hand-drawn circle wraps it; the old price is struck through.', 'MEDIA: none', 'HANDOFF: a wipe in the accent colour.'],
    [`TITLE: ${first('b1') || second('title') || testCase.brief.message.slice(0, 55)}`, first('b2') ? `SUB: ${first('b2')}` : '', 'VISUAL: Three flat 3D cubes stack in rhythm with the beat, each benefit appearing beside its cube.', 'MEDIA: none', 'HANDOFF: zoom through the last cube.'],
  ];
  if (first('action')) body.push([`TITLE: ${second('title') || first('title') || testCase.brief.message.slice(0, 55)}`, `ACTION: ${first('action')}`, first('contact') ? `CONTACT: ${first('contact')}` : '', 'VISUAL: A clean card with the call to action as a pulsing button.', 'MEDIA: none', 'HANDOFF: cut to the logo.']);
  const count = Math.max(min - 1, Math.min(max - 1, body.length));
  const shots = body.slice(0, count);
  const each = (total - 2.6) / shots.length;
  const out = ['FILM: Les soldes qui racontent une histoire', 'CONCEPT: The price drop told as a celebration of the fabric.', 'BIBLE: Bold kinetic type that lands on the beat; one brand colour per shot; hand-drawn accents as signature.'];
  shots.forEach((lines, i) => out.push(`SHOT ${i + 1} | ${each.toFixed(1)}s | surface: ${i % 2 ? 'light' : 'primary'}`, ...lines.filter(Boolean)));
  out.push(`SHOT ${shots.length + 1} | 2.6s | surface: light`, 'SIGNATURE: yes', first('tagline_logo') || first('tagline') ? `TAGLINE: ${first('tagline_logo') || first('tagline')}` : '', 'VISUAL: The logo draws itself in the centre.');
  return out.filter(Boolean).join('\n');
}

/**
 * Le STRATÈGE (dès Medium) : il choisit réellement — le deuxième concept du menu (pas la
 * recommandation du code), des scènes du menu, un grand moment et un rythme.
 */
export function simulateStrategist(system: string, user: string): string {
  const between = (from: string, to?: string) => {
    const a = user.indexOf(from);
    if (a < 0) return [] as string[];
    const b = to ? user.indexOf(to, a + from.length) : -1;
    return user.slice(a + from.length, b > 0 ? b : undefined).split('\n').map((l) => l.match(/^([A-Za-z0-9]+):/)?.[1]).filter(Boolean) as string[];
  };
  const concepts = between('CONCEPTS:', 'SCENES:');
  const scenes = between('SCENES:', 'TECHNIQUES:').filter((id) => id !== 'logo');
  const range = system.match(/scenes: (\d+) to (\d+) ids/);
  const want = range ? Math.max(Number(range[1]), Math.min(Number(range[2]), 5)) : 4;
  const picked = [...scenes.slice(0, want - 1), 'logo'];
  const rhythms = system.match(/rhythm: one of ([a-z |]+)/)?.[1].split('|').map((r) => r.trim()) || [];
  return [`concept: ${concepts[1] || concepts[0] || ''}`, `scenes: ${picked.join(', ')}`, 'accent: 2', rhythms[1] ? `rhythm: ${rhythms[1]}` : ''].filter(Boolean).join('\n');
}

export function simulateModel(testCase: VideoCase): (system: string, user: string) => Promise<string> {
  return async (_system, user) => {
    if (testCase.behaviour === 'down') throw new Error('GLM: insufficient balance (simulated)');
    if (testCase.behaviour === 'empty') return '';
    if (/creative director AND author/.test(_system)) return simulateDirector(testCase, _system, user);
    if (/creative director of a short brand video/.test(_system)) return simulateStrategist(_system, user);

    const cursors: Record<string, number> = {};
    const requested = user
      .split('\n')
      .map((l) => l.match(LINE))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ index: Number(m[1]), key: m[2], max: Number(m[3]) }));

    // Le dernier `tagline` (signature) a sa propre réponse.
    const lastIndex = Math.max(...requested.map((r) => r.index));
    const pick = (key: string, index: number): string | undefined => {
      const k = key === 'tagline' && index === lastIndex && testCase.answers.tagline_logo ? 'tagline_logo' : key;
      const value = testCase.answers[k];
      if (value === undefined) return undefined;
      if (!Array.isArray(value)) return value;
      const i = cursors[k] ?? 0;
      cursors[k] = i + 1;
      return value[Math.min(i, value.length - 1)];
    };

    const pairs = requested
      .map((r) => ({ ...r, text: pick(r.key, r.index) }))
      .filter((p): p is { index: number; key: string; max: number; text: string } => !!p.text);

    switch (testCase.behaviour) {
      case 'json':
        return JSON.stringify(Object.fromEntries(pairs.map((p) => [`${p.index}.${p.key}`, p.text])), null, 1);
      case 'messy':
        return [
          'Voici les textes demandés pour votre vidéo :',
          '',
          ...pairs.map((p, i) =>
            i % 3 === 0
              ? `- **${p.index}.${p.key}**: "${p.text}" ✨`
              : i % 3 === 1
                ? `${p.index}. ${p.key} (max ${p.max}) – « ${p.text} »`
                : `* ${p.index}.${p.key} = ${p.text} #promo`
          ),
          '99.unknown: ligne parasite',
          'J’espère que cela vous convient !',
        ].join('\n');
      case 'hallucinate':
        return [
          ...pairs.map((p) => `${p.index}.${p.key}: ${p.text}`),
          // Inventions : aucun prix ni numéro dans le brief.
          ...requested.filter((r) => r.key === 'price').map((r) => `${r.index}.price: 5 000 FCFA`),
          ...requested.filter((r) => r.key === 'contact').map((r) => `${r.index}.contact: +228 90 00 00 00`),
        ].join('\n');
      default:
        return pairs.map((p) => `${p.index}.${p.key}: ${p.text}`).join('\n');
    }
  };
}

/**
 * Les agents de la vidéo (directeur artistique, animateur, sound designer, critique), simulés
 * avec le même comportement que la copie : ils choisissent par lettre dans leurs menus, ou
 * répondent en désordre, en JSON, inventent, se taisent ou tombent en panne.
 */
export async function simulateAgent(behaviour: ModelBehaviour, system: string, user: string): Promise<string> {
  if (behaviour === 'down') throw new Error('GLM: insufficient balance (simulated)');
  if (behaviour === 'empty') return '';
  const options = user.split('\n').filter((l) => /^[a-p]\) /.test(l)).length;
  if (/art director/i.test(system)) {
    const letter = options > 1 ? 'b' : 'a';
    const text = user.match(/TEXT: "([^"]+)"/)?.[1] || '';
    const word = [...text.split(/\s+/)].sort((a, b) => b.length - a.length)[0] || '';
    if (behaviour === 'json') return JSON.stringify({ layout: letter, word });
    if (behaviour === 'messy') return `Sure! Here is my choice:\n- **Layout**: ${letter.toUpperCase()})\n- **Word**: "${word}" ✨`;
    if (behaviour === 'hallucinate') return 'layout: hologram3d\nword: banane';
    // Cran Max : les réglages bornés (taille, tempo, décor) quand le prompt les demande.
    const tuning = /scale/i.test(system) ? '\nscale: 1.15\ntempo: lively\ndecor: yes' : '';
    return `layout: ${letter}\nword: ${word}${tuning}`;
  }
  if (/animator/i.test(system)) {
    const scenes = user.split('\n').filter((l) => /^\d+\. /.test(l)).length;
    const cuts = Array.from({ length: Math.max(0, scenes - 1) }, (_, i) => [i + 2, 'abcd'[i % 4]] as [number, string]);
    if (behaviour === 'json') return JSON.stringify({ cuts: Object.fromEntries(cuts), camera: 'b', entrance: 'a' });
    if (behaviour === 'hallucinate') return 'cuts: 2=teleport, 3=z\ncamera: drone\nlogo: fireworks';
    const lines = [`cuts: ${cuts.map(([n, l]) => `${n}=${l}`).join(', ')}`, 'camera: b', 'entrance: a', 'logo: b'];
    return behaviour === 'messy' ? `Voici :\n${lines.map((l) => `* **${l.replace(':', '**:')}`).join('\n')}` : lines.join('\n');
  }
  if (/sound designer/i.test(system)) return behaviour === 'hallucinate' ? 'track: z\nsfx: loud' : 'track: b\nsfx: normal';
  if (/reviewing/i.test(system)) {
    if (behaviour === 'hallucinate') return '1.layout=hologram\n9.cut=teleport';
    const cuts = (user.match(/^CUTS: (.+)$/m)?.[1] || '').split(', ');
    return behaviour === 'messy' && cuts[1] ? `2.cut=${cuts[1]}` : 'ok';
  }
  return '';
}

/**
 * L'agent codeur du cran Ultra, simulé : un composant générique (tous les textes de la scène,
 * un calque de marque qui balaie, des points qui pulsent) — de quoi éprouver le chemin réel
 * (lint, compilation, rendu de contrôle, scène retenue) sans modèle.
 */
export const SIMULATED_SCENE_CODE = `
import { useScene, useEngine, useLocalTime, useSceneProgress, useBeatPulse, useExitAt, Kinetic, progress, mix, cue } from '@idem/kit';

export default function Scene() {
  const s = useScene();
  const { u, horizontal, ease, data } = useEngine();
  const lt = useLocalTime();
  const p = useSceneProgress();
  const beat = useBeatPulse();
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const keys = Object.keys(s.slots).filter((k) => !!s.slots[k]);
  const sweep = ease(progress(lt, 0, 0.7));
  cue(\`\${s.key}:sweep\`, s.start, 'whoosh', 0.6);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: \`\${sweep * (horizontal ? 38 : 100)}%\`, height: horizontal ? '100%' : '26%', background: 'var(--hl)', transform: \`translateY(\${mix(0, -1.5, p)}%)\` }} />
      <span style={{ position: 'absolute', right: '9%', top: '12%', width: 3 * u, height: 3 * u, borderRadius: 999, background: 'var(--hl-text)', opacity: 0.5 + beat * 0.4 }} />
      <div className="safe" style={{ justifyContent: 'center', paddingLeft: horizontal ? '40%' : 0 }}>
        {keys.map((k, i) => (
          <div key={k} style={{ width: '100%', marginTop: i ? 2 * u : 0 }}>
            <Kinetic text={s.slots[k]} technique={i === 0 ? 'maskUp' : 'blurWords'} at={0.25 + i * g} role={i === 0 ? 'headline' : 'support'} fit={i === 0 ? [horizontal ? 10 : 12, 5, 3] : [5, 3, 2]} exitAt={exitAt} />
          </div>
        ))}
      </div>
    </>
  );
}
`.trim();

export async function simulateCoder(behaviour: ModelBehaviour): Promise<string> {
  if (behaviour === 'down') throw new Error('GLM: insufficient balance (simulated)');
  if (behaviour === 'empty') return '';
  return 'Voici la scène :\n```tsx\n' + SIMULATED_SCENE_CODE + '\n```';
}
