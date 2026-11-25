/**
 * L'agent média : pour chaque emplacement visuel du site, quoi montrer et sous
 * quelle forme.
 *
 *   photo            une scène réelle ;
 *   illustration     une illustration à plat ;
 *   illustration-3d  un rendu 3D ;
 *   video            un clip court ;
 *
 * Une REFONTE donne en plus le manifeste des images de l'ancien site (ce que chacune montre, lu par le modèle de
 * vision à la recopie) : l'agent choisit pour chaque emplacement l'image d'origine qui sert le projet (`site`), ou
 * constate qu'aucune ne convient et dit quoi chercher. Le code vérifie ses choix (forme, netteté, texte incrusté).
 *
 * Toujours LA BANQUE D'ABORD : un visuel n'est généré (image, vidéo) que si
 * aucune bibliothèque libre de droit (Pexels, Pixabay, Unsplash — `media/stock`) n'a rien
 * qui corresponde (`produceMedia`).
 *   pattern          le motif de la charte ;
 *   none             la section se lit mieux sans visuel.
 *
 * Le code borne ses choix : une vidéo au plus et seulement là où elle se
 * regarde (ouverture, vitrine), une galerie toujours en photos, un emplacement
 * obligatoire jamais vide. Le plafond des générations payantes se compte à la
 * production, quand aucune bibliothèque n'a rien trouvé.
 */

import { ChatLogger } from '../../utils/logger.js';
import { cleanText } from '../json.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from '../modelCaller.js';
import { SiteFacts } from '../siteFacts.js';
import { Aspect } from './mediaClient.js';
import type { LibraryImage } from '../redesign/inventory.js';

export type AssetKind = 'site' | 'photo' | 'illustration' | 'illustration-3d' | 'video' | 'pattern' | 'none';

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
  /** Refonte : les images (identifiants du manifeste) des sections d'origine que reprend cette section. */
  ownImages?: string[];
}

export interface AssetDecision {
  slot: string;
  kind: AssetKind;
  /** Ce que montre le média, en anglais (les modèles d'image et les bibliothèques lisent l'anglais). */
  subject: string;
  /** Requête de banque d'images, 2 à 5 mots. */
  query: string;
  /** Langue de la requête : l'anglais de l'agent, ou la langue du site pour les règles de repli. */
  queryLanguage: 'en' | 'fr';
  /** Texte alternatif, dans la langue du site. */
  alt: string;
  /** Pour une illustration : l'icône principale puis trois d'appui (lucide), mises en scène par le code. */
  icons?: string[];
  /** `kind: 'site'` : les images de l'ancien site retenues (identifiants du manifeste), la principale d'abord. */
  site?: string[];
}

const KINDS: AssetKind[] = ['photo', 'illustration', 'illustration-3d', 'video', 'pattern', 'none'];

/** Ce que chaque famille de styles montre volontiers, quand l'agent ne répond pas. */
function ruleDecision(slot: MediaSlot, family: MediaStyle['family'], facts: SiteFacts, language: string): AssetDecision {
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const subject = `${facts.description.slice(0, 160)}${place ? ` — in ${place}` : ''}`;
  // Sans agent, pas de traduction : la requête part dans la langue du site (les
  // bibliothèques cherchent aussi en français), à partir des mots qui disent le métier.
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
  return { slot: slot.id, kind, subject, query, queryLanguage: 'fr', alt };
}

/** Une ligne du manifeste des images, telle que l'agent la lit. */
function libraryRow(image: LibraryImage): string {
  const r = image.reading;
  const ratio = image.width / Math.max(1, image.height);
  const shape = ratio >= 1.15 ? 'paysage' : ratio <= 0.87 ? 'portrait' : 'carré';
  const marks = [
    r.kind,
    `${shape} ${image.width}×${image.height}`,
    r.people ? 'personnes' : '',
    r.text ? 'texte incrusté' : '',
    r.generic ? 'photo de banque générique' : '',
    [...r.flaws, ...image.issues.map((i) => (i === 'blurry' ? 'floue' : 'compressée'))].length ? `défauts : ${[...r.flaws, ...image.issues.map((i) => (i === 'blurry' ? 'floue' : 'compressée'))].join(', ')}` : '',
    `vue dans ${image.from.slice(0, 3).join(', ')}`,
  ].filter(Boolean);
  return `- ${image.id} · ${marks.join(' · ')}\n  « ${r.description.slice(0, 220)} »`;
}

