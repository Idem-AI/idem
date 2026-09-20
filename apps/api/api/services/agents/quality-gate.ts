/**
 * Quality gate — le contrôle DÉTERMINISTE des sorties de modèle.
 *
 * Principe: avant de payer un modèle pour juger un autre modèle, on regarde ce
 * que du code peut constater tout seul. Une section tronquée en plein milieu
 * d'une balise, un bloc ```html oublié, un `[INSERT NAME]` resté en place, une
 * réponse qui commence par « Voici le HTML demandé » — ce sont des défauts
 * FACTUELS, détectables à coût nul et sans variance.
 *
 * La critique IA (`section-verifier.service.ts`) n'intervient qu'ensuite, et
 * seulement sur ce que le code ne sait pas juger. C'est ce qui rend la
 * vérification abordable: le gros du filtrage ne coûte rien.
 */

export type IssueSeverity = 'blocking' | 'warning';

export interface QualityIssue {
  /** Code stable, utilisable en métrique. */
  code: string;
  message: string;
  severity: IssueSeverity;
}

export interface QualityReport {
  ok: boolean;
  issues: QualityIssue[];
  /** Sous-ensemble bloquant — c'est lui qui déclenche escalade ou réparation. */
  blocking: QualityIssue[];
  /** Résumé d'une ligne, injectable dans un prompt de réparation. */
  summary: string;
}

export interface QualityExpectation {
  /** Forme attendue de la sortie. */
  format?: 'html' | 'json' | 'text';
  /** Longueur minimale plausible (défaut: 120 caractères). */
  minChars?: number;
  /**
   * Devise attendue. Si une AUTRE devise apparaît, c'est le symptôme classique
   * du modèle qui repart sur ses habitudes ($/€) au lieu du contexte projet.
   */
  currency?: string;
  /** Interdit les marqueurs de gabarit non remplis (défaut: true). */
  forbidPlaceholders?: boolean;
}

/** Conteneurs dont un déséquilibre signe une troncature (pas des balises vides). */
const CONTAINER_TAGS = ['div', 'section', 'table', 'tbody', 'thead', 'tr', 'ul', 'ol', 'article'];

const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /lorem\s+ipsum/i, label: 'lorem ipsum' },
  { pattern: /\[(insert|votre|your|nom du|company name|xxx)[^\]]*\]/i, label: 'crochet à remplir' },
  { pattern: /\{\{[^}]+\}\}/, label: 'variable de gabarit {{…}}' },
  { pattern: /\bTODO\b|\bTBD\b|\bPLACEHOLDER\b/i, label: 'marqueur TODO/TBD' },
  { pattern: /\bXXX+\b/, label: 'valeur XXX non remplacée' },
];

