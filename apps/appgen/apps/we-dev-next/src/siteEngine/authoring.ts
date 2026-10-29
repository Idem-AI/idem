/**
 * Opération B, volet rédaction : un agent écrit un composant du site.
 *
 * Une tâche = un fichier TSX court (une section, l'en-tête ou le pied de
 * page). L'agent compose librement avec React, Tailwind, Motion et les
 * composants du design system ; il ne réécrit aucun composant de base et
 * n'écrit aucun CSS. Les faits viennent de `@/site/data`, les visuels de
 * `@/site/media`.
 *
 * Chaque réponse passe par trois filets, dans cet ordre :
 *
 *   1. le correcteur (`autocorrect.ts`) répare ce qui est mécanique — couleurs
 *      en dur, imports manquants ou mal placés, icônes mal nommées, export ;
 *   2. la vérification de forme (esbuild, imports, thème) et des faits ;
 *   3. s'il reste un problème, le modèle reçoit SA version et la liste exacte
 *      de ce qu'il doit corriger, et ne touche qu'à cela.
 *
 * En dernier recours, les phrases qui affirment ce que les faits ne disent pas
 * sont retirées par le code. Il n'y a jamais de note esthétique.
 */

import { transform } from 'esbuild';
import { CATALOG, catalogEntry, renderContract } from './catalog.js';
import { autocorrect, lucideIcons, resolveIcon, stripClaims, ThemeColors } from './autocorrect.js';
import { cleanSlop } from './slopGuard.js';
import { ModelCaller, Verdict } from './modelCaller.js';
import { ChatLogger } from '../utils/logger.js';
import { FactCheck } from './factGuard.js';
import { layoutBrief, ManifestPage, ManifestSection, SiteManifest } from './manifest.js';
import { renderCheck } from './renderCheck.js';
import { describeDataModule } from './siteData.js';
import { SiteFacts } from './siteFacts.js';

/* -------------------------------------------------------------------------- */
/*  Vérification                                                               */
/* -------------------------------------------------------------------------- */

/** Des icônes utiles à un site vitrine, toutes présentes dans la version posée. */
export const COMMON_ICONS = [
  'ArrowRight', 'Check', 'CircleCheck', 'ChevronRight', 'Phone', 'Mail', 'MapPin', 'MessageCircle', 'Clock', 'Calendar',
  'Star', 'Heart', 'Sparkles', 'ShieldCheck', 'Truck', 'Package', 'ShoppingBag', 'Users', 'User', 'House', 'Building2',
  'Briefcase', 'Wrench', 'Hammer', 'Scissors', 'Shirt', 'WashingMachine', 'SprayCan', 'Utensils', 'Coffee', 'Leaf',
  'Sun', 'Droplets', 'Car', 'GraduationCap', 'BookOpen', 'Stethoscope', 'HeartPulse', 'Camera', 'Palette', 'Music',
  'Globe', 'Zap', 'Lightbulb', 'Target', 'Award', 'Handshake', 'Menu', 'X', 'Quote',
];