function prompt(slots: MediaSlot[], facts: SiteFacts, style: MediaStyle, language: string, library?: LibraryImage[]): string {
  const family = style.family;
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const rows = slots.map(
    (slot) =>
      `- ${slot.id} · ${slot.role} · format ${slot.aspect}${
        slot.required ? ' · obligatoire' : ''
      }${slot.videoAllowed ? ' · vidéo possible' : ''}${slot.count > 1 ? ` · ${slot.count} photos` : ''}${
        library && slot.ownImages?.length ? ` · images de ses sections d'origine : ${slot.ownImages.join(', ')}` : ''
      }\n  section : ${slot.brief.slice(0, 160)}`
  );
  const siteImages = library
    ? `
# Les images de l'ancien site (regardées une à une)
${library.length ? library.map(libraryRow).join('\n') : "Aucune image utilisable (seulement des logos, icônes ou captures)."}
`
    : '';
  const siteTask = library
    ? `
D'ABORD les images de l'ancien site : pour chaque emplacement, retiens dans "site" l'image (ou, pour une galerie, les images) qui montre vraiment ce que dit la section et ce que fait ${facts.name}. Les images de ses sections d'origine sont un bon point de départ, pas une obligation : une meilleure image d'une autre section peut y aller, une image d'origine hors sujet n'y va pas. Une image ne sert qu'une fois.
N'en retiens AUCUNE (laisse "site" vide) quand aucune ne convient : sujet sans rapport avec le métier ou la section, photo de banque générique, texte incrusté dans une ouverture, défaut visible, format qui ne tient pas (une ouverture veut une image en paysage, nette et assez grande). Remplis alors "kind", "subject" et "query" pour la chercher ailleurs.
Remplis TOUJOURS "kind", "subject", "query" et "alt" (ils servent si l'image retenue est refusée).
`
    : '';

  return `# Le projet
${facts.name} : ${facts.description}
${facts.audience ? `Clientèle : ${facts.audience}\n` : ''}${place ? `Lieu : ${place}\n` : ''}${
    facts.offers.length ? `Offres : ${facts.offers.map((offer) => offer.name).join(', ')}\n` : ''
  }
# La charte
Style : ${style.name} (${family === 'structured' ? 'sobre et construit' : family === 'expressive' ? 'expressif et coloré' : 'doux et dessiné'}). Signature : ${style.signature}.

${siteImages}
# Les emplacements visuels
${rows.join('\n')}

# Ta tâche
${siteTask}Pour chaque emplacement${library ? ' sans image de l’ancien site' : ''}, choisis le visuel qui sert le mieux la section :
- "photo" : une scène réelle (des personnes au travail, un lieu, un produit, un plat).
- "illustration" : une illustration composée de pictogrammes (un principal mis en scène, trois d'appui), pour un service, une démarche en étapes ou une idée qu'une photo montrerait mal. Donne ses 4 icônes lucide-react dans "icons" (ex. Truck, Shirt, Clock, CircleCheck).
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
      "slot": "<id de l'emplacement>",${library ? `
      "site": ["identifiants des images de l'ancien site retenues, la principale d'abord ; [] si aucune ne convient"],` : ''}
      "kind": "photo|illustration|illustration-3d|video|pattern|none",
      "subject": "ce que montre le visuel, en anglais, une phrase précise",
      "query": "requête de banque d'images en anglais, 2 à 5 mots",
      "alt": "texte alternatif ${language === 'fr' ? 'en français' : 'in English'}, une phrase",
      "icons": ["pour une illustration seulement : 4 icônes lucide-react en PascalCase qui disent le sujet, la principale d'abord"]
    }
  ]
}`;
}

/** Une image qui peut ouvrir une page : en paysage, assez grande, nette, sans texte incrusté ni défaut visible. */
export function opensWell(image: LibraryImage): boolean {
  return image.width / Math.max(1, image.height) >= 1.15 && image.width >= 1000 && !image.reading.text && !image.reading.flaws.length && !image.issues.length;
}

/**
 * Les images de l'ancien site retenues par l'agent pour un emplacement, après les bornes du code : identifiants connus,
 * jamais deux fois la même, au moins 400 px, jamais de texte incrusté sous un titre posé dessus. Une ouverture met en
 * tête une image qui ouvre bien ; sans aucune, le choix est refusé (le visuel est alors cherché ailleurs).
 */
export function castSiteImages(slot: MediaSlot, ids: string[], byId: Map<string, LibraryImage>, used: Set<string>): string[] {
  const picked = [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter((image): image is LibraryImage => !!image && !used.has(image.id))
    .filter((image) => Math.min(image.width, image.height) >= 400 && !(slot.overlay && image.reading.text));
  if (!picked.length) return [];
  if (slot.role === 'hero') {
    const lead = picked.findIndex(opensWell);
    if (lead < 0) return [];
    picked.unshift(...picked.splice(lead, 1));
  }
  return picked.slice(0, 12).map((image) => image.id);
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
  allowVideo: boolean;
  /** Refonte : le manifeste des images de l'ancien site (`siteImageLibrary`). */
  library?: LibraryImage[];
}): Promise<AssetDecision[]> {
  const { slots, facts, style, caller, language, hasPattern, allowVideo, library } = options;
  const family = style.family;
  if (!slots.length) return [];

  let answered: Record<string, AssetDecision> = {};
  try {
    const outcome = await caller.json(
      'media',
      "Tu es directeur artistique. Tu choisis les visuels d'un site vitrine. Réponds UNIQUEMENT par l'objet JSON demandé.",
      prompt(slots, facts, style, language, library),
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
            subject: cleanText(item.subject, 300),
            query: cleanText(item.query, 60),
            queryLanguage: 'en',
            alt: cleanText(item.alt, 160),
            icons: Array.isArray(item.icons) ? (item.icons as unknown[]).map((icon) => cleanText(icon, 40)).filter(Boolean).slice(0, 4) : [],
            ...(library && Array.isArray(item.site) ? { site: (item.site as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 12) } : {}),
          };
        }
        return Object.keys(byslot).length >= Math.ceil(slots.length / 2) ? { value: byslot } : { problem: SHAPE_REMINDER };
      },
      library ? 2800 : 1800
    );
    answered = outcome.value ?? {};
  } catch (error) {
    ChatLogger.warn('SITE_MEDIA', 'Agent média indisponible, règles par style', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Les bornes : dans l'ordre des emplacements, l'ouverture d'abord.
  let videos = 0;
  const decisions: AssetDecision[] = [];

  const byId = new Map((library ?? []).map((image) => [image.id, image]));
  const used = new Set<string>();

  for (const slot of slots) {
    const fallback = { ...ruleDecision(slot, family, facts, language), queryLanguage: (language === 'en' ? 'en' : 'fr') as 'en' | 'fr' };
    const decision: AssetDecision = { ...fallback, ...(answered[slot.id] ?? {}) };
    if (!decision.subject) decision.subject = fallback.subject;
    if (!decision.query) decision.query = fallback.query;
    if (!decision.alt) decision.alt = fallback.alt;

    // L'image de l'ancien site retenue, si le code la juge à sa place ; sinon le visuel décrit est cherché ailleurs.
    const cast = library ? castSiteImages(slot, decision.site ?? [], byId, used) : [];
    if (cast.length) {
      cast.forEach((id) => used.add(id));
      decision.kind = 'site';
      decision.site = cast;
      decision.alt = byId.get(cast[0])!.alt || decision.alt;
      decisions.push(decision);
      continue;
    }
    delete decision.site;
    if (decision.kind === 'site') decision.kind = fallback.kind;

    if (slot.role === 'gallery') decision.kind = 'photo';
    if (decision.kind === 'video' && (!slot.videoAllowed || videos >= 1 || !allowVideo)) decision.kind = 'photo';
    if (decision.kind === 'pattern' && !hasPattern) decision.kind = slot.required ? 'photo' : 'none';
    if (decision.kind === 'none' && slot.required) decision.kind = 'photo';

    if (decision.kind === 'video') videos += 1;

    decisions.push(decision);
  }

  // Sans réponse de l'agent, une refonte reprend les images de ses sections d'origine, comme avant le manifeste.
  if (library && !Object.keys(answered).length) {
    used.clear();
    decisions.forEach((decision, index) => {
      const slot = slots[index];
      const own = castSiteImages(slot, slot.ownImages ?? [], byId, used);
      if (!own.length) return;
      own.forEach((id) => used.add(id));
      decision.kind = 'site';
      decision.site = own;
    });
  }

  ChatLogger.info('SITE_MEDIA', Object.keys(answered).length ? 'Visuels choisis par l’agent' : 'Visuels choisis par les règles', {
    decisions: decisions.map((decision) => `${decision.slot}:${decision.kind}`),
  });

  return decisions;
}

/* -------------------------------------------------------------------------- */
/*  Prompts de génération                                                      */
/* -------------------------------------------------------------------------- */

const KIND_STYLE: Record<'photo' | 'illustration' | 'illustration-3d' | 'video', string> = {
  photo: 'photorealistic editorial photograph, natural light, real people and places, shallow depth of field',
  illustration:
    'professional editorial vector illustration in the style of a top design studio, flat shapes with subtle texture, considered composition, limited palette, crisp edges, generous negative space, no text, no letters, no logos, no UI mockups, no gradients mesh',
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
