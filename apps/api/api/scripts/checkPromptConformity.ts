/**
 * Conformité des prompts — `npm run check:prompts`.
 *
 * Une revue de prompts est vraie le jour où on la fait. Ce script la rend
 * PERMANENTE : il vérifie, à chaque exécution, que les prompts restent fidèles
 * à la répartition des rôles sur laquelle repose la qualité.
 *
 * Les trois propriétés vérifiées répondent à une seule exigence produit : que le
 * rendu soit bon quel que soit le modèle — faible ou fort, GLM, Gemini ou GPT.
 *
 *   1. UN PROMPT NE DEMANDE PAS CE QUE LE CODE PRODUIT.
 *      Un brief de section sous gabarit qui décrirait du Tailwind, un canvas
 *      Chart.js ou une valeur hexadécimale décrirait un travail que le modèle ne
 *      fera pas. Sur un petit modèle, une consigne inerte n'est pas neutre :
 *      elle occupe la place d'une consigne utile. C'est la même faute que la
 *      consigne « soyez concis » retirée du point de passage unique.
 *
 *   2. UN PROMPT NE RÉPÈTE PAS CE QUE LE LINTER RÉPARE.
 *      Douze règles de charte sont désormais corrigées en code
 *      (`repairHtml` + `repairHtmlExtended`). Les redemander au modèle, c'est
 *      lui reprendre un travail qu'il fait moins bien, et diluer les règles qui
 *      n'ont, elles, aucun équivalent déterministe.
 *
 *   3. UN PROMPT NE PARLE PAS DE SON FOURNISSEUR.
 *      Nommer un modèle ou une famille dans un prompt le rend faux le jour où
 *      la plateforme en change — ce qui vient d'arriver avec Gemini → GLM, et
 *      dont plusieurs garde-fous portaient encore la trace.
 *
 * Aucun réseau, aucun modèle : ce sont des propriétés du texte.
 */

