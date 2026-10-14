/**
 * L'agent média : pour chaque emplacement visuel du site, quoi montrer et sous
 * quelle forme.
 *
 *   photo            une scène réelle — Pexels d'abord, ou générée (Gemini)
 *                    quand la scène est trop précise pour une banque d'images ;
 *   illustration     un dessin à plat simple — dessiné en SVG par le modèle ;
 *   illustration-3d  un rendu 3D — généré par Gemini d'après un prompt écrit
 *                    par un second agent ;
 *   video            un clip court — généré par Veo, Pexels vidéo en repli ;
 *   pattern          le motif de la charte ;
 *   none             la section se lit mieux sans visuel.
 *
 * Le code borne ses choix : une vidéo au plus et seulement là où elle se
 * regarde (ouverture, vitrine), un nombre plafonné de générations payantes,
 * une galerie toujours en photos, un emplacement obligatoire jamais vide.
 */

import { ChatLogger } from '../../utils/logger.js';
import { cleanText } from '../json.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from '../modelCaller.js';
import { SiteFacts } from '../siteFacts.js';
import { Aspect } from './mediaClient.js';

export type AssetKind = 'photo' | 'illustration' | 'illustration-3d' | 'video' | 'pattern' | 'none';

/**
 * Le style visuel du site tel que les agents média le lisent : tiré du design
 * system compilé, pas d'un plan de sections.
 */
export interface MediaStyle {
  /** Nom de la direction artistique (charte), ou description courte du thème. */
  name: string;
  signature: string;
  family: 'structured' | 'expressive' | 'soft';
  /** Couleurs de la marque, en hexadécimal, la principale d'abord. */
  palette: string[];
  /** Fond clair des dessins. */
  ground: string;
}

export interface MediaSlot {
  /** La clé du visuel dans `src/site/media.ts` (`<page>-<section>`). */
  id: string;
  /** La page qui l'accueille, telle qu'affichée. */
  pageLabel: string;
  /** Ce que dit la section, en une phrase (sert au choix du visuel). */
  brief: string;
  role: 'hero' | 'story' | 'showcase' | 'gallery';
  aspect: Aspect;
  /** Sans média, la section disparaît (vitrine, galerie) ou perd sa forme (plein cadre). */
  required: boolean;
  /** Images demandées (galerie : trois). */
  count: number;
  videoAllowed: boolean;
  /** Le texte se pose sur le média : il lui faut une zone calme. */
  overlay: boolean;
}

export interface AssetDecision {
  slot: string;
  kind: AssetKind;
  /** Pour une photo : banque d'images d'abord, ou génération d'abord. */
  source: 'stock' | 'generate';
  /** Ce que montre le média, en anglais (les modèles d'image et Pexels lisent l'anglais). */
  subject: string;
  /** Requête Pexels, 2 à 5 mots. */
  query: string;
  /** Langue de la requête : l'anglais de l'agent, ou la langue du site pour les règles de repli. */
  queryLanguage: 'en' | 'fr';
  /** Texte alternatif, dans la langue du site. */
  alt: string;
}

const KINDS: AssetKind[] = ['photo', 'illustration', 'illustration-3d', 'video', 'pattern', 'none'];

/** Ce que chaque famille de styles montre volontiers, quand l'agent ne répond pas. */
function ruleDecision(slot: MediaSlot, family: MediaStyle['family'], facts: SiteFacts, language: string): AssetDecision {
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const subject = `${facts.description.slice(0, 160)}${place ? ` — in ${place}` : ''}`;
  // Sans agent, pas de traduction : la requête part dans la langue du site (Pexels
  // cherche aussi en français), à partir des mots qui disent le métier.
  const query = facts.description
    .split(/[\s,.:;]+/)
    .filter((word) => word.length > 3)
    .slice(0, 4)
    .join(' ');
  const alt = cleanText(slot.brief || facts.name, 120);
  const kind: AssetKind =
    slot.role === 'gallery' || slot.role === 'showcase'
      ? 'photo'
      : family === 'soft'
        ? 'illustration'
        : family === 'expressive'
          ? slot.role === 'hero'
            ? 'illustration-3d'
            : 'illustration'
          : 'photo';
  return { slot: slot.id, kind, source: 'stock', subject, query, queryLanguage: 'fr', alt };
}