const PALETTE_CLASS =
  /(?:^|[\s"'`:])(?:bg|text|border|from|via|to|ring|fill|stroke|outline|divide|shadow|decoration|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const ARBITRARY_COLOR = /(?:bg|text|border|from|via|to|fill|stroke)-\[(?:#|rgb|hsl|oklch)[^\]]*\]/g;

interface ImportRef {
  source: string;
  names: string[];
  defaultName?: string;
  namespace: boolean;
}

function readImports(code: string): ImportRef[] {
  const refs: ImportRef[] = [];
  const pattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  for (const match of Array.from(code.matchAll(pattern))) {
    if (match[4]) {
      refs.push({ source: match[4], names: [], namespace: false });
      continue;
    }
    if (match[1]) continue; // import type : effacé à la compilation
    const clause = match[2];
    const named = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
    const names = named
      .split(',')
      .map((part) => part.trim().replace(/^type\s+/, ''))
      .filter((part) => part && !part.startsWith('type '))
      .map((part) => part.split(/\s+as\s+/)[0].trim());
    const head = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
    refs.push({
      source: match[3],
      names,
      namespace: /\*\s+as\s+/.test(head),
      defaultName: head && !/\*\s+as\s+/.test(head) ? head.split(/\s+/)[0] : undefined,
    });
  }
  return refs;
}

export interface ImportPolicy {
  /** Modules `@/…` du projet que ce composant peut importer, avec leurs exports. */
  local: Record<string, { default?: boolean; names?: string[] }>;
  /** Dépendances fonctionnelles déclarées par le manifeste. */
  packages: string[];
}

/** Les noms connus du navigateur et du langage, utilisables sans import. */
const GLOBALS = new Set(['Math', 'Date', 'Number', 'String', 'Array', 'Object', 'JSON', 'Intl', 'Boolean', 'Promise', 'Set', 'Map', 'URL', 'Fragment']);

/**
 * Les composants JSX et les modules du projet employés sans import ni
 * déclaration : esbuild compile le fichier, mais il plante à l'exécution.
 */
function undeclaredNames(code: string): string[] {
  const declared = new Set<string>(GLOBALS);
  for (const ref of readImports(code)) {
    if (ref.defaultName) declared.add(ref.defaultName);
    ref.names.forEach((name) => declared.add(name));
  }
  for (const match of Array.from(code.matchAll(/import\s+[^;]*?\{([^}]*)\}/g))) {
    for (const part of match[1].split(',')) {
      const alias = part.split(/\s+as\s+/).pop()?.trim();
      if (alias) declared.add(alias);
    }
  }
  for (const match of Array.from(code.matchAll(/import\s+\*\s+as\s+(\w+)/g))) declared.add(match[1]);
  for (const match of Array.from(code.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g))) declared.add(match[1]);
  for (const match of Array.from(code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g))) {
    match[1].split(',').forEach((part) => declared.add(part.split(':').pop()!.trim()));
  }
  // Paramètres déstructurés et variables de boucle : `({ icon: Icon })`, `.map((Item) =>`.
  for (const match of Array.from(code.matchAll(/[{,]\s*\w+\s*:\s*([A-Z][\w$]*)\s*[,}=]/g))) declared.add(match[1]);
  for (const match of Array.from(code.matchAll(/\(\s*\{?\s*([A-Z][\w$]*)\s*[,)}]/g))) declared.add(match[1]);

  const used = new Set<string>();
  // Une balise JSX, pas un type générique (`ChangeEvent<HTMLInputElement>`, `useState<Item[]>`).
  for (const match of Array.from(code.matchAll(/(?<![\w$.\]])<([A-Z][\w$]*|motion)\b/g))) used.add(match[1]);
  for (const name of ['motion', 'motionTokens', 'site', 'media', 'cn', 'AnimatePresence']) {
    if (new RegExp(`(?<![\\w.$'"\`])${name}\\s*[.(]`).test(code)) used.add(name);
  }
  // `React.ReactNode` est un type, effacé à la compilation ; `React.useState` est une valeur.
  if (/(?<![\w.])React\.(use[A-Z]\w*|createElement|Fragment|forwardRef|memo|Children|cloneElement)\b/.test(code)) used.add('React');
  return Array.from(used).filter((name) => !declared.has(name));
}

