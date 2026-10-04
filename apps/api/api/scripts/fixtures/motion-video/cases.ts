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
export function simulateModel(testCase: VideoCase): (system: string, user: string) => Promise<string> {
  return async (_system, user) => {
    if (testCase.behaviour === 'down') throw new Error('GLM: insufficient balance (simulated)');
    if (testCase.behaviour === 'empty') return '';

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