function prompt(slots: MediaSlot[], facts: SiteFacts, style: MediaStyle, language: string): string {
  const family = style.family;
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const rows = slots.map(
    (slot) =>
      `- ${slot.id} · ${slot.role} · format ${slot.aspect}${
        slot.required ? ' · obligatoire' : ''
      }${slot.videoAllowed ? ' · vidéo possible' : ''}${slot.count > 1 ? ` · ${slot.count} photos` : ''}\n  section : ${slot.brief.slice(0, 160)}`
  );

  return `# Le projet
${facts.name} : ${facts.description}
${facts.audience ? `Clientèle : ${facts.audience}\n` : ''}${place ? `Lieu : ${place}\n` : ''}${
    facts.offers.length ? `Offres : ${facts.offers.map((offer) => offer.name).join(', ')}\n` : ''
  }
# La charte
Style : ${style.name} (${family === 'structured' ? 'sobre et construit' : family === 'expressive' ? 'expressif et coloré' : 'doux et dessiné'}). Signature : ${style.signature}.

# Les emplacements visuels
${rows.join('\n')}

# Ta tâche
Pour chaque emplacement, choisis le visuel qui sert le mieux la section :
- "photo" : une scène réelle (des personnes au travail, un lieu, un produit, un plat). "source": "stock" si une banque d'images en a de bonnes, "generate" si la scène est trop précise.
- "illustration" : un dessin à plat simple, pour une idée abstraite ou un déroulé.
- "illustration-3d" : un rendu 3D, pour un produit ou un concept dans un style expressif.
- "video" : un clip de quelques secondes, seulement là où c'est indiqué possible et où le mouvement raconte quelque chose (une machine qui tourne, un geste de métier). Une vidéo au plus.
- "pattern" : le motif de la charte, pour un visuel calme et décoratif.
- "none" : la section se lit mieux sans visuel (jamais pour un emplacement obligatoire).

Les personnes montrées ressemblent à la clientèle réelle${place ? ` de ${place}` : ''}. Ne représente jamais une personne précise du projet (fondateur, équipe) : montre des clients, des gestes, des lieux, des objets. Pas de cliché de banque d'images (poignée de main, bureau anonyme, sourire face caméra). Varie les formes d'un emplacement à l'autre.

La requête de banque d'images décrit une SCÈNE visible, pas un lieu ni une marque : la banque ne connaît ni les villes ni les entreprises. Par exemple « african woman folding laundry », pas « Douala laundry Mboa ». Quand des personnes apparaissent et que le projet est en Afrique, précise-le (« african », « black »).

# Forme exacte de la réponse
{
  "assets": [
    {
      "slot": "<id de l'emplacement>",
      "kind": "photo|illustration|illustration-3d|video|pattern|none",
      "source": "stock|generate",
      "subject": "ce que montre le visuel, en anglais, une phrase précise",
      "query": "requête de banque d'images en anglais, 2 à 5 mots",
      "alt": "texte alternatif ${language === 'fr' ? 'en français' : 'in English'}, une phrase"
    }
  ]
}`;
}

/**
 * Décide le visuel de chaque emplacement et applique les bornes. Ne lève
 * jamais : sans réponse de l'agent, les règles par style décident.
 */