/** Ce que la réponse a de mal formé (vide si elle est bonne). */
export async function checkComponent(code: string, policy: ImportPolicy): Promise<string[]> {
  const problems: string[] = [];

  if (!/export\s+default\s+function\s+[A-Z]\w*\s*\(/.test(code)) {
    problems.push('le fichier doit exporter `export default function NomDuComposant(…)`');
  }

  try {
    await transform(code, { loader: 'tsx', jsx: 'automatic', format: 'esm', logLevel: 'silent' });
  } catch (error) {
    const first = (error as { errors?: Array<{ text: string; location?: { line: number; lineText: string } }> }).errors?.[0];
    problems.push(
      first
        ? `erreur de syntaxe ligne ${first.location?.line ?? '?'} : ${first.text}${first.location?.lineText ? ` (« ${first.location.lineText.trim().slice(0, 80)} »)` : ''}`
        : 'le fichier ne se compile pas'
    );
    return problems;
  }

  const icons = lucideIcons();
  for (const ref of readImports(code)) {
    const { source } = ref;
    if (source === 'react') continue;
    if (source === 'motion/react') continue;
    if (source === 'lucide-react') {
      const unknown = icons.size ? ref.names.filter((name) => !icons.has(name)) : [];
      if (unknown.length) {
        const hints = unknown.map((name) => {
          const close = resolveIcon(name);
          return `${name} n'existe pas (par exemple ${close})`;
        });
        problems.push(`icônes lucide-react : ${hints.join(' ; ')}. Noms exacts disponibles par exemple : ${COMMON_ICONS.join(', ')}`);
      }
      if (ref.defaultName || ref.namespace) problems.push('importe les icônes par leur nom : `import { Phone } from \'lucide-react\'`');
      continue;
    }
    if (policy.packages.includes(source)) continue;

    if (source === '@/components/ui') {
      const all = new Set(CATALOG.flatMap((item) => item.exports));
      const missing = ref.names.filter((name) => !all.has(name));
      if (missing.length) problems.push(`@/components/ui n'exporte pas ${missing.join(', ')}`);
      if (ref.defaultName) problems.push("@/components/ui n'a pas d'export par défaut : `import { Button } from '@/components/ui'`");
      continue;
    }

    if (source.startsWith('@/components/ui/')) {
      const entry = catalogEntry(source.slice('@/components/ui/'.length));
      if (!entry) {
        problems.push(`« ${source} » n'existe pas : composants disponibles dans @/components/ui/ : ${CATALOG.map((item) => item.module).join(', ')}`);
        continue;
      }
      const missing = ref.names.filter((name) => !entry.exports.includes(name));
      if (missing.length) problems.push(`« ${source} » n'exporte pas ${missing.join(', ')} (exports : ${entry.exports.join(', ')})`);
      if (ref.defaultName) problems.push(`« ${source} » n'a pas d'export par défaut : \`import { ${entry.exports[0]} } from '${source}'\``);
      continue;
    }

    const local = policy.local[source];
    if (local) {
      if (ref.defaultName && !local.default) problems.push(`« ${source} » n'a pas d'export par défaut`);
      const missing = ref.names.filter((name) => !(local.names ?? []).includes(name));
      if (missing.length) problems.push(`« ${source} » n'exporte pas ${missing.join(', ')}`);
      continue;
    }

    if (/\.css$|\.scss$/.test(source)) problems.push(`pas de feuille de style (« ${source} ») : les classes Tailwind et le thème suffisent`);
    else problems.push(`import interdit : « ${source} ». Seuls react, motion/react, lucide-react et les modules du projet listés sont permis`);
  }

  const undeclared = undeclaredNames(code);
  if (undeclared.length) {
    problems.push(`utilisé sans être importé ni déclaré : ${undeclared.join(', ')} (ajoute son import ou sa déclaration)`);
  }

  const palette = Array.from(new Set((code.match(PALETTE_CLASS) ?? []).map((item) => item.trim().replace(/^[:"'`]/, ''))));
  const arbitrary = Array.from(new Set(code.match(ARBITRARY_COLOR) ?? []));
  if (palette.length || arbitrary.length) {
    problems.push(
      `couleurs hors thème : ${[...palette, ...arbitrary].slice(0, 6).join(', ')}. Utilise seulement les couleurs du thème (bg-primary, text-muted-foreground, bg-primary/10, border-border…)`
    );
  }
  if (/<style[\s>]/.test(code)) problems.push('pas de balise <style> : les classes Tailwind et le thème suffisent');

  return problems;
}

/** Une chaîne qui n'est qu'une suite de classes Tailwind ou un chemin. */
const looksTechnical = (value: string): boolean =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => /^[a-z0-9:[\]/.%#()&>_!=-]+$/.test(token) && (/[-:/[]/.test(token) || token.length <= 4));

/** Les textes visibles d'un composant : JSX et chaînes de plusieurs mots. */
export function visibleTexts(code: string): string[] {
  const texts: string[] = [];
  // Les classes ne sont pas du texte : attributs className et appels cn() retirés.
  const body = code
    .replace(/^import[^\n]*$/gm, '')
    .replace(/className=(["'`])[\s\S]*?\1/g, '')
    // Un exemple dans un champ (« Marie Ngono », « le 15 décembre ») n'affirme rien.
    .replace(/placeholder=(["'`])[\s\S]*?\1/g, '')
    .replace(/placeholder=\{(["'`])[\s\S]*?\1\}/g, '')
    .replace(/className=\{`[\s\S]*?`\}/g, '')
    .replace(/\bcn\(([^()]|\([^()]*\))*\)/g, '');
  // Un saut de ligne dans du JSX sépare deux textes (titre sur deux lignes, phrase suivante).
  for (const match of Array.from(body.matchAll(/>\s*([^<>{}]*\p{L}[^<>{}]*?)\s*</gu))) {
    texts.push(...match[1].split(/\s*\n\s*/).filter(Boolean));
  }
  for (const match of Array.from(body.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.){6,}?)\1/g))) {
    const value = match[2];
    if (/\p{L}{2,}\s+\p{L}{2,}/u.test(value) && !looksTechnical(value)) texts.push(value);
  }
  return texts;
}

/** Des promesses commerciales qui engagent le projet : seulement si les faits les font. */
const CLAIMS = [
  /\bgratuit(?:e|s|es)?\b/i,
  /\bofferte?s?\b/i,
  /\bfree\b/i,
  /\b24\s?h\s?\/\s?24\b/i,
  /\b7\s?j(?:ours)?\s?\/\s?7\b/i,
  /\bgaranti(?:e|s|es)?\b/i,
  /\bguarantee[ds]?\b/i,
  /\bremboursé(?:e|s)?\b/i,
  /\bn°\s?1\b|\bnuméro un\b|\bleader\b/i,
  /\bcertifiée?s?\b|\bagréée?s?\b|\bcertified\b/i,
  /\bécologiques?\b|\bbio\b|\beco-friendly\b/i,
];

const PERSON = /^\p{Lu}[\p{Ll}'-]+(?:[ -]\p{Lu}[\p{Ll}'-]+)*\s+\p{Lu}\.?$/u;
const NAMED_PLACE = /^(\p{Lu}[\p{L}'-]+)(?:\s+\p{Lu}[\p{L}'-]+)?,\s+\p{Lu}/u;

/**
 * Les personnes, les lieux et les promesses qu'un composant affirme sans que
 * le projet les connaisse : un avis signé « Marie-Claire N., Bonapriso » ou
 * une « livraison gratuite » sont inventés.
 */
export function inventedNames(texts: string[], reference: string): string[] {
  const known = reference.toLowerCase();
  const found: string[] = [];
  for (const raw of texts) {
    const text = raw.replace(/&nbsp;/g, ' ').trim();
    if (PERSON.test(text) && !known.includes(text.split(/\s+/)[0].toLowerCase())) found.push(text);
    const place = text.match(NAMED_PLACE)?.[1];
    if (place && !known.includes(place.toLowerCase())) found.push(text);
    for (const claim of CLAIMS) {
      const word = text.match(claim)?.[0];
      if (word && !claim.test(reference)) found.push(word.toLowerCase());
    }
  }
  return found;
}

/** Retire un bloc de code Markdown et ce qui l'entoure. */
export function extractCode(text: string): string {
  const fenced = text.match(/```(?:tsx|typescript|ts|jsx)?\s*\n([\s\S]*?)```/);
  let code = fenced ? fenced[1] : text;
  const start = code.search(/^(import|export|\/\*\*|\/\/|'use client')/m);
  if (start > 0) code = code.slice(start);
  return code.trim() + '\n';
}

/* -------------------------------------------------------------------------- */
/*  Consignes                                                                  */
/* -------------------------------------------------------------------------- */

export interface AuthoringContext {
  facts: SiteFacts;
  factsText: string;
  manifest: SiteManifest;
  language: string;
  /** Composants optionnels retenus par l'architecte. */
  components: string[];
  /** Le thème en une ligne, pour situer le ton (ex. rayons nets, ombres douces). */
  themeSummary: string;
  /** Les langues du site, la principale en tête (les textes s'écrivent dans la principale, le code les traduit). */
  languages?: string[];
}

/**
 * Le message système des auteurs : identique pour toutes les tâches d'un même
 * site, donc mis en cache par le fournisseur.
 */
export function authorSystemPrompt(ctx: AuthoringContext): string {
  const fr = ctx.language === 'fr';
  return `Tu écris UN composant React + TypeScript d'un site vitrine, dans un projet déjà configuré (Vite, Tailwind CSS, shadcn/ui, Motion for React). Tu réponds UNIQUEMENT par le contenu du fichier .tsx, sans bloc Markdown ni phrase autour.

# Règles de la pile
- React + TypeScript, un seul composant exporté par défaut : \`export default function Nom() { … }\`.
- Tailwind CSS pour la disposition, les espacements, le responsive (mobile d'abord, puis sm: md: lg:).
- Les composants de @/components/ui sont le design system : utilise-les dès que leur fonction correspond. Ils portent déjà leurs couleurs, rayons, bordures, ombres et typographies — n'ajoute pas de classes de couleur, de rayon, d'ombre ou de police sur eux, sauf pour la disposition (marges, largeur, alignement).
- Couleurs : les couleurs de la charte SONT déjà dans le thème (primary, secondary, accent…) : jamais de code couleur (#…, rgb). Seulement les jetons — background, foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, card, border, ring — avec opacité si besoin (bg-primary/10). La palette standard de Tailwind (blue-600, gray-100…) n'existe pas dans ce projet. Pas de hexadécimal.
- Rayons et ombres : rounded-sm|md|lg|xl|2xl|full, rounded-card, rounded-button ; shadow-sm|md|lg|xl. Ils suivent le thème. Tailles de texte : text-display, text-h1, text-h2, text-h3, text-h4, text-lead, text-body, text-small (ou Heading / Text).
- Animations : uniquement Motion for React (\`import { motion } from 'motion/react'\`), avec les paramètres du thème (\`import { motionTokens } from '@/design-system'\` : duration, stagger, ease, distance, scale, spring). Anime ce qui sert la lecture, pas tout. Ne cache jamais par une animation le titre de la première section.
- Icônes : lucide-react, importées par leur nom exact en PascalCase, par exemple : ${COMMON_ICONS.join(', ')}.
- Interdits : CSS, balise <style>, attribut style pour une couleur, autre bibliothèque de composants ou d'animation, réécriture d'un composant de base, image d'une adresse inventée, faux formulaire.

# Contenu
- ${fr ? 'Tout le texte visible est en français.' : 'All visible text is in English.'} Écris pour la clientèle de ce projet, avec ses mots : chaque phrase est propre à ce projet.
- Richesse et substance : des sections généreuses, détaillées et vivantes, des titres soignés et des micro-animations sobres. Ne produis jamais de section squelettique de seulement 2 ou 3 lignes. La forme vient de la COMPOSITION donnée pour ta section : suis-la, elle n'est pas une grille de cartes sauf si elle le dit.

# Ce qui trahit un site généré par une IA — interdit, sans exception
- Une étiquette, un badge ou un petit texte en capitales AU-DESSUS d'un titre (« Notre mission », « Nos services », « ✦ Nouveau »). Le titre se suffit.
- Une icône posée dans une pastille colorée (rond ou carré teinté) devant chaque élément ; l'icône Sparkles ; une icône dans chaque bouton.
- Une rangée de cartes identiques « icône + titre + phrase » ; trois colonnes par défaut.
- Une illustration dessinée en HTML/CSS : formes, cercles, blobs, fausses captures d'écran, faux graphiques, cadres vides, motifs de points. Un visuel vient UNIQUEMENT de \`media\` ; sans visuel prévu, la typographie, l'espace et les données composent la section.
- Un bandeau d'« indicateurs de confiance » ou de chiffres que les faits ne donnent pas ; des dégradés ; des émojis.
- N'invente aucun prix, délai, horaire, jour, quartier, nom de client, avis, récompense, partenaire ni garantie non vérifiés. Les prix, l'équipe, les coordonnées et les liens viennent de \`site\` (@/site/data) : importe-les, ne les recopie pas.
- Pas de témoignage ni de citation de client, pas de moyen de paiement, pas de « gratuit », « express » ou « en X minutes » si les faits ne le disent pas.
- Le site n'a ni serveur, ni compte, ni paiement en ligne : l'action passe par site.primaryAction ou site.contact.channels. Un formulaire de contact est possible : à l'envoi, il ouvre le message dans WhatsApp ou la messagerie avec \`messageLink(texte)\` (\`import { messageLink } from '@/lib/contact'\`, rend un lien ou null) — jamais de fetch ni de faux message « envoyé ».
- Pas d'emoji, pas de tiret cadratin, pas de superlatif creux. Pas de texte de remplissage (lorem ipsum).
- Accessibilité : une hiérarchie de titres juste, des liens et boutons au libellé explicite, aria-label sur un bouton icône, alt sur les visuels.

# Imports permis
react · motion/react · lucide-react · @/components/ui/<module> (ou tout depuis @/components/ui) · @/design-system (motionTokens) · @/lib/utils (cn) · @/lib/contact (messageLink) · @/site/data (site) · @/site/media (media) · @/site/brand (BrandMark, par défaut)${ctx.manifest.dependencies.length ? ` · ${ctx.manifest.dependencies.join(' · ')}` : ''}

# Composants du design system
${renderContract(ctx.components)}

# Les faits du site (@/site/data)
${describeDataModule(ctx.facts, ctx.manifest)}

# Le thème de ce site
${ctx.themeSummary}`;
}

export interface SectionTask {
  page: ManifestPage;
  section: ManifestSection;
  /** La clé du visuel dans `media`, s'il existe. */
  mediaKey?: string;
  mediaKind?: string;
  mediaAspect?: string;
  /** Plusieurs visuels prêts (galerie, cartes illustrées) : leurs clés et leur texte alternatif. */
  mediaList?: { key: string; alt: string }[];
  /** Refonte : le contenu intégral des sections de l'ancien site que celle-ci reprend. */
  source?: string;
  /** Première section de l'accueil ou d'une page : porte le h1. */
  opening: boolean;
}

function projectBlock(ctx: AuthoringContext, request: string): string {
  const brief = request.trim();
  return `# Le projet
${ctx.factsText}${brief && brief !== ctx.facts.description ? `\n\n# La demande de l'utilisateur\n${brief.slice(0, 800)}` : ''}`;
}

export function sectionPrompt(ctx: AuthoringContext, task: SectionTask, request: string): string {
  const { page, section } = task;
  const others = page.sections.filter((item) => item !== section).map((item) => `- ${item.id} : ${item.brief}`);
  const visual =
    task.mediaList && task.mediaList.length > 1
      ? `Visuels prêts pour cette section (les images de l'ancien site, à réutiliser toutes, mieux mises en valeur) :\n${task.mediaList.map((m) => `- \`media['${m.key}']\`${m.alt ? ` — ${m.alt}` : ''}`).join('\n')}\nAffiche-les avec <Media asset={media['…']} … /> (grille, galerie, cartes illustrées : selon le contenu).`
      : task.mediaKey
        ? `Un visuel est prêt pour cette section : \`media['${task.mediaKey}']\` (${task.mediaKind}${task.mediaAspect ? `, format ${task.mediaAspect}` : ''}). Affiche-le avec <Media asset={media['${task.mediaKey}']} … />.`
        : "Aucune image pour cette section : compose avec la typographie, l'espace, les couleurs du thème et les composants. N'affiche pas de cadre vide ni d'image factice.";
  const source = task.source
    ? `\n# Le contenu de l'ancien site que cette section reprend — INTÉGRALEMENT
${task.source}

Tout ce contenu apparaît dans ta section : chaque titre, chaque paragraphe, chaque élément de liste, chaque bouton (avec sa destination). Tu peux le réorganiser, le resserrer et le réécrire pour qu'il parle mieux à la cible ; tu n'en retires rien et tu n'y ajoutes aucun fait (chiffre, nom, lieu, promesse) qui n'y est pas.\n`
    : '';

  return `${projectBlock(ctx, request)}

# Le site
Pages : ${ctx.manifest.pages.map((item) => `${item.label} (${item.path})`).join(', ')}.

# La page
${page.label} (${page.path})${page.purpose ? ` : ${page.purpose}` : ''}

# Les autres sections de cette page (ne les répète pas)
${others.join('\n') || '(aucune)'}

# Ta section
Composant : ${section.component} — fichier src/sections/${page.key}/${section.component}.tsx
Ancre : l'élément racine porte id="${section.id}" (utilise <Section id="${section.id}"> ou une balise <section id="${section.id}">).
Ce qu'elle montre et dit : ${section.brief}${source}
${section.layout ? `Composition imposée : ${layoutBrief(section.layout, ctx.language === 'fr')}. Suis-la ; elle diffère volontairement de celle des sections voisines.` : ''}
${task.opening ? 'C\'est la première section de la page : son titre principal est le seul <h1> de la page (Heading level={1}).' : 'Ses titres commencent au niveau 2 (Heading level={2}).'}
${visual}

Réponds avec le fichier complet, et rien d'autre.`;
}

export function headerPrompt(ctx: AuthoringContext, request: string): string {
  return `${projectBlock(ctx, request)}

# Ta tâche
Écris l'en-tête du site : src/components/site/SiteHeader.tsx
Signature exacte : \`export default function SiteHeader({ current }: { current: string })\` — \`current\` est l'adresse de la page affichée ("/", "/…/") ; marque le lien actif avec aria-current="page".
Ce qu'il montre : ${ctx.manifest.header || 'la marque, le menu et l\'action principale.'}
- La marque : \`import BrandMark from '@/site/brand'\` → <BrandMark />, dans un lien vers "/". BrandMark affiche déjà le logo, ou le nom du projet s'il n'a pas de logo : n'écris pas site.name à côté.
- Le menu : itère sur \`site.navigation\` pour afficher chaque lien (\`<a href={item.href}>\`). Applique une mise en valeur active quand \`current === item.href\` ou \`current === item.href + '/'\` et \`aria-current={current === item.href ? 'page' : undefined}\`.
- Sur mobile, affiche impérativement tous les liens de \`site.navigation\` dans un <Sheet> (@/components/ui/sheet) ouvert par un bouton icône (Menu de lucide-react).
- L'action principale : site.primaryAction, si elle existe, avec <Button asChild><a href={site.primaryAction.href}>{site.primaryAction.label}</a></Button>.
- L'en-tête reste visible au défilement (sticky top-0 z-40 avec un fond du thème et bordure subtile border-b).
- Les langues : \`import LanguageSwitcher from '@/components/site/language-switcher'\` → \`<LanguageSwitcher current={current} />\`, à côté de l'action principale et dans le <Sheet> mobile. Pose-le toujours : il ne s'affiche que si le site a plusieurs langues${ctx.languages && ctx.languages.length > 1 ? ` (c'est le cas : ${ctx.languages.join(', ')})` : ''}.

Réponds avec le fichier complet, et rien d'autre.`;
}

export function footerPrompt(ctx: AuthoringContext, request: string): string {
  return `${projectBlock(ctx, request)}

# Ta tâche
Écris le pied de page du site : src/components/site/SiteFooter.tsx
Signature exacte : \`export default function SiteFooter()\`.
Ce qu'il montre : ${ctx.manifest.footer || 'la marque, les pages et les coordonnées.'}
- La marque : <BrandMark /> (\`import BrandMark from '@/site/brand'\`, qui affiche déjà le logo ou le nom) et une phrase tirée de site.description.
- Les liens : site.pages.
- Les coordonnées réelles : site.contact.channels (affiche la valeur, avec son lien href).
- La mention : © {site.year} {site.name}.

Réponds avec le fichier complet, et rien d'autre.`;
}

/* -------------------------------------------------------------------------- */
/*  Appel                                                                      */
/* -------------------------------------------------------------------------- */

export interface Authored {
  code: string;
  /** Le fichier se compile et n'importe que ce qui existe. */
  valid: boolean;
  /** Les problèmes du dernier essai, s'il n'est pas valide. */
  problems: string[];
  /** Affirmations absentes des faits restées dans le fichier, à vérifier. */
  unverified: string[];
  /** Affirmations retirées par le code au dernier recours. */
  removed: string[];
  providerDown: boolean;
}

export interface ReviewContext {
  policy: ImportPolicy;
  check: FactCheck;
  /** Les faits et la demande, en clair : un nom propre qui n'y figure pas est inventé. */
  reference: string;
  /** Les couleurs du thème compilé, pour remplacer les couleurs écrites en dur. */
  theme: ThemeColors;
  /**
   * Les fichiers du site propres au projet (design system, `src/site/*`), lus
   * au moment de la vérification : le composant y est monté pour de vrai.
   * Absent : pas de vérification d'exécution.
   */
  siteFiles?: () => Record<string, string>;
}

/** Le composant vérifié : son chemin dans le projet et les props que la page lui passe. */
export interface ReviewTarget {
  path: string;
  props?: Record<string, unknown>;
}

export interface Review {
  /** Le code après correction automatique. */
  code: string;
  /** Problèmes de forme restants (le fichier ne peut pas être affiché). */
  problems: string[];
  /** Affirmations absentes des faits. */
  invented: string[];
  /** Monté avec les données du site, il n'affiche rien (rend null ou un conteneur vide). */
  empty: boolean;
  fixes: string[];
}

/**
 * Corrige ce qui est mécanique, puis vérifie la forme, l'exécution et les
 * faits. L'exécution : le composant est monté dans un DOM avec les fichiers
 * réels du site — un plantage qu'esbuild ne voit pas (donnée nulle, enfant
 * multiple d'un `asChild`, composant hors de son parent) est un problème de
 * forme comme un autre.
 */
export async function reviewComponent(raw: string, ctx: ReviewContext, target?: ReviewTarget): Promise<Review> {
  const corrected = autocorrect(extractCode(raw), ctx.theme);
  // Les marques d'un site « généré » (émojis, dégradés, effet verre…) : retirées par le code, comme partout.
  const slop = cleanSlop(corrected.code);
  if (slop.fixes.length) corrected.fixes = [...corrected.fixes, ...slop.fixes];
  corrected.code = slop.code;
  const problems = await checkComponent(corrected.code, ctx.policy);
  if (problems.length) return { code: corrected.code, problems, invented: [], empty: false, fixes: corrected.fixes };
  const runtime =
    target && ctx.siteFiles
      ? await renderCheck({ path: target.path, code: corrected.code, files: ctx.siteFiles(), props: target.props })
      : { problems: [], empty: false };
  if (runtime.problems.length) return { code: corrected.code, problems: runtime.problems, invented: [], empty: false, fixes: corrected.fixes };
  const texts = visibleTexts(corrected.code);
  const invented = Array.from(new Set([...ctx.check({ texts }), ...inventedNames(texts, ctx.reference)]));
  return { code: corrected.code, problems: [], invented, empty: runtime.empty, fixes: corrected.fixes };
}

/**
 * Le dernier recours sur les faits : les phrases fautives retirées par le
 * code. Rendu seulement si le fichier se compile et s'affiche encore.
 */
export async function withoutClaims(review: Review, ctx: ReviewContext, target?: ReviewTarget): Promise<Review> {
  if (!review.invented.length) return review;
  const stripped = stripClaims(review.code, review.invented);
  const again = await reviewComponent(stripped, ctx, target);
  return again.problems.length ? review : again;
}

/**
 * La consigne d'un nouvel essai : la version du modèle et la liste exacte de
 * ce qu'il doit corriger. Il corrige SA version au lieu d'en écrire une
 * autre — c'est ce qui fait converger un petit modèle.
 */
export function repairReminder(code: string, items: string[], kind: 'form' | 'facts' | 'empty'): string {
  const list =
    kind === 'form'
      ? items.map((item) => `- ${item}`).join('\n')
      : kind === 'empty'
        ? "- Monté avec les données de ce site, le composant n'affiche rien (il rend null ou un conteneur vide, par exemple parce qu'une liste de `site` est vide pour ce projet). Il doit afficher son contenu : écris-le à partir de la description du projet, sans inventer de prix, de personnes ni de coordonnées, et n'affiche une liste de `site` que si elle a des éléments."
        : `- Retire ces éléments, absents des informations du projet, sans les remplacer par d'autres affirmations : ${items
          .map((item) => `« ${item} »`)
          .join(', ')}.\n- Un prix, un numéro, une adresse ou un lien vient de \`site\` (@/site/data) : affiche la donnée, ne l'écris pas en dur.`;
  return `# Ta version précédente
\`\`\`tsx
${code.trim()}
\`\`\`

# À corriger, et rien d'autre
${list}

Garde tout le reste à l'identique. Renvoie le fichier .tsx complet, et rien d'autre.`;
}

/** Fait écrire un composant : correction automatique, vérification, essais ciblés. */
export async function authorComponent(options: {
  caller: ModelCaller;
  label: string;
  system: string;
  prompt: string;
  review: ReviewContext;
  language: string;
  /** Le fichier et ses props, pour le monter avec les données du site. */
  target?: ReviewTarget;
}): Promise<Authored> {
  const { caller, label, system, prompt, review: ctx, target } = options;
  let last: Review | null = null;

  const judge = async (text: string): Promise<Verdict<Review>> => {
    const review = await reviewComponent(text, ctx, target);
    last = review;
    if (review.fixes.length) ChatLogger.info('SITE_AUTOCORRECT', `${label} : ${review.fixes.length} correction(s)`, { fixes: review.fixes.slice(0, 12) });
    if (review.problems.length || review.invented.length) {
      ChatLogger.info('SITE_REVIEW', `${label} : à corriger`, { problems: review.problems, invented: review.invented });
    }
    if (review.problems.length) return { problem: repairReminder(review.code, review.problems, 'form') };
    if (review.invented.length) {
      return {
        problem: repairReminder(review.code, review.invented, 'facts'),
        // Essais épuisés : le fichier se compile ; le code retire les phrases fautives.
        salvage: () => review,
      };
    }
    if (review.empty) {
      ChatLogger.info('SITE_REVIEW', `${label} : n'affiche rien avec les données du site`);
      // Essais épuisés : il ne plante pas ; mieux vaut l'accepter que le perdre.
      return { problem: repairReminder(review.code, [], 'empty'), salvage: () => review };
    }
    return { value: review };
  };

  // 1. Écriture, puis corrections ciblées de SA version (quatre essais, modèles de repli compris).
  let outcome = await caller.call<Review>(label, system, prompt, judge, 8000, 0.6, 4);

  // 2. Toujours inutilisable : une version neuve, écrite de zéro. Un modèle
  //    enfermé dans sa première version en sort rarement en la corrigeant ;
  //    il réussit souvent en recommençant, prévenu de ce qui a bloqué.
  if (!outcome.value && !outcome.providerDown) {
    const blocked = (last as Review | null)?.problems ?? [];
    ChatLogger.warn('SITE_REVIEW', `${label} : réécriture complète`, { problems: blocked });
    outcome = await caller.call<Review>(
      `${label} (réécriture)`,
      system,
      `${prompt}\n\n# Attention\nUne première version a échoué sur ces points ; ne les reproduis pas :\n${blocked.map((item) => `- ${item}`).join('\n')}\nÉcris une version plus simple si nécessaire : elle doit se compiler, n'importer que ce qui existe et s'afficher sans planter avec les données de ce site.`,
      judge,
      8000,
      0.4,
      3
    );
  }

  if (outcome.value) {
    // Les affirmations non vérifiées qui resteraient sont retirées, sans rien signaler.
    const final = outcome.value.invented.length ? await withoutClaims(outcome.value, ctx, target) : outcome.value;
    const removed = outcome.value.invented.filter((item) => !final.invented.includes(item));
    if (final.invented.length) ChatLogger.info('SITE_REVIEW', `${label} : affirmations conservées (retrait impossible)`, { items: final.invented });
    return { code: final.code, valid: true, problems: [], unverified: [], removed, providerDown: false };
  }
  const kept = last as Review | null;
  return {
    code: kept?.code ?? '',
    valid: false,
    problems: kept?.problems ?? [],
    unverified: [],
    removed: [],
    providerDown: outcome.providerDown,
  };
}