/** Bavardage de modèle: la sortie doit être le livrable, pas un message. */
const META_TALK_PATTERNS: RegExp[] = [
  /^\s*(voici|here is|here's|bien s[ûu]r|certainly|of course)\b[^\n]{0,80}(html|section|slide|code|contenu|content)/i,
  /\b(en tant qu'|as an)\s*(ia|ai|intelligence artificielle)\b/i,
  /\b(je ne peux pas|i cannot|i'm unable to)\b/i,
];

/** Fuite du prompt d'orchestration dans la sortie. */
const PROMPT_LEAK_PATTERNS: RegExp[] = [
  /---\s*(PREVIOUS CONTEXT|END PREVIOUS CONTEXT|CONTEXTE DES SECTIONS)/i,
  /SPECIFIC INSTRUCTIONS FOR '/,
  /CURRENT TASK: Generate the '/,
];

/**
 * Le symbole peut précéder ou suivre le montant selon la locale ("$1 200" en
 * anglais, "1 200 $" en français) : les deux formes doivent être reconnues,
 * sinon la dérive de devise passe inaperçue sur un livrable francophone.
 */
const CURRENCY_SYMBOLS: { symbol: RegExp; code: string }[] = [
  { symbol: /\$\s?\d|\d\s?\$|USD\b/, code: 'USD' },
  { symbol: /€|EUR\b/, code: 'EUR' },
  { symbol: /£|GBP\b/, code: 'GBP' },
  { symbol: /FCFA|XAF\b|XOF\b/, code: 'XAF' },
];

function countOccurrences(haystack: string, needle: RegExp): number {
  const matches = haystack.match(needle);
  return matches ? matches.length : 0;
}

/**
 * Inspecte une sortie de modèle. Ne lève jamais: un contrôle qui plante ne doit
 * pas casser une génération par ailleurs valide.
 */
export function inspectOutput(
  content: string,
  expectation: QualityExpectation = {}
): QualityReport {
  const issues: QualityIssue[] = [];
  const text = (content ?? '').trim();
  const minChars = expectation.minChars ?? 120;
  const format = expectation.format ?? 'text';

  const add = (code: string, message: string, severity: IssueSeverity = 'blocking') =>
    issues.push({ code, message, severity });

  if (text.length === 0) {
    add('empty', 'Empty output.');
    return finalize(issues);
  }

  if (text.length < minChars) {
    add('too_short', `Abnormally short output (${text.length} characters, minimum ${minChars}).`);
  }

  // Clôture de bloc de code laissée dans la sortie: casse le rendu HTML et le PDF.
  if (/```/.test(text)) {
    add('code_fence', 'The output contains an uncleaned code fence (```).');
  }

  for (const pattern of PROMPT_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      add('prompt_leak', 'The output repeats internal orchestration instructions.');
      break;
    }
  }

  for (const pattern of META_TALK_PATTERNS) {
    if (pattern.test(text)) {
      add('meta_talk', 'The output comments on the task instead of containing the deliverable only.');
      break;
    }
  }

  if (expectation.forbidPlaceholders !== false) {
    for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        add('placeholder', `Unfilled template placeholder detected (${label}).`);
        break;
      }
    }
  }

  if (format === 'html') {
    inspectHtml(text, add);
  } else if (format === 'json') {
    inspectJson(text, add);
  } else if (/[a-zA-Z]<[a-z]+[^>]*$/.test(text)) {
    add('truncated', 'The output ends on an incomplete tag (truncated response).');
  }

  if (expectation.currency) {
    const expected = expectation.currency.toUpperCase();
    const foreign = CURRENCY_SYMBOLS.filter(
      (c) => c.code !== expected && c.symbol.test(text)
    ).map((c) => c.code);
    if (foreign.length > 0) {
      add(
        'currency_mismatch',
        `Devise inattendue (${foreign.join(', ')}) alors que le projet est en ${expected}.`,
        'warning'
      );
    }
  }

  return finalize(issues);
}

function inspectHtml(text: string, add: (c: string, m: string, s?: IssueSeverity) => void): void {
  if (!/<[a-z][^>]*>/i.test(text)) {
    add('not_html', 'No HTML tag at all, while HTML was expected.');
    return;
  }

  // Balise ouverte non refermée en fin de flux = troncature nette.
  if (/<[^>]*$/.test(text)) {
    add('truncated', 'The output ends in the middle of a tag (truncated response).');
  }

  // Les sections embarquent du Chart.js : une balise écrite dans une chaîne JS
  // (ou du CSS) fausserait le comptage et déclencherait une réparation inutile.
  const markupOnly = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  for (const tag of CONTAINER_TAGS) {
    const opened = countOccurrences(markupOnly, new RegExp(`<${tag}(\\s|>)`, 'gi'));
    const closed = countOccurrences(markupOnly, new RegExp(`</${tag}>`, 'gi'));
    if (opened > closed) {
      add(
        'unbalanced_html',
        `Balises <${tag}> déséquilibrées (${opened} ouvertes, ${closed} fermées) — contenu probablement tronqué.`
      );
      break;
    }
  }
}

function inspectJson(text: string, add: (c: string, m: string, s?: IssueSeverity) => void): void {
  const stripped = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    JSON.parse(stripped);
  } catch (error: any) {
    add('invalid_json', `Invalid JSON: ${error?.message ?? 'could not be parsed'}.`);
  }
}

function finalize(issues: QualityIssue[]): QualityReport {
  const blocking = issues.filter((i) => i.severity === 'blocking');
  return {
    ok: blocking.length === 0,
    issues,
    blocking,
    summary:
      issues.length === 0
        ? 'Aucun défaut détecté.'
        : issues.map((i) => `[${i.severity}] ${i.code}: ${i.message}`).join(' | '),
  };
}

/**
 * Adaptateur pour `AgentDefinition.validate` — c'est ce qui relie le contrôle
 * déterministe au routeur: une sortie du tier bas qui échoue déclenche
 * l'escalade, une sortie qui passe ne coûte jamais un second appel.
 */
export function qualityValidator(expectation: QualityExpectation = {}) {
  return (text: string) => {
    const report = inspectOutput(text, expectation);
    return { ok: report.ok, reason: report.ok ? undefined : report.summary };
  };
}