export async function directMedia(options: {
  slots: MediaSlot[];
  facts: SiteFacts;
  style: MediaStyle;
  caller: ModelCaller;
  language: string;
  hasPattern: boolean;
  maxGenerated: number;
  allowVideo: boolean;
}): Promise<AssetDecision[]> {
  const { slots, facts, style, caller, language, hasPattern, maxGenerated, allowVideo } = options;
  const family = style.family;
  if (!slots.length) return [];

  let answered: Record<string, AssetDecision> = {};
  try {
    const outcome = await caller.json(
      'media',
      "Tu es directeur artistique. Tu choisis les visuels d'un site vitrine. Réponds UNIQUEMENT par l'objet JSON demandé.",
      prompt(slots, facts, style, language),
      (raw): Verdict<Record<string, AssetDecision>> => {
        const assets = (raw as { assets?: unknown[] } | null)?.assets;
        if (!Array.isArray(assets)) return { problem: SHAPE_REMINDER };
        const byslot: Record<string, AssetDecision> = {};
        for (const item of assets as Array<Record<string, unknown>>) {
          const slot = typeof item?.slot === 'string' ? item.slot : '';
          const kind = KINDS.includes(item?.kind as AssetKind) ? (item.kind as AssetKind) : null;
          if (!slots.some((candidate) => candidate.id === slot) || !kind) continue;
          byslot[slot] = {
            slot,
            kind,
            source: item.source === 'generate' ? 'generate' : 'stock',
            subject: cleanText(item.subject, 300),
            query: cleanText(item.query, 60),
            queryLanguage: 'en',
            alt: cleanText(item.alt, 160),
          };
        }
        return Object.keys(byslot).length >= Math.ceil(slots.length / 2) ? { value: byslot } : { problem: SHAPE_REMINDER };
      },
      1800
    );
    answered = outcome.value ?? {};
  } catch (error) {
    ChatLogger.warn('SITE_MEDIA', 'Agent média indisponible, règles par style', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Les bornes : dans l'ordre des emplacements, l'ouverture d'abord.
  let videos = 0;
  let generated = 0;
  const decisions: AssetDecision[] = [];

  for (const slot of slots) {
    const fallback = { ...ruleDecision(slot, family, facts, language), queryLanguage: (language === 'en' ? 'en' : 'fr') as 'en' | 'fr' };
    const decision: AssetDecision = { ...fallback, ...(answered[slot.id] ?? {}) };
    if (!decision.subject) decision.subject = fallback.subject;
    if (!decision.query) decision.query = fallback.query;
    if (!decision.alt) decision.alt = fallback.alt;

    if (slot.role === 'gallery') {
      decision.kind = 'photo';
      decision.source = 'stock';
    }
    if (decision.kind === 'video' && (!slot.videoAllowed || videos >= 1 || !allowVideo)) {
      decision.kind = 'photo';
      decision.source = 'stock';
    }
    if (decision.kind === 'pattern' && !hasPattern) decision.kind = slot.required ? 'photo' : 'none';
    if (decision.kind === 'none' && slot.required) decision.kind = 'photo';

    const paid = decision.kind === 'illustration-3d' || (decision.kind === 'photo' && decision.source === 'generate');
    if (paid && generated >= maxGenerated) {
      // Au-delà du plafond : la banque d'images pour une photo, le dessin pour une 3D.
      if (decision.kind === 'photo') decision.source = 'stock';
      else decision.kind = 'illustration';
    } else if (paid) {
      generated += 1;
    }
    if (decision.kind === 'video') videos += 1;

    decisions.push(decision);
  }

  ChatLogger.info('SITE_MEDIA', Object.keys(answered).length ? 'Visuels choisis par l’agent' : 'Visuels choisis par les règles', {
    decisions: decisions.map((decision) => `${decision.slot}:${decision.kind}${decision.kind === 'photo' ? `/${decision.source}` : ''}`),
  });

  return decisions;
}

/* -------------------------------------------------------------------------- */
/*  Prompts de génération                                                      */
/* -------------------------------------------------------------------------- */

const KIND_STYLE: Record<'photo' | 'illustration' | 'illustration-3d' | 'video', string> = {
  photo: 'photorealistic editorial photograph, natural light, real people and places, shallow depth of field',
  illustration: 'clean flat vector illustration, simple geometric shapes, generous negative space',
  'illustration-3d': 'soft 3D render, clay-like materials, studio lighting, rounded forms, subtle shadows',
  video: 'cinematic short clip, slow steady camera movement, natural light, realistic',
};

/**
 * L'agent qui écrit le prompt envoyé à Gemini (image) ou à Veo (vidéo).
 *
 * Il part du sujet choisi, du contexte du projet et de la charte (couleurs,
 * style), et il sait où le texte se posera. Sans réponse valable, un prompt
 * assemblé par le code.
 */
export async function writeGenerationPrompt(options: {
  caller: ModelCaller;
  decision: AssetDecision;
  slot: MediaSlot;
  kind: 'photo' | 'illustration' | 'illustration-3d' | 'video';
  facts: SiteFacts;
  style: MediaStyle;
}): Promise<string> {
  const { caller, decision, slot, kind, facts, style } = options;
  const palette = style.palette.slice(0, 4);
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const composition = slot.overlay
    ? 'Keep the left 40% of the frame calm, light and uncluttered: a headline will sit there.'
    : 'Main subject clearly readable, balanced composition with breathing room.';
  const noText = 'No text, letters, logos, signage or watermarks anywhere in the image.';

  const fallback = `${decision.subject}. ${KIND_STYLE[kind]}. Colour palette echoing ${palette.join(', ')}, light and airy overall. ${
    place && kind !== 'illustration' && kind !== 'illustration-3d' ? `Set in ${place}, people and places true to the region. ` : ''
  }${composition} ${kind === 'video' ? 'Aspect 16:9, 5 seconds, seamless loop feel.' : `Aspect ${slot.aspect}.`} ${noText}`;

  const outcome = await caller.json(
    `prompt/${slot.id}`,
    "Tu écris des prompts pour des modèles de génération d'images et de vidéos. Réponds UNIQUEMENT par l'objet JSON demandé.",
    `# Ce qu'il faut générer
${kind === 'video' ? 'Un clip vidéo de 5 secondes (Veo)' : kind === 'illustration-3d' ? 'Une illustration 3D (Gemini)' : kind === 'illustration' ? 'Une illustration à plat (Gemini)' : 'Une photographie (Gemini)'} pour la section « ${(slot.brief || slot.id).slice(0, 140)} » du site de ${facts.name}.
Sujet : ${decision.subject}
Ne représente aucune personne réelle du projet (ni fondateur, ni équipe) : des clients anonymes, des gestes, des lieux.
Projet : ${facts.description.slice(0, 300)}
${place ? `Lieu : ${place} (les personnes et les lieux montrés en sont crédibles)\n` : ''}Style visuel de la charte : ${style.name}. Couleurs de la marque : ${palette.join(', ')} (des touches, pas un aplat).
Format : ${slot.aspect}. ${composition}

# Règles du prompt
En anglais, 50 à 110 mots, une seule description continue : sujet, action, cadrage, lumière, matières, ambiance, palette. ${noText}${
      kind === 'video' ? ' Décris un seul plan, un mouvement de caméra lent, aucun changement de scène.' : ''
    }

# Forme exacte de la réponse
{ "prompt": "..." }`,
    (raw): Verdict<string> => {
      const text = typeof (raw as { prompt?: unknown } | null)?.prompt === 'string' ? ((raw as { prompt: string }).prompt).trim() : '';
      if (text.length < 120 || text.length > 1400) return { problem: SHAPE_REMINDER };
      return { value: /no text/i.test(text) ? text : `${text} ${noText}` };
    },
    600
  );

  return outcome.value ?? fallback;
}