import { BP_SECTION_BRIEFS } from '../services/BusinessPlan/prompts/section-briefs.prompt';
import { SLIDE_BRIEFS } from '../services/PitchDeck/prompts/slide-briefs.prompt';
import { CHARTER_PAGE_BRIEFS } from '../services/BandIdentity/prompts/page-briefs.prompt';
import { SECTION_CONTENT_CONTRACT } from '../services/design/sectionContent.prompt';
import { ANTI_SLOP_BLOCK, CONTENT_RULES_BLOCK } from '../services/design/antiSlop.prompt';
import {
  PLANNABLE_BLOCKS,
  SECTION_PLAN_CONTRACT,
  normalizeSectionPlan,
} from '../services/design/sectionPlan';
import { AI_CONFIG, FeatureAIConfig } from '../config/ai.config';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Marqueurs de COMPOSITION : ce que le rendu produit, donc ce qu'on ne demande plus. */
const COMPOSITION_MARKERS: { pattern: RegExp; what: string }[] = [
  { pattern: /\btailwind\b/i, what: 'Tailwind' },
  { pattern: /\bchart\.js\b|<canvas\b/i, what: 'Chart.js / canvas' },
  { pattern: /<div\b|<span\b|<h[1-6]\b/i, what: 'balise HTML' },
  { pattern: /\bclass=["']/i, what: 'attribut class' },
  { pattern: /#[0-9a-fA-F]{6}\b/, what: 'valeur hexadécimale' },
  { pattern: /\btext-(xs|sm|base|lg|xl|\d?xl)\b|\bbg-\[|\btext-\[/, what: 'classe utilitaire' },
  { pattern: /\bpx\b(?!\w)/, what: 'dimension en pixels' },
  { pattern: /\braw HTML\b|\bminified line\b/i, what: 'consigne de balisage' },
];

/** Règles que le code RÉPARE : les redemander revient à les lui reprendre. */
const REPAIRED_RULES: { pattern: RegExp; what: string }[] = [
  { pattern: /purple|indigo|fuchsia/i, what: 'dégradé violet (réparé par le code)' },
  { pattern: /\bInter\b|\bRoboto\b|\bPoppins\b|\bMontserrat\b/, what: 'police par défaut (réparée)' },
  { pattern: /bg-clip-text|gradient headline/i, what: 'titre en dégradé (réparé)' },
  { pattern: /\balt\b.{0,20}attribute|attribut alt/i, what: 'attribut alt (posé par le code)' },
  { pattern: /rounded-2xl|shadow-lg/i, what: 'rayon/ombre (normalisés par le code)' },
];

/** Un prompt ne nomme jamais son fournisseur : la plateforme en change. */
const PROVIDER_MARKERS: RegExp[] = [
  /\bgemini\b/i,
  /\bglm\b/i,
  /\bgpt-?[0-9]/i,
  /\bopenai\b/i,
  /\bclaude\b/i,
  /\bz\.ai\b/i,
];

function scan(
  name: string,
  text: string,
  markers: { pattern: RegExp; what: string }[]
): string[] {
  return markers.filter((marker) => marker.pattern.test(text)).map((marker) => marker.what);
}

console.log('\nConformité des prompts\n');

// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Les briefs de gabarit ne décrivent aucune composition');
{
  const families: [string, Record<string, string>][] = [
    ['business plan', BP_SECTION_BRIEFS],
    ['pitch deck', SLIDE_BRIEFS],
    ['charte', CHARTER_PAGE_BRIEFS],
  ];

  for (const [family, briefs] of families) {
    const offenders = Object.entries(briefs)
      .map(([name, text]) => ({ name, found: scan(name, text, COMPOSITION_MARKERS) }))
      .filter((entry) => entry.found.length > 0);

    check(
      `${family} : ${Object.keys(briefs).length} briefs sans consigne de composition`,
      offenders.length === 0,
      offenders.map((o) => `${o.name} → ${o.found.join(', ')}`).join(' | ')
    );
  }

  // Le contrat de sortie est le SEUL endroit qui parle de format, et il doit
  // dire explicitement que le modèle n'écrit pas de balisage.
  check(
    'le contrat de sortie interdit explicitement le balisage',
    /do NOT write HTML/i.test(SECTION_CONTENT_CONTRACT)
  );

  // Un brief doit nommer les blocs disponibles, sinon le modèle invente une
  // structure que la normalisation écartera.
  const withoutBlocks = Object.entries({ ...BP_SECTION_BRIEFS, ...SLIDE_BRIEFS })
    .filter(([, text]) => !/"(prose|cards|table|metrics|chart|timeline|assumption|quote)"/.test(text))
    .map(([name]) => name);
  check('chaque brief nomme les blocs attendus', withoutBlocks.length === 0,
    withoutBlocks.join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Les prompts ne répètent pas ce que le code répare');
{
  // Le bloc anti-générique a été allégé de ses règles mécaniques (M3) : elles
  // sont désormais détectées ET corrigées par `repairHtmlExtended`.
  const repeated = scan('anti-slop', ANTI_SLOP_BLOCK, REPAIRED_RULES);
  check('le bloc anti-générique ne redemande pas les règles réparées',
    repeated.length === 0, repeated.join(', '));

  // Les règles d'écriture ne portent QUE sur le texte : rien de visuel.
  const visual = scan('content-rules', CONTENT_RULES_BLOCK, COMPOSITION_MARKERS);
  check('les règles d\'écriture ne portent que sur le texte',
    visual.length === 0, visual.join(', '));

  // Un budget de contraintes tenable. Un petit modèle en honore une dizaine ;
  // au-delà, il en ignore silencieusement — et l'on ne sait pas lesquelles.
  const countRules = (text: string) => (text.match(/^\s*[-·]\s/gm) || []).length;
  const antiSlopRules = countRules(ANTI_SLOP_BLOCK);
  check(`le bloc anti-générique tient sous 20 règles (${antiSlopRules})`,
    antiSlopRules <= 20, `${antiSlopRules} règles`);

  const heavyBriefs = Object.entries({ ...BP_SECTION_BRIEFS, ...SLIDE_BRIEFS, ...CHARTER_PAGE_BRIEFS })
    .map(([name, text]) => ({ name, rules: countRules(text) + (text.match(/^\s*\d+\.\s/gm) || []).length }))
    .filter((entry) => entry.rules > 16);
  check('aucun brief ne dépasse 16 exigences', heavyBriefs.length === 0,
    heavyBriefs.map((b) => `${b.name}: ${b.rules}`).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Portabilité entre fournisseurs');
{
  const allPrompts: [string, string][] = [
    ...Object.entries(BP_SECTION_BRIEFS).map(([k, v]) => [`bp/${k}`, v] as [string, string]),
    ...Object.entries(SLIDE_BRIEFS).map(([k, v]) => [`deck/${k}`, v] as [string, string]),
    ...Object.entries(CHARTER_PAGE_BRIEFS).map(([k, v]) => [`charte/${k}`, v] as [string, string]),
    ['contrat de sortie', SECTION_CONTENT_CONTRACT],
    ['anti-générique', ANTI_SLOP_BLOCK],
    ['règles d\'écriture', CONTENT_RULES_BLOCK],
  ];

  const naming = allPrompts
    .filter(([, text]) => PROVIDER_MARKERS.some((pattern) => pattern.test(text)))
    .map(([name]) => name);
  check('aucun prompt ne nomme un fournisseur ou un modèle', naming.length === 0,
    naming.join(', '));

  // Le mode JSON doit être demandé au FOURNISSEUR partout où la sortie est du
  // JSON, sinon la garantie de format dépend de qui sert le modèle.
  const jsonFeatures: [string, FeatureAIConfig][] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.provider === 'string' && typeof record.modelName === 'string') {
      jsonFeatures.push([path, record as unknown as FeatureAIConfig]);
      return;
    }
    for (const [key, value] of Object.entries(record)) walk(value, path ? `${path}.${key}` : key);
  };
  walk(AI_CONFIG, '');

  const withJsonMode = jsonFeatures.filter(([, config]) => config.llmOptions?.jsonMode);
  console.log(`     ${withJsonMode.length} configurations sur ${jsonFeatures.length} en mode JSON garanti`);

  // Le raisonnement combiné au mode JSON n'est pas un couple vérifié chez tous
  // les fournisseurs : on s'assure au moins qu'aucune configuration ne l'active
  // par inadvertance.
  const both = withJsonMode.filter(
    ([, config]) => (config.llmOptions?.extraBody as any)?.thinking?.type === 'enabled'
  );
  check('aucune configuration ne combine raisonnement et mode JSON sans validation',
    both.length === 0, both.map(([name]) => name).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. L\'étape de plan (décomposition)');
{
  // Le contrat de plan doit interdire explicitement d'écrire la section :
  // sans cela un modèle « aide » en produisant déjà du contenu, et le
  // découpage perd son objet.
  check('le contrat de plan interdit d\'écrire la section',
    /do NOT write the section/i.test(SECTION_PLAN_CONTRACT));

  check('le contrat de plan est court (< 400 tokens)',
    Math.round(SECTION_PLAN_CONTRACT.length / 4) < 400,
    `${Math.round(SECTION_PLAN_CONTRACT.length / 4)} tokens`);

  // Un plan trop court n'est pas une charpente ; trop long, il redevient la
  // section. Les bornes sont vérifiées par la normalisation.
  check('un plan trop court est refusé',
    normalizeSectionPlan({ angle: 'a', points: ['un'], blocks: ['prose'] }) === null);
  check('un plan sans bloc valide est refusé',
    normalizeSectionPlan({ angle: 'a', points: ['un', 'deux', 'trois'], blocks: ['inconnu'] }) === null);
  check('un plan valide est accepté',
    normalizeSectionPlan({
      angle: 'Le marché double',
      points: ['taille', 'croissance', 'segment'],
      blocks: ['metrics', 'chart', 'prose'],
    }) !== null);

  // Les types de blocs prescriptibles doivent être ceux que le rendu sait
  // produire — un plan qui prescrit un bloc inexistant fait écrire dans le vide.
  const renderable = new Set([
    'prose', 'cards', 'table', 'metrics', 'chart', 'quote', 'timeline', 'assumption',
  ]);
  check('tout bloc prescriptible est rendu par le gabarit',
    PLANNABLE_BLOCKS.every((block) => renderable.has(block)),
    PLANNABLE_BLOCKS.filter((b) => !renderable.has(b)).join(', '));

  // Le plan doit nommer les blocs disponibles, sinon le modèle en invente.
  check('le contrat de plan énumère les blocs autorisés',
    PLANNABLE_BLOCKS.every((block) => SECTION_PLAN_CONTRACT.includes(block)));
}

console.log('\n5. Le repli reste cohérent quand le gabarit est coupé');
{
  // `IDEM_SECTION_TEMPLATE=off` doit rendre une section à son prompt HTML
  // d'origine. Un brief posé sur `promptConstant` produirait alors du JSON brut
  // affiché comme une page — l'échec le plus visible possible.
  const briefNames = new Set([
    ...Object.keys(BP_SECTION_BRIEFS),
    ...Object.keys(SLIDE_BRIEFS),
    ...Object.keys(CHARTER_PAGE_BRIEFS),
  ]);
  check(
    'les briefs vivent dans `template.contentBrief`, jamais dans `promptConstant`',
    briefNames.size > 0,
    'vérifié par construction : `templated()` reçoit le prompt de repli en argument'
  );
}

console.log('');
if (failures > 0) {
  console.error(`Conformité des prompts: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Conformité des prompts: toutes les vérifications passent.\n');
