/**
 * Conformité des prompts — `npm run check:prompts`.
 *
 * Une revue de prompts est vraie le jour où on la fait. Ce script la rend
 * PERMANENTE : il vérifie, à chaque exécution, que les prompts restent fidèles
 * à la répartition des rôles sur laquelle repose la qualité.
 *
 * Les trois propriétés vérifiées répondent à une seule exigence produit : que le
 * rendu soit bon quel que soit le modèle — faible ou fort, Qwen, DeepSeek ou autre.
 *
 *   1. UN PROMPT NE DEMANDE PAS CE QUE LE CODE PRODUIT.
 *      Toutes les pages sont composées par le moteur graphique
 *      (@idem/graphic-engine) : un brief qui décrirait du Tailwind, un canvas
 *      Chart.js ou une valeur hexadécimale décrirait un travail que le modèle ne
 *      fera pas. Sur un petit modèle, une consigne inerte n'est pas neutre :
 *      elle occupe la place d'une consigne utile.
 *
 *   2. UN PROMPT NE RÉPÈTE PAS CE QUE LE MOTEUR GARANTIT.
 *      Couleurs, polices, rayons, contrastes, logo, texte alternatif : le moteur
 *      les pose lui-même. Les redemander au modèle, c'est diluer les règles qui
 *      n'ont, elles, aucun équivalent déterministe — celles du TEXTE.
 *
 *   3. UN PROMPT NE PARLE PAS DE SON FOURNISSEUR.
 *      Nommer un modèle ou une famille dans un prompt le rend faux le jour où
 *      la plateforme en change — ce qui est arrivé plusieurs fois, et dont
 *      plusieurs garde-fous portaient encore la trace.
 *
 * Aucun réseau, aucun modèle : ce sont des propriétés du texte.
 */

import {
  BLOCKS_BY_DELIVERABLE,
  contentContract,
  normalizeSectionPlan,
  sectionPlanContract,
  volumeDirective,
  WRITING_RULES,
  MODEL_BLOCK_KINDS,
} from '@idem/graphic-engine';
import { BP_SECTION_BRIEFS } from '../services/BusinessPlan/prompts/section-briefs.prompt';
import {
  DECK_READER_FRAMES,
  SLIDE_BRIEFS,
} from '../services/PitchDeck/prompts/slide-briefs.prompt';
import { PITCH_DECK_SLIDE_CATALOG } from '../services/PitchDeck/deck-types';
import {
  CHARTER_PAGE_BRIEFS,
  CHARTER_PAGE_HEADINGS,
} from '../services/BandIdentity/prompts/page-briefs.prompt';
import {
  MOCKUP_GENERATION_PROMPT,
  TEXT_INVITING_WORDS,
} from '../services/BandIdentity/prompts/mockup-generation.prompt';
import { INDUSTRY_MOCKUP_CATEGORIES, MOCKUP_CONFIG, supportScene } from '../config/mockup.config';
import { mockupAnalyzerService } from '../services/BandIdentity/mockupAnalyzer.service';
import { AI_CONFIG, FeatureAIConfig } from '../config/ai.config';
import { buildBusinessPlanSpec } from '../services/BusinessPlan/businessPlanSpec';
import { BUSINESS_PLAN_SECTION_CATALOG } from '../services/BusinessPlan/structure/section-catalog';
import { SECTION_PROMPT_SPECS } from '../services/BusinessPlan/prompts/section-prompt.registry';
import { BUSINESS_PLAN_TEMPLATES } from '../services/BusinessPlan/structure/templates';

/** Les trois livrables rédigés par sections, et leur contrat de sortie. */
const DELIVERABLES = ['business-plan', 'pitch-deck', 'brand-charter'] as const;
const CONTRACTS = DELIVERABLES.map((deliverable) => [deliverable, contentContract({ deliverable })] as const);

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

/** Ce que le moteur GARANTIT : le redemander revient à le reprendre au code. */
const REPAIRED_RULES: { pattern: RegExp; what: string }[] = [
  { pattern: /purple|indigo|fuchsia/i, what: 'dégradé violet (le moteur ne pose que la charte)' },
  { pattern: /\bInter\b|\bRoboto\b|\bPoppins\b|\bMontserrat\b/, what: 'police (posée par le moteur)' },
  { pattern: /bg-clip-text|gradient headline/i, what: 'titre en dégradé (jamais produit)' },
  { pattern: /\balt\b.{0,20}attribute|attribut alt/i, what: 'attribut alt (posé par le moteur)' },
  { pattern: /rounded-2xl|shadow-lg|\bWCAG\b|ensure (?:enough |sufficient |a )?(?:readable )?contrast/i, what: 'rayon, ombre, contraste (garantis par le moteur)' },
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
    // Le cadre de lecture de chaque type de deck part avec chaque brief.
    ['pitch deck (cadres de lecture)', DECK_READER_FRAMES],
    ['charte', CHARTER_PAGE_BRIEFS],
  ];

  // Une slide sous gabarit sans brief retomberait sur son prompt HTML sans que
  // rien ne le signale : chaque slide du catalogue, hors couverture, a le sien.
  const slidesWithoutBrief = PITCH_DECK_SLIDE_CATALOG.filter(
    (slide) => !slide.freeform && !SLIDE_BRIEFS[slide.name]
  ).map((slide) => slide.name);
  check(
    'chaque slide du catalogue des decks a son brief de contenu',
    slidesWithoutBrief.length === 0,
    slidesWithoutBrief.join(', ')
  );

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
  for (const [deliverable, contract] of CONTRACTS) {
    check(`${deliverable} : le contrat de sortie interdit explicitement le balisage`, /do NOT write HTML/i.test(contract));
  }

  // Un brief doit nommer les blocs disponibles, sinon le modèle invente une
  // structure que la normalisation écartera.
  const blockName = new RegExp(`"(${BLOCKS_BY_DELIVERABLE['business-plan'].join('|')})"`);
  const withoutBlocks = Object.entries({ ...BP_SECTION_BRIEFS, ...SLIDE_BRIEFS })
    .filter(([, text]) => !blockName.test(text))
    .map(([name]) => name);
  check('chaque brief nomme les blocs attendus', withoutBlocks.length === 0,
    withoutBlocks.join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Les prompts ne répètent pas ce que le moteur garantit');
{
  const guaranteed = scan('writing-rules', WRITING_RULES, REPAIRED_RULES);
  check('les règles d\'écriture ne redemandent rien de ce que le moteur pose',
    guaranteed.length === 0, guaranteed.join(', '));

  // Les règles d'écriture ne portent QUE sur le texte : rien de visuel.
  const visual = scan('writing-rules', WRITING_RULES, COMPOSITION_MARKERS);
  check('les règles d\'écriture ne portent que sur le texte',
    visual.length === 0, visual.join(', '));

  // Un budget de contraintes tenable. Un petit modèle en honore une dizaine ;
  // au-delà, il en ignore silencieusement — et l'on ne sait pas lesquelles.
  const countRules = (text: string) => (text.match(/^\s*[-·]\s/gm) || []).length;
  const writingRules = countRules(WRITING_RULES);
  check(`les règles d'écriture tiennent sous 12 interdits (${writingRules})`, writingRules <= 12, `${writingRules} règles`);
  for (const [deliverable, contract] of CONTRACTS) {
    check(`${deliverable} : le contrat de sortie tient sous 10 règles`, countRules(contract) <= 10, `${countRules(contract)} règles`);
  }

  const heavyBriefs = Object.entries({ ...BP_SECTION_BRIEFS, ...SLIDE_BRIEFS, ...CHARTER_PAGE_BRIEFS })
    .map(([name, text]) => ({ name, rules: countRules(text) + (text.match(/^\s*\d+\.\s/gm) || []).length }))
    .filter((entry) => entry.rules > 16);
  check('aucun brief ne dépasse 16 exigences', heavyBriefs.length === 0,
    heavyBriefs.map((b) => `${b.name}: ${b.rules}`).join(', '));

  // UNE consigne de volume, exprimée en blocs : deux nombres contradictoires se départagent par un entre-deux.
  const volume = volumeDirective('3 to 4');
  check('la consigne de volume est en blocs, et autorise à s\'arrêter quand la matière manque', /3 to 4 blocks/.test(volume) && /STOP/.test(volume));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Portabilité entre fournisseurs');
{
  const allPrompts: [string, string][] = [
    ...Object.entries(BP_SECTION_BRIEFS).map(([k, v]) => [`bp/${k}`, v] as [string, string]),
    ...Object.entries(SLIDE_BRIEFS).map(([k, v]) => [`deck/${k}`, v] as [string, string]),
    ...Object.entries(CHARTER_PAGE_BRIEFS).map(([k, v]) => [`charte/${k}`, v] as [string, string]),
    ...CONTRACTS.map(([deliverable, contract]) => [`contrat de sortie (${deliverable})`, contract] as [string, string]),
    ...DELIVERABLES.map((deliverable) => [`contrat de plan (${deliverable})`, sectionPlanContract(deliverable)] as [string, string]),
    ['règles d\'écriture', WRITING_RULES],
    ['consigne de volume', volumeDirective('2')],
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
  for (const deliverable of DELIVERABLES) {
    const contract = sectionPlanContract(deliverable);
    // Le contrat de plan doit interdire explicitement d'écrire la section :
    // sans cela un modèle « aide » en produisant déjà du contenu, et le
    // découpage perd son objet.
    check(`${deliverable} : le contrat de plan interdit d'écrire la section`, /do NOT write the section/i.test(contract));
    check(`${deliverable} : le contrat de plan est court (< 400 tokens)`, Math.round(contract.length / 4) < 400, `${Math.round(contract.length / 4)} tokens`);
    // Le plan doit nommer les blocs disponibles, sinon le modèle en invente.
    const plannable = BLOCKS_BY_DELIVERABLE[deliverable];
    check(`${deliverable} : le contrat de plan énumère les blocs autorisés`, plannable.every((block) => contract.includes(block)));
    // Les types de blocs prescriptibles doivent être ceux que le contrat de contenu connaît — un plan qui
    // prescrit un bloc inconnu fait écrire dans le vide.
    const orphan = plannable.filter((block) => !MODEL_BLOCK_KINDS.has(block));
    check(`${deliverable} : tout bloc prescriptible est un bloc du contrat de contenu`, orphan.length === 0, orphan.join(', '));
    // Et le contrat de sortie montre la forme de chacun : un bloc prescrit sans exemple est un bloc mal rempli.
    const contractText = contentContract({ deliverable });
    const undocumented = plannable.filter((block) => !contractText.includes(`"kind":"${block}"`));
    check(`${deliverable} : le contrat de sortie montre la forme de chaque bloc prescriptible`, undocumented.length === 0, undocumented.join(', '));
  }

  // Un plan trop court n'est pas une charpente ; trop long, il redevient la
  // section. Les bornes sont vérifiées par la normalisation.
  check('un plan trop court est refusé',
    normalizeSectionPlan({ angle: 'a', points: ['un'], blocks: ['prose'] }, 'business-plan') === null);
  check('un plan sans bloc valide est refusé',
    normalizeSectionPlan({ angle: 'a', points: ['un', 'deux', 'trois'], blocks: ['inconnu'] }, 'business-plan') === null);
  check('un bloc hors du livrable est écarté (pas de graphique dans une charte)',
    normalizeSectionPlan({ angle: 'a', points: ['un', 'deux', 'trois'], blocks: ['chart'] }, 'brand-charter') === null);
  check('un plan valide est accepté',
    normalizeSectionPlan({
      angle: 'Le marché double',
      points: ['taille', 'croissance', 'segment'],
      blocks: ['metrics', 'chart', 'prose'],
    }, 'business-plan') !== null);
}

// ── DEUX ORDRES CONTRADICTOIRES ─────────────────────────────────────────────
//
// Ce défaut est apparu TROIS FOIS dans des endroits sans rapport : la couverture
// du business plan (« produis du HTML » + « produis du JSON »), les sections de
// recherche, et les mises en situation (« support VIERGE, aucun logo » + « pose
// le logo joint »). À chaque fois le modèle suivait la consigne la plus longue
// et la plus répétée, et à chaque fois le symptôme observé était tout autre :
// page perdue, page en JSON brut, mockup sans logo.
//
// La leçon est mécanique : quand un prompt est PARTAGÉ entre deux chemins qui
// n'attendent pas la même sortie, il faut deux textes, pas une rustine ajoutée
// en aval. On le vérifie ici.
console.log('\n  Consignes contradictoires');

{
  const support: any = {
    supportType: 't', supportName: 'n', context: 'c', industryContext: 'i',
    mockupIndex: 1, priority: 1, examples: ['a'],
  };
  // Le chemin « logo joint » a été retiré : le modèle d'image redessinait le
  // logo au lieu de le poser. Il ne reste qu'une consigne — support NU, logo
  // incrusté après — et aucun mot qui invite à écrire ne doit l'atteindre, pas
  // même nié : le modèle écrivait un nom sur le support (« LIGGTH » pour la
  // marque Light, tiré de « side light »), et le vrai logo se posait dessus.
  const base: any = {
    brandColors: { primary: '#111111', secondary: '#222222', accent: '#333333' },
    selectedSupport: { ...support, supportType: 'shopping_bags' },
    brandName: 'Kora',
    artDirectionModifier: 'Kora signature warmth, soft side light, bold typography accents, matte grain',
    artDirectionNegative: 'distorted text, neon glow',
    imagerySubjects: 'Les torréfacteurs de Kora au travail, mains et grains de café',
  };

  const blank = MOCKUP_GENERATION_PROMPT.buildDynamicPrompt(base);
  const imagery = MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
    ...base,
    selectedSupport: { ...support, supportType: 'brand_imagery', skipLogo: true },
  });

  check(
    "mockup : aucun mot qui invite à écrire n'atteint le modèle d'image",
    !TEXT_INVITING_WORDS.test(blank) && !TEXT_INVITING_WORDS.test(imagery),
    [blank.match(TEXT_INVITING_WORDS)?.[0], imagery.match(TEXT_INVITING_WORDS)?.[0]].filter(Boolean).join(', ')
  );
  check("mockup : le nom de la marque n'atteint pas le modèle d'image", !/Kora/i.test(blank) && !/Kora/i.test(imagery));
  check(
    "mockup : la direction artistique garde ce qui décrit l'image",
    /soft side light/.test(blank) && /matte grain/.test(blank) && /neon glow/.test(blank)
  );
  check('mockup : la scène vient du support', /paper shopping bag/.test(blank));
  check(
    'univers visuel : aucune face réservée au logo',
    /hero object faces the camera/.test(blank) && !/hero object faces the camera/.test(imagery)
  );
  check('mockup : un prompt court', blank.length < 1500, `${blank.length} caractères`);
  check('vision : relève les lettres et les marques', /"markings"/.test(MOCKUP_GENERATION_PROMPT.sceneReadingVision));
  // L'exemple chiffré de l'ancienne consigne était recopié tel quel : le logo
  // tombait au même endroit sur chaque photo.
  check('vision : aucun exemple chiffré à recopier', !/\d\.\d/.test(MOCKUP_GENERATION_PROMPT.sceneReadingVision));
  // En fractions sans exemple, la vision rendait des zéros : la zone est une
  // boîte en coordonnées 0–1000, que \`parseBrandingZone\` lit.
  check('vision : zone rendue en boîte 0–1000', /"box": \[x1, y1, x2, y2\]/.test(MOCKUP_GENERATION_PROMPT.sceneReadingVision) && /from 0 to 1000/.test(MOCKUP_GENERATION_PROMPT.sceneReadingVision));

  // Aucun secteur ne met en scène un support qui porte des mots, et chacun en
  // trouve assez pour la charte.
  for (const [industry, categories] of Object.entries(INDUSTRY_MOCKUP_CATEGORIES)) {
    const selected: { supportType: any }[] = (mockupAnalyzerService as any).selectSupports(
      categories,
      industry,
      { keywords: [], emphasis: [], scale: 'small' },
      MOCKUP_CONFIG.MOCKUP_COUNT
    );
    check(
      `mockup : ${industry} met en scène ${MOCKUP_CONFIG.MOCKUP_COUNT} supports nus`,
      selected.length === MOCKUP_CONFIG.MOCKUP_COUNT && selected.every((entry) => Boolean(supportScene(entry.supportType))),
      selected.map((entry) => entry.supportType).join(', ')
    );
  }
}

// ── L'ÉQUIPE DE RECHERCHE REÇOIT LE MÊME BRIEF QUE LE GABARIT ───────────────
//
// Quatrième occurrence du défaut décrit juste au-dessus, et la plus coûteuse :
// `buildBusinessPlanSpec` passait au rédacteur les prompts `agent-*` d'origine,
// dont les `<technical_rules>` exigent « raw HTML + Tailwind on a single
// minified line ». Le contrat de contenu structuré était ajouté APRÈS, dans le
// même message. Le modèle rendait du HTML, `parseLlmJson` échouait, et la
// section était abandonnée : sur un plan livré, « Opportunity » et « Target
// Audience » manquaient — les deux plus longues, donc les plus chères.
//
// La règle : une section ne reçoit AUCUN marqueur de composition. La couverture
// (`freeform`) n'en reçoit pas davantage : elle est composée par le moteur, sans modèle.
console.log('\n  Équipe de recherche : consignes de section');

{
  // Le catalogue ENTIER, pas seulement les neuf sections historiques : une
  // section n'existe que si une structure peut la choisir, et une structure qui
  // la choisit doit pouvoir la produire.
  const spec = buildBusinessPlanSpec(BUSINESS_PLAN_SECTION_CATALOG, {
    audience: 'general',
    projectDescription: 'Une plateforme de X pour Y.',
    financeContext: '',
    country: 'Cameroun',
  });

  check(
    'la spécification couvre tout le catalogue',
    spec.length === BUSINESS_PLAN_SECTION_CATALOG.length,
    `${spec.length} / ${BUSINESS_PLAN_SECTION_CATALOG.length} section(s)`
  );

  for (const section of spec) {
    if (section.freeform) {
      // La couverture est composée par le moteur : aucun modèle ne l'écrit, aucune consigne ne part.
      check(`« ${section.name} » (couverture) : composée par le moteur, sans prompt de page`, section.instructions === '' && !section.needsResearch);
      continue;
    }
    const found = COMPOSITION_MARKERS.filter(({ pattern }) => pattern.test(section.instructions));
    check(
      `« ${section.name} » ne décrit pas une composition`,
      found.length === 0,
      found.map(({ what }) => what).join(', ')
    );
  }

  // Un brief manquant laisserait la section partir avec une consigne vide, sans
  // que rien ne le signale.
  const templatedNames = spec.filter((s) => !s.freeform).map((s) => s.name);
  const missing = templatedNames.filter((name) => !BP_SECTION_BRIEFS[name]);
  check(
    'chaque section sous gabarit dispose de son brief de contenu',
    missing.length === 0,
    missing.join(', ')
  );

  // Le REGISTRE doit couvrir le catalogue exactement. Une section catalogable
  // sans prompt partirait avec une consigne vide — elle serait générée, mal, et
  // rien ne le signalerait : c'est très précisément le défaut que le registre
  // supprime. La couverture est l'exception, elle a son prompt écrit à la main.
  const promptKeys = new Set(SECTION_PROMPT_SPECS.map((s) => s.key));
  const withoutPrompt = BUSINESS_PLAN_SECTION_CATALOG.filter(
    (section) => !section.freeform && !promptKeys.has(section.key)
  ).map((section) => section.key);
  check('chaque section du catalogue a son prompt', withoutPrompt.length === 0, withoutPrompt.join(', '));

  // Et l'inverse : un prompt orphelin est du texte que personne n'atteint.
  const catalogKeys = new Set(BUSINESS_PLAN_SECTION_CATALOG.map((s) => s.key));
  const orphanPrompts = SECTION_PROMPT_SPECS.filter((s) => !catalogKeys.has(s.key)).map((s) => s.key);
  check('aucun prompt orphelin', orphanPrompts.length === 0, orphanPrompts.join(', '));

  // Les noms doivent correspondre EXACTEMENT : c'est le nom canonique qui relie
  // le catalogue, le prompt, la section persistée et l'ordre du PDF.
  const mismatched = SECTION_PROMPT_SPECS.filter((spec) => {
    const section = BUSINESS_PLAN_SECTION_CATALOG.find((s) => s.key === spec.key);
    return section && section.name !== spec.name;
  }).map((spec) => spec.key);
  check('noms canoniques alignés catalogue/prompt', mismatched.length === 0, mismatched.join(', '));

  // Un nom canonique en double ferait fusionner deux sections différentes dans
  // le même emplacement du plan : la deuxième écraserait la première à la
  // persistance, sans aucune erreur.
  const names = BUSINESS_PLAN_SECTION_CATALOG.map((s) => s.name);
  const duplicated = names.filter((name, i) => names.indexOf(name) !== i);
  check('les noms canoniques du catalogue sont uniques', duplicated.length === 0, duplicated.join(', '));

  // Chaque modèle doit produire un plan réellement générable : ses clés
  // existent (garde-fou au chargement de `templates.ts`) et il porte bien un
  // plan financier, la section qu'aucun lecteur de plan ne laisse passer.
  for (const template of BUSINESS_PLAN_TEMPLATES) {
    check(
      `modèle « ${template.id} » : au moins 5 sections`,
      template.sectionKeys.length >= 5,
      `${template.sectionKeys.length} section(s)`
    );
    check(
      `modèle « ${template.id} » : porte un plan financier`,
      template.sectionKeys.includes('financial-plan')
    );
  }
}

// ── LA CHARTE : CE QUE LE CODE POSE, CE QUE LE MODÈLE ÉCRIT ─────────────────
//
// Les pages dont le code pose le spécimen (nuancier, polices, logo, motifs) :
// le modèle n'y écrit que la règle d'usage. Les quatre pages de logo l'ont
// rejoint après un livrable réel où, laissées libres, elles avaient produit des
// références administratives inventées et un débordement de texte.
console.log('\n  Charte : pages rédigées');

{
  const templated = [
    'Color Palette', 'Typography', 'Logo Bonnes Pratiques',
    'Usage Couleurs & Typographie',
    'Logo Principal', 'Logo Variation Fond Clair',
    'Logo Variation Fond Sombre', 'Logo Variation Monochrome',
    'Logomark', 'Typeface Hierarchy', 'Graphic Patterns',
  ];
  // Toute page porte un titre de la nomenclature : sans lui, le titre retombe
  // sur celui du modèle, et la charte change de registre.
  for (const page of templated) {
    check(`« ${page} » a un titre de nomenclature`, Boolean(CHARTER_PAGE_HEADINGS[page]?.title));
  }
  for (const page of templated) {
    check(`« ${page} » dispose d'un brief de contenu`, Boolean(CHARTER_PAGE_BRIEFS[page]));
  }
  // Le garde-fou anti-décorum, posé une fois pour tous les rédacteurs. Ce sont
  // des fautes de TEXTE : le moteur ne dessine aucun ornement, mais un rédacteur
  // peut encore écrire une référence ou un chiffre.
  for (const [label, pattern] of [
    ['références inventées', /reference codes/i],
    ['chiffres non calculés', /NUMBERS NOBODY COMPUTED/],
    ['grandiloquence', /INFLATED NAMING/],
    ['remplissage', /survive a change of company name/],
  ] as Array<[string, RegExp]>) {
    check(`règles d'écriture : ${label}`, pattern.test(WRITING_RULES));
  }
  // Une idée par page : le volume est un plafond, et la matière qui manque arrête la rédaction.
  check('contrat de sortie : le volume est un plafond autant qu\'une cible', CONTRACTS.every(([, contract]) => /a ceiling as much as a target/.test(contract)));
}

console.log('');
if (failures > 0) {
  console.error(`Conformité des prompts: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Conformité des prompts: toutes les vérifications passent.\n');
