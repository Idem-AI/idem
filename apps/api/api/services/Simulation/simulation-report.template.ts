/**
 * Template fixe du rapport de simulation.
 *
 * Fixe, et non généré: un rapport que l'on met entre les mains d'un banquier ou
 * d'un investisseur doit être identique d'une exécution à l'autre. Seules les
 * données changent. La charte est celle d'IDEM — Jura, le bleu #1447e6 —
 * appliquée sur une page claire, qui reste lisible à l'impression comme à
 * l'écran.
 *
 * Chaque section rend un bloc `.idem-flow` : les enfants positionnés en absolu
 * (en-tête, pied) sont répliqués par le paginateur sur chaque page de la
 * section, le reste est du flux que le paginateur redécoupe sans jamais couper
 * un bloc.
 *
 * ── CE QUE CE DOCUMENT DOIT FAIRE ───────────────────────────────────────────
 *
 * Le rapport affirmait. Il donnait un score, un verdict, des tableaux — et
 * jamais le raisonnement : d'où sort le 58, laquelle des quatre questions le
 * tire vers le bas, ce que « robustesse moyenne » recouvre, ce qu'il faut
 * faire lundi matin. Un lecteur qui ne peut pas reconstituer le raisonnement ne
 * peut pas contester le chiffre, donc ne peut pas s'en servir.
 *
 * Trois principes le corrigent, et gouvernent tout ce fichier :
 *
 *  1. TOUT CHIFFRE PORTE SA LECTURE. Un nombre nu est un nombre perdu. Chaque
 *     indicateur est suivi de ce qu'il veut dire pour ce projet-ci.
 *  2. CHAQUE CHAPITRE ANNONCE SA QUESTION. Le sommaire les pose, le titre de
 *     chapitre la répète : on sait toujours à quoi la page qu'on lit répond.
 *  3. LE DÉCOR NE PARLE PAS. Pas de motif derrière le texte, pas de couleur
 *     décorative : la couleur encode, ou elle n'est pas là.
 */

import {
  BusinessBaseline,
  ConfidenceLevel,
  Evidence,
  Factor,
  FactorSummary,
  FinancialPoint,
  FinancialSummary,
  Recommendation,
  Risk,
  Robustness,
  Scenario,
  SensitivityEntry,
  SimulationModel,
  SimulationReport,
  UnitEconomics,
  Verdict,
  ViabilityBreakdown,
  ViabilityCondition,
} from '../../models/simulation.model';
import { VIABILITY_CEILING, VIABILITY_WEIGHTS } from './simulation-engine.service';

// ---------------------------------------------------------------------------
// Charte
// ---------------------------------------------------------------------------

/**
 * Les encres et les couleurs d'encodage.
 *
 * `go`, `warn` et `stop` ne sont pas choisies à l'œil : le trio a été passé au
 * validateur de palette de la compétence `dataviz` (bande de clarté, plancher
 * de chroma, séparation sous protanopie et deutéranopie, contraste sur la
 * page). L'ambre et le rouge d'origine se confondaient — ΔE 12 en vision
 * normale, 4,9 en deutéranopie : « Critique » et « Élevé » étaient la même
 * couleur pour une partie des lecteurs. Le trio actuel passe les cinq
 * contrôles ; il n'est jamais employé seul, chaque état porte aussi son mot.
 */
export const IDEM = {
  primary: '#1447e6',
  primarySoft: '#eaf0ff',
  primaryTrack: '#dbe5ff',
  accent: '#22d3ee',
  ink: '#0b1220',
  inkMuted: '#4d5769',
  inkSubtle: '#8a93a5',
  line: '#e3e8f0',
  lineSoft: '#eef2f7',
  surface: '#ffffff',
  surfaceSunken: '#f7f9fc',
  go: '#0f7a56',
  warn: '#b5820c',
  stop: '#96162e',
} as const;

/** Jura est la police de marque IDEM ; JetBrains Mono porte les chiffres. */
export const IDEM_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

const MONO = "'JetBrains Mono', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Utilitaires de rendu
// ---------------------------------------------------------------------------

/** Espace insécable — écrite en échappement pour rester visible à la relecture. */
const NBSP = '\u00A0';

/**
 * Échappe, et pose la ponctuation française.
 *
 * Les espaces qui précèdent « : ; ! ? % » et qui bordent les guillemets sont
 * INSÉCABLES en français. Sans cela, une justification place un deux-points ou
 * un guillemet fermant seul en tête de ligne — mesuré sur le rendu : « An 2 »
 * se coupait entre le 2 et son guillemet. Ce n'est pas un détail d'esthète :
 * c'est ce qui distingue un document composé d'un document traduit.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/ ([:;!?%])/g, `${NBSP}$1`);
}

/** Séparateur de milliers par espace fine insécable, comme en typographie française. */
function group(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Décimales à la française. Un document remis à une banque camerounaise écrit
 * « 38,7 % », jamais « 38.7 % » : le point décimal anglo-saxon suffit à faire
 * lire le document comme une traduction.
 */
function decimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace('.', ',');
}

function money(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  return `${group(value)}${currency ? ` ${currency}` : ''}`;
}

/** Montant abrégé, réservé aux étiquettes de graphique où la place manque. */
function moneyShort(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const unit = currency ? ` ${currency}` : '';
  if (abs >= 1_000_000) return `${sign}${decimal(abs / 1_000_000, abs >= 10_000_000 ? 0 : 1)} M${unit}`;
  if (abs >= 1_000) return `${sign}${decimal(abs / 1_000, abs >= 10_000 ? 0 : 1)} k${unit}`;
  return `${sign}${group(abs)}${unit}`;
}

function months(value: number | null | undefined): string {
  return value === null || value === undefined ? 'jamais atteint' : `mois ${value}`;
}

function pct(value: number, digits = 0): string {
  return Number.isFinite(value) ? `${decimal(value * 100, digits)} %` : '—';
}

function ratio(value: number): string {
  return Number.isFinite(value) ? `${decimal(value)}×` : '—';
}

/**
 * « GO » et « NO-GO » sont du vocabulaire de comité d'investissement, et le
 * lecteur de ce rapport est le fondateur. Le moteur ne dit d'ailleurs pas
 * autre chose que ceci : le modèle résiste aux scénarios, ou il casse.
 */
const VERDICT_LABEL: Record<Verdict, string> = {
  go: 'LE MODÈLE TIENT',
  'go-with-conditions': 'LE MODÈLE TIENT, SOUS CONDITIONS',
  'no-go': 'LE MODÈLE NE TIENT PAS',
};

/** Ce que le verdict engage, en une phrase, avant toute justification. */
const VERDICT_MEANING: Record<Verdict, string> = {
  go: "Le modèle atteint l'équilibre et le conserve dans la plupart des scénarios testés, y compris défavorables.",
  'go-with-conditions':
    "Le modèle atteint l'équilibre dans le scénario de référence, mais des conditions précises doivent être tenues pour qu'il y résiste ailleurs.",
  'no-go':
    "Dans les scénarios testés, le modèle n'atteint pas l'équilibre ou épuise sa trésorerie avant : il doit être modifié, pas seulement mieux exécuté.",
};

const VERDICT_COLOR: Record<Verdict, string> = {
  go: IDEM.go,
  'go-with-conditions': IDEM.warn,
  'no-go': IDEM.stop,
};

const LEVEL_LABEL: Record<Robustness | ConfidenceLevel, string> = {
  low: 'faible',
  medium: 'moyenne',
  high: 'élevée',
};

const TIER_LABEL: Record<Factor['tier'], string> = {
  critical: 'Critique',
  important: 'Important',
  secondary: 'Secondaire',
  unknown: 'Non cerné',
};

/** Ce que chaque niveau engage pour le lecteur — le mot seul ne le dit pas. */
const TIER_MEANING: Record<Factor['tier'], string> = {
  critical: 'Une variation de ce facteur change le verdict.',
  important: 'Déplace sensiblement le résultat sans le renverser seul.',
  secondary: 'Effet réel mais limité sur la trajectoire.',
  unknown: "L'analyse n'a pas pu établir son influence : à documenter.",
};

const KIND_LABEL: Record<Scenario['kind'], string> = {
  baseline: 'Référence',
  favourable: 'Favorable',
  adverse: 'Défavorable',
  stress: 'Stress test',
  extreme: 'Choc extrême',
};

const EVIDENCE_LABEL: Record<Evidence['kind'], string> = {
  data: 'Donnée',
  estimate: 'Estimation',
  assumption: 'Hypothèse',
};

const PRIORITY_LABEL: Record<Recommendation['priority'], string> = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

const PRIORITY_COLOR: Record<Recommendation['priority'], string> = {
  critical: IDEM.stop,
  high: IDEM.warn,
  medium: IDEM.primary,
  low: IDEM.inkSubtle,
};

const SEVERITY_LABEL: Record<Risk['severity'], string> = {
  critical: 'Critique',
  high: 'Élevé',
  moderate: 'Modéré',
};

const SEVERITY_COLOR: Record<Risk['severity'], string> = {
  critical: IDEM.stop,
  high: IDEM.warn,
  moderate: IDEM.inkMuted,
};

// ---------------------------------------------------------------------------
// Plan du document
// ---------------------------------------------------------------------------

/**
 * Les chapitres, avec la question à laquelle chacun répond.
 *
 * Source unique : le sommaire les liste et les titres de chapitre les
 * reprennent. Numéroter à la main aux deux endroits, c'est se garantir un
 * sommaire faux le jour où un chapitre s'insère au milieu.
 */
const CHAPTERS = {
  guide: { index: 1, title: 'Comment lire ce rapport', question: 'Que mesure ce document, et que ne mesure-t-il pas ?' },
  summary: { index: 2, title: 'Synthèse', question: 'Le modèle tient-il, et pourquoi ce score ?' },
  project: { index: 3, title: 'Le projet et ses chiffres', question: 'Sur quelle lecture du projet tout repose-t-il ?' },
  factors: { index: 4, title: 'Facteurs déterminants', question: 'Qu’est-ce qui fait bouger le résultat ?' },
  scenarios: { index: 5, title: 'Scénarios et stress tests', question: 'Que devient le modèle quand les choses vont mal ?' },
  financials: { index: 6, title: 'Trajectoire financière', question: 'Combien faut-il réunir, et pour tenir jusqu’à quand ?' },
  levers: { index: 7, title: 'Leviers et conditions', question: 'Sur quoi agir, et quels seuils tenir ?' },
  actions: { index: 8, title: 'Problèmes et Recommandations', question: 'Que faire, dans quel ordre, et pourquoi ?' },
  evidence: { index: 9, title: 'Hypothèses, sources et portée', question: 'Sur quoi ces chiffres reposent-ils ?' },
} as const;

type Chapter = (typeof CHAPTERS)[keyof typeof CHAPTERS];

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------

/** Numéro, titre et question du chapitre : l'ancrage visuel du document. */
function chapterTitle(chapter: Chapter, lead?: string): string {
  return `
    <div data-keep-together data-keep-with-next style="margin-bottom:7mm">
      <div style="display:flex;align-items:baseline;gap:3mm;padding-bottom:2.5mm;border-bottom:0.5mm solid ${IDEM.ink}">
        <span style="font-family:${MONO};font-size:10pt;font-weight:500;color:${IDEM.primary}">${String(chapter.index).padStart(2, '0')}</span>
        <h2 style="font-size:21pt;font-weight:600;color:${IDEM.ink};line-height:1.15;letter-spacing:-0.07em">${esc(chapter.title)}</h2>
      </div>
      <p style="margin-top:2.5mm;font-size:10pt;color:${IDEM.inkSubtle}">${esc(chapter.question)}</p>
      ${
        lead
          ? `<p style="margin-top:2.5mm;font-size:10.5pt;line-height:1.6;color:${IDEM.inkMuted};max-width:150mm">${esc(lead)}</p>`
          : ''
      }
    </div>`;
}

/** Intertitre de niveau 2, jamais séparé de ce qu'il annonce. */
function heading(text: string, hint?: string): string {
  return `
    <div data-keep-together data-keep-with-next style="margin:8mm 0 3.5mm">
      <h3 style="font-size:13pt;font-weight:600;color:${IDEM.ink};letter-spacing:-0.07em">${esc(text)}</h3>
      ${hint ? `<p style="margin-top:1.2mm;font-size:9.5pt;line-height:1.5;color:${IDEM.inkSubtle}">${esc(hint)}</p>` : ''}
    </div>`;
}

/**
 * « Comment lire » : le bloc qui transforme un tableau en information.
 *
 * Il est délibérément visuellement discret — un filet, pas une boîte : c'est
 * une aide de lecture, elle ne doit pas peser autant que la donnée qu'elle
 * commente.
 */
function readingNote(text: string): string {
  return `
    <div data-keep-together style="margin-top:4mm;border-left:0.6mm solid ${IDEM.primary};padding-left:4mm">
      <p style="font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;color:${IDEM.primary};font-weight:600">Comment lire</p>
      <p style="margin-top:1.2mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted};max-width:150mm">${text}</p>
    </div>`;
}

/** Étiquette pleine, réservée aux verdicts et aux priorités. */
function pill(text: string, color: string): string {
  return `<span style="display:inline-block;padding:1mm 2.6mm;border-radius:999px;background:${color};color:#fff;font-size:7.5pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap">${esc(text)}</span>`;
}

/** Étiquette discrète, pour les catégories et les provenances. */
function tag(text: string, color: string = IDEM.inkMuted): string {
  return `<span style="display:inline-block;padding:0.8mm 2.2mm;border:0.25mm solid ${IDEM.line};border-radius:1.5mm;color:${color};font-size:7.5pt;font-weight:500;white-space:nowrap">${esc(text)}</span>`;
}

/** État nommé : la couleur appuie le mot, elle ne le remplace jamais. */
function state(text: string, color: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:1.4mm;font-size:8.5pt;font-weight:600;color:${color};white-space:nowrap">
    <span style="width:1.6mm;height:1.6mm;border-radius:999px;background:${color};flex:none"></span>${esc(text)}
  </span>`;
}

/**
 * Chiffre isolé, et ce qu'il veut dire.
 *
 * `reading` n'est pas décoratif : c'est lui qui distingue « mois 14 » d'un
 * nombre sans conséquence — il faut financer quatorze mois de pertes.
 */
function stat(label: string, value: string, reading?: string): string {
  return `
    <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-radius:2mm;padding:4mm;background:${IDEM.surface}">
      <p style="font-size:8pt;letter-spacing:.09em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
      <p style="font-family:${MONO};font-size:15pt;font-weight:500;color:${IDEM.ink};margin-top:1.8mm;line-height:1.15">${esc(value)}</p>
      ${reading ? `<p style="font-size:9pt;line-height:1.5;color:${IDEM.inkMuted};margin-top:1.8mm">${esc(reading)}</p>` : ''}
    </div>`;
}

/**
 * Grille de chiffres-clés. `data-keep-together` n'est pas là pour empêcher la
 * coupure — deux rangées tiennent toujours dans une page — mais pour que le
 * remplisseur de page cesse d'écarter les rangées entre elles : une rangée de
 * chiffres qui dérive de deux centimètres cesse de se lire comme une rangée.
 */
function grid(cells: string[], columns = 3): string {
  return `<div data-keep-together style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:3.5mm">${cells.join('')}</div>`;
}

function table(headers: string[], rows: string[][], aligns: ('l' | 'r')[] = []): string {
  const align = (i: number) => (aligns[i] === 'r' ? 'right' : 'left');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:9pt">
      <thead>
        <tr>
          ${headers
            .map(
              (h, i) =>
                `<th style="text-align:${align(i)};padding:2.2mm 2mm;border-bottom:0.4mm solid ${IDEM.ink};font-size:7pt;letter-spacing:.09em;text-transform:uppercase;color:${IDEM.inkMuted};font-weight:600">${esc(h)}</th>`,
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, i) =>
                    `<td style="text-align:${align(i)};padding:2.4mm 2mm;border-bottom:0.2mm solid ${IDEM.lineSoft};color:${IDEM.ink};vertical-align:top">${cell}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

/** Cellule numérique : chasse fixe, pour que les colonnes s'alignent. */
function numeric(text: string, color: string = IDEM.ink): string {
  return `<span style="font-family:${MONO};font-size:8.5pt;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap">${esc(text)}</span>`;
}

/**
 * Jauge proportionnelle. Piste = un pas clair de la même rampe que le
 * remplissage, jamais un gris étranger : l'état se lit sur toute la barre.
 */
function meter(fraction: number, color: string, track = IDEM.primaryTrack, width = '26mm'): string {
  const filled = Math.max(0, Math.min(1, fraction)) * 100;
  return `<span style="display:inline-block;width:${width};height:1.8mm;border-radius:999px;background:${track};vertical-align:middle">
    <span style="display:block;width:${filled.toFixed(1)}%;height:1.8mm;border-radius:999px;background:${color}"></span>
  </span>`;
}

/**
 * Barre signée, ancrée sur un zéro central : la longueur porte l'ampleur, le
 * côté porte le sens. Le nombre signé est toujours écrit à côté — la couleur
 * ne travaille jamais seule.
 */
function divergingBar(fraction: number, positive: boolean, width = '34mm'): string {
  const half = Math.max(0, Math.min(1, Math.abs(fraction))) * 50;
  const color = positive ? IDEM.primary : IDEM.stop;
  return `<span style="position:relative;display:inline-block;width:${width};height:2.4mm;vertical-align:middle">
    <span style="position:absolute;top:0.3mm;bottom:0.3mm;left:0;right:0;background:${IDEM.lineSoft};border-radius:0.6mm"></span>
    <span style="position:absolute;top:0;bottom:0;left:50%;width:0.25mm;background:${IDEM.line}"></span>
    <span style="position:absolute;top:0.3mm;height:1.8mm;${
      positive ? `left:50%;` : `right:50%;`
    }width:${half.toFixed(1)}%;background:${color};border-radius:0.6mm"></span>
  </span>`;
}

// ---------------------------------------------------------------------------
// Enveloppe de page
// ---------------------------------------------------------------------------

export interface ReportChrome {
  motifDataUri: string;
  logoDataUri: string;
  projectName: string;
}

type Chrome = ReportChrome;

/**
 * Décor répété sur chaque page de la section : le paginateur clone les enfants
 * positionnés en absolu, c'est par eux que passent l'en-tête et le pied.
 *
 * Le motif de marque a quitté les pages intérieures. Une trame répétée derrière
 * un tableau de chiffres n'ajoute pas de la marque, elle ajoute du bruit sous
 * le texte : elle reste sur la couverture, où elle est seule à parler.
 */
function chrome(c: Chrome, sectionName: string): string {
  return `
    <div style="position:absolute;top:0;left:0;right:0;height:20mm;padding:9mm 18mm 0;display:flex;align-items:center;justify-content:space-between">
      ${c.logoDataUri ? `<img src="${c.logoDataUri}" alt="IDEM" style="height:5mm;width:auto" />` : `<span style="font-size:9pt;font-weight:600;letter-spacing:.1em">IDEM</span>`}
      <p style="font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(sectionName)}</p>
    </div>
    <div style="position:absolute;top:16mm;left:18mm;right:18mm;height:0.2mm;background:${IDEM.line}"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:14mm;padding:0 18mm 8mm;display:flex;align-items:flex-end;justify-content:space-between">
      <p style="font-size:7pt;color:${IDEM.inkSubtle}">${esc(c.projectName)} — Rapport de simulation IDEM</p>
      <p style="font-size:7pt;color:${IDEM.inkSubtle}">Aide à la décision, non une prédiction</p>
    </div>`;
}

/** Une section du rapport : décor fixe + flux paginable. */
function page(c: Chrome, sectionName: string, body: string): string {
  return `
    <div style="position:relative;width:210mm;min-height:297mm;background:${IDEM.surface};padding:26mm 18mm 20mm;font-family:'Jura',system-ui,sans-serif;color:${IDEM.ink};letter-spacing:-0.07em">
      ${
        c.motifDataUri
          ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background-image:url('${c.motifDataUri}');background-repeat:repeat;opacity:0.4;z-index:0;pointer-events:none"></div>`
          : ''
      }
      ${chrome(c, sectionName)}
      <div style="position:relative;z-index:1">${body}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Couverture
// ---------------------------------------------------------------------------

export function coverSection(
  c: Chrome,
  simulation: SimulationModel,
  report: SimulationReport,
): string {
  const summary = report.executiveSummary;
  const generated = new Date(report.generatedAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div style="position:relative;width:210mm;height:297mm;background:${IDEM.surface};padding:26mm 22mm;font-family:'Jura',system-ui,sans-serif;color:${IDEM.ink};display:flex;flex-direction:column;justify-content:space-between">
      ${
        c.motifDataUri
          ? `<div style="position:absolute;inset:0;background-image:url('${c.motifDataUri}');background-repeat:repeat;background-size:140mm;opacity:0.10;pointer-events:none"></div>`
          : ''
      }
      <div style="position:absolute;top:0;left:0;right:0;height:2mm;background:linear-gradient(90deg,${IDEM.primary},${IDEM.accent})"></div>

      <div style="position:relative">
        ${c.logoDataUri ? `<img src="${c.logoDataUri}" alt="IDEM" style="height:9mm;width:auto" />` : ''}
        <p style="margin-top:2mm;font-size:9pt;letter-spacing:.22em;text-transform:uppercase;color:${IDEM.inkSubtle}">Simulator</p>
      </div>

      <div style="position:relative">
        <p style="font-family:${MONO};font-size:9pt;letter-spacing:.14em;color:${IDEM.primary}">RAPPORT DE SIMULATION</p>
        <h1 style="margin-top:4mm;font-size:38pt;font-weight:600;line-height:1.1;letter-spacing:-0.07em">${esc(report.profile.name)}</h1>
        <p style="margin-top:5mm;font-size:12pt;line-height:1.6;color:${IDEM.inkMuted};max-width:140mm">${esc(report.profile.product)}</p>

        <div style="margin-top:12mm;display:flex;align-items:center;gap:6mm">
          <div>
            <p style="font-size:7pt;letter-spacing:.09em;text-transform:uppercase;color:${IDEM.inkSubtle}">Indice de viabilité</p>
            <p style="font-family:${MONO};font-size:44pt;font-weight:500;line-height:1;color:${IDEM.ink};margin-top:1mm">${summary.viabilityIndex}<span style="font-size:16pt;color:${IDEM.inkSubtle}">/${VIABILITY_CEILING}</span></p>
          </div>
          <div style="width:0.25mm;height:26mm;background:${IDEM.line}"></div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2.5mm">
            ${pill(VERDICT_LABEL[summary.verdict], VERDICT_COLOR[summary.verdict])}
            <p style="font-size:9pt;color:${IDEM.inkMuted}">Robustesse ${LEVEL_LABEL[summary.robustness]} · Confiance ${LEVEL_LABEL[summary.confidence]}</p>
            <p style="font-size:8pt;line-height:1.5;color:${IDEM.inkSubtle};max-width:72mm">${esc(VERDICT_MEANING[summary.verdict])}</p>
          </div>
        </div>
      </div>

      <div style="position:relative">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;padding-top:6mm;border-top:0.25mm solid ${IDEM.line}">
          ${[
            ['Secteur', report.profile.sector],
            ['Marché', report.profile.market],
            ['Modèle', report.profile.businessModel],
            ['Révision', `n° ${simulation.revision}`],
          ]
            .map(
              ([label, value]) => `<div>
                <p style="font-size:7pt;letter-spacing:.09em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
                <p style="margin-top:1mm;font-size:9pt;line-height:1.4;color:${IDEM.ink}">${esc(value)}</p>
              </div>`,
            )
            .join('')}
        </div>
        <p style="margin-top:6mm;font-size:8pt;color:${IDEM.inkSubtle}">Généré le ${generated} · ${esc(report.profile.location)}, ${esc(report.profile.country)}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// 01 — Comment lire ce rapport
// ---------------------------------------------------------------------------

/**
 * Le chapitre que le rapport n'avait pas, et dont l'absence expliquait
 * l'essentiel du reproche fait au document : le lecteur arrivait sur un score
 * sans savoir ce qu'il mesure, sur une « robustesse moyenne » sans savoir ce
 * qu'elle recouvre, et sur neuf chapitres sans savoir lequel répond à sa
 * question. Tout est ici, avant le premier chiffre.
 */
export function guideSection(c: Chrome, report: SimulationReport): string {
  const currency = report.financials.currency;
  const horizon = report.financials.points?.length || 36;
  const evidence = report.evidence ?? [];
  const counts = {
    data: evidence.filter((e) => e.kind === 'data').length,
    estimate: evidence.filter((e) => e.kind === 'estimate').length,
    assumption: evidence.filter((e) => e.kind === 'assumption').length,
  };

  const measure = (title: string, scale: string, measures: string, limit: string) => `
    <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-radius:2mm;padding:4.5mm;background:${IDEM.surface}">
      <p style="font-size:10pt;font-weight:600;color:${IDEM.ink}">${esc(title)}</p>
      <p style="font-family:${MONO};font-size:8pt;color:${IDEM.primary};margin-top:1.2mm">${esc(scale)}</p>
      <p style="margin-top:2.5mm;font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted}">${esc(measures)}</p>
      <p style="margin-top:2mm;padding-top:2mm;border-top:0.2mm solid ${IDEM.lineSoft};font-size:8pt;line-height:1.5;color:${IDEM.inkSubtle}">${esc(limit)}</p>
    </div>`;

  return page(
    c,
    'Mode d’emploi',
    `
    ${chapterTitle(
      CHAPTERS.guide,
      "Une simulation met un modèle économique à l'épreuve : elle rejoue le projet sous des hypothèses différentes et regarde où il casse. Elle ne prédit pas l'avenir de l'entreprise, et aucune de ses pages ne doit être lue comme une prévision.",
    )}

    ${heading('Ce que contient le document')}
    <div data-keep-together>
    ${table(
      ['', 'Chapitre', 'Répond à'],
      Object.values(CHAPTERS).map((chapter) => [
        numeric(String(chapter.index).padStart(2, '0'), IDEM.primary),
        `<span style="font-weight:600">${esc(chapter.title)}</span>`,
        `<span style="color:${IDEM.inkMuted}">${esc(chapter.question)}</span>`,
      ]),
    )}
    </div>

    ${heading('Les trois mesures du rapport', 'Elles ne disent pas la même chose et ne se remplacent pas.')}
    ${grid(
      [
        measure(
          'Indice de viabilité',
          `0 → ${VIABILITY_CEILING}`,
          "La tenue du modèle de référence, composée de quatre notes : économie unitaire, rentabilité, survie, échelle. Le chapitre 2 les détaille une à une.",
          `Plafonné à ${VIABILITY_CEILING} : une part des hypothèses reste à confronter au terrain, un score parfait affirmerait le contraire.`,
        ),
        measure(
          'Robustesse',
          'faible · moyenne · élevée',
          "La part des scénarios défavorables que le modèle traverse encore debout. Elle est indépendante du score : on peut bien noter et ne tenir que dans le scénario de référence.",
          'Élevée au-delà de 70 % des scénarios tenus, moyenne au-delà de 40 %, faible en deçà.',
        ),
        measure(
          'Confiance',
          'faible · moyenne · élevée',
          `La nature des chiffres d'entrée : ${counts.data} donnée${counts.data > 1 ? 's' : ''} observée${counts.data > 1 ? 's' : ''}, ${counts.estimate} estimation${counts.estimate > 1 ? 's' : ''}, ${counts.assumption} hypothèse${counts.assumption > 1 ? 's' : ''}.`,
          "Elle qualifie les entrées, jamais le résultat : une confiance faible n'invalide pas le calcul, elle dit ce qu'il faut aller vérifier.",
        ),
      ],
      3,
    )}

    ${heading('Conventions de lecture')}
    <div data-keep-together style="display:grid;grid-template-columns:repeat(2,1fr);gap:3.5mm 8mm">
      ${[
        [
          'Les chiffres en chasse fixe',
          "Ils sortent du moteur de calcul, jamais d'une rédaction : ils sont reproductibles à l'identique d'une exécution à l'autre, à données égales.",
        ],
        [
          'La monnaie et l’horizon',
          `Tous les montants sont en ${esc(currency)}. La projection court sur ${horizon} mois à partir du lancement.`,
        ],
        [
          'Les années du rapport',
          "« An 1 » couvre les mois 1 à 12 depuis le lancement, « An 2 » les mois 13 à 24. Elles ne se confondent pas avec l'exercice comptable, qui court du 1ᵉʳ janvier au 31 décembre.",
        ],
        [
          'La couleur',
          "Elle encode, elle ne décore pas : bleu au-dessus d'un seuil, rouge en dessous. Chaque état porte aussi son mot — la couleur n'est jamais la seule information.",
        ],
        [
          '« Tenir » un scénario',
          "Deux conditions à la fois : atteindre l'équilibre d'exploitation, et avoir encore de la trésorerie en y arrivant. L'une sans l'autre ne suffit pas.",
        ],
        [
          'Le mot « hypothèse »',
          "Il signale un chiffre que le moteur a choisi faute de mieux. Le chapitre 9 les liste toutes, avec leur source quand elle existe.",
        ],
      ]
        .map(
          ([term, body]) => `<div data-keep-together>
            <p style="font-size:9pt;font-weight:600;color:${IDEM.ink}">${esc(term)}</p>
            <p style="margin-top:1.2mm;font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted}">${esc(body)}</p>
          </div>`,
        )
        .join('')}
    </div>
  `,
  );
}

// ---------------------------------------------------------------------------
// 02 — Synthèse
// ---------------------------------------------------------------------------

/** Ce que chaque composante de l'indice pose comme question, et son poids. */
const BREAKDOWN_ROWS: {
  key: keyof Omit<ViabilityBreakdown, 'index'>;
  label: string;
  question: string;
  weight: number;
}[] = [
  {
    key: 'unitEconomics',
    label: 'Économie unitaire',
    question: "Ce qu'un client rapporte couvre-t-il ce qu'il a coûté à acquérir ?",
    weight: VIABILITY_WEIGHTS.unitEconomics,
  },
  {
    key: 'profitability',
    label: 'Rentabilité',
    question: "Le point mort tombe-t-il dans l'horizon, et à quelle distance ?",
    weight: VIABILITY_WEIGHTS.profitability,
  },
  {
    key: 'survival',
    label: 'Survie',
    question: 'La trésorerie tient-elle jusque-là sans passer sous zéro ?',
    weight: VIABILITY_WEIGHTS.survival,
  },
  {
    key: 'scale',
    label: 'Échelle',
    question: 'Le volume atteint justifie-t-il la structure de coûts ?',
    weight: VIABILITY_WEIGHTS.scale,
  },
];

/** La décomposition : un score cesse d'être un verdict opaque quand il s'ouvre. */
function breakdownBlock(breakdown: ViabilityBreakdown): string {
  const weakest = [...BREAKDOWN_ROWS].sort((a, b) => breakdown[a.key] - breakdown[b.key])[0];

  return `
    ${heading(
      "D'où vient l'indice",
      "Quatre notes sur 100, pondérées. L'indice est leur moyenne pondérée, ramenée sous le plafond.",
    )}
    <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-radius:2mm;overflow:hidden">
      ${BREAKDOWN_ROWS.map((row, index) => {
        const score = breakdown[row.key];
        return `
        <div data-keep-together style="display:grid;grid-template-columns:44mm 1fr 30mm;gap:4mm;align-items:center;padding:3.4mm 4mm;background:${IDEM.surface};${index ? `border-top:0.2mm solid ${IDEM.lineSoft}` : ''}">
          <div>
            <p style="font-size:9.5pt;font-weight:600;color:${IDEM.ink}">${esc(row.label)}</p>
            <p style="font-family:${MONO};font-size:7.5pt;color:${IDEM.inkSubtle};margin-top:0.6mm">poids ${Math.round(row.weight * 100)} %</p>
          </div>
          <p style="font-size:8.5pt;line-height:1.5;color:${IDEM.inkMuted}">${esc(row.question)}</p>
          <div style="text-align:right;white-space:nowrap">
            ${meter(score / 100, IDEM.primary, IDEM.primaryTrack, '18mm')}
            <span style="font-family:${MONO};font-size:10pt;font-weight:500;color:${IDEM.ink};margin-left:2mm;font-variant-numeric:tabular-nums">${score}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${readingNote(
      `La note la plus basse est <strong style="color:${IDEM.ink}">${esc(weakest.label.toLowerCase())}</strong>, à ${breakdown[weakest.key]}/100 : c'est elle qui tire l'indice vers le bas, et donc là qu'un point gagné en rapporte le plus. Le chapitre 7 dit de combien.`,
    )}`;
}

/** Deux colonnes, appuis et fragilités — le même modèle vu des deux côtés. */
function strengthsBlock(strengths: string[], weaknesses: string[]): string {
  const column = (title: string, color: string, items: string[], empty: string) => `
    <div data-keep-together>
      <p style="font-size:9pt;font-weight:600;color:${color};padding-bottom:2mm;border-bottom:0.4mm solid ${color}">${esc(title)}</p>
      ${
        items.length
          ? `<ul data-keep-together style="list-style:none;margin-top:3mm">${items
              .map(
                (item) =>
                  `<li style="display:flex;gap:2.5mm;font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted};margin-bottom:2.2mm">
                     <span style="color:${color};flex:none">—</span><span>${esc(item)}</span>
                   </li>`,
              )
              .join('')}</ul>`
          : `<p style="margin-top:3mm;font-size:8.5pt;color:${IDEM.inkSubtle}">${esc(empty)}</p>`
      }
    </div>`;

  return `
    ${heading('Appuis et fragilités', "Ce que l'analyse retient du modèle, en dehors des chiffres.")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      ${column('Ce sur quoi le modèle s’appuie', IDEM.go, strengths, "L'analyse n'a dégagé aucun appui distinctif.")}
      ${column('Ce qui le fragilise', IDEM.stop, weaknesses, "L'analyse n'a relevé aucune fragilité structurelle.")}
    </div>`;
}

export function summarySection(c: Chrome, report: SimulationReport): string {
  const s = report.executiveSummary;
  const f = report.financials;
  const survived = report.scenarios.filter((x) => x.kind !== 'baseline' && x.outcome?.survives).length;
  const stressed = report.scenarios.filter((x) => x.kind !== 'baseline' && x.outcome).length;

  return page(
    c,
    'Synthèse',
    `
    ${chapterTitle(CHAPTERS.summary)}

    <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-left:1.2mm solid ${VERDICT_COLOR[s.verdict]};border-radius:2mm;padding:6mm;background:${IDEM.surfaceSunken}">
      <div style="display:flex;align-items:center;gap:4mm;flex-wrap:wrap">
        ${pill(VERDICT_LABEL[s.verdict], VERDICT_COLOR[s.verdict])}
        <span style="font-family:${MONO};font-size:12pt;font-weight:500">${s.viabilityIndex}/${VIABILITY_CEILING}</span>
        <span style="font-size:8.5pt;color:${IDEM.inkMuted}">robustesse ${LEVEL_LABEL[s.robustness]} · confiance ${LEVEL_LABEL[s.confidence]} · ${survived}/${stressed} scénario${stressed > 1 ? 's' : ''} adverse${stressed > 1 ? 's' : ''} tenu${survived > 1 ? 's' : ''}</span>
      </div>
      <p style="margin-top:3.5mm;font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted}">${esc(VERDICT_MEANING[s.verdict])}</p>
      <p style="margin-top:4mm;padding-top:3.5mm;border-top:0.2mm solid ${IDEM.line};font-size:10pt;line-height:1.65;color:${IDEM.ink}">${esc(s.statement)}</p>
      ${
        report.verdictRationale
          ? `<p style="margin-top:3mm;font-size:9pt;line-height:1.65;color:${IDEM.inkMuted}">${esc(report.verdictRationale)}</p>`
          : ''
      }
    </div>

    ${heading('Les six chiffres à retenir', 'Chacun est repris et détaillé au chapitre 6.')}
    ${grid([
      stat(
        'Point mort',
        months(f.breakEvenMonth),
        f.breakEvenMonth === null
          ? "L'exploitation ne devient jamais durablement positive sur l'horizon simulé."
          : `Il faut financer ${f.breakEvenMonth} mois de pertes avant que l'exploitation ne s'autofinance.`,
      ),
      stat(
        'Autonomie',
        f.runwayMonths === null ? '> horizon' : `${f.runwayMonths} mois`,
        f.runwayMonths === null
          ? "La trésorerie ne passe jamais sous zéro sur l'horizon simulé."
          : `La trésorerie passe sous zéro au mois ${f.runwayMonths}${f.breakEvenMonth !== null && f.runwayMonths <= f.breakEvenMonth ? ' — avant le point mort.' : '.'}`,
      ),
      stat(
        'Capital requis',
        money(f.capitalRequired, f.currency),
        'Capital de départ plus le creux de trésorerie : le montant à réunir avant de lancer.',
      ),
      stat(
        'Marge brute',
        pct(f.grossMargin, 1),
        'Part du prix qui reste après le coût variable, avant toute charge fixe.',
      ),
      stat(
        'Chiffre d’affaires an 1',
        money(f.revenueYear1, f.currency),
        'Cumul des douze premiers mois, scénario de référence.',
      ),
      stat(
        'Chiffre d’affaires an 3',
        money(f.revenueYear3, f.currency),
        `Cumul des mois 25 à 36${f.revenueYear1 > 0 ? ` — ${decimal(f.revenueYear3 / f.revenueYear1)}× l'an 1.` : '.'}`,
      ),
    ])}

    ${report.viabilityBreakdown ? breakdownBlock(report.viabilityBreakdown) : ''}

    ${
      (report.strengths?.length ?? 0) + (report.weaknesses?.length ?? 0) > 0
        ? strengthsBlock(report.strengths ?? [], report.weaknesses ?? [])
        : ''
    }

    <p style="margin-top:8mm;padding-top:3mm;border-top:0.2mm solid ${IDEM.line};font-size:8pt;line-height:1.55;color:${IDEM.inkSubtle}">
      L'indice est plafonné à ${VIABILITY_CEILING} sur 100. Le moteur évalue un modèle sous des
      scénarios choisis, à partir d'hypothèses dont une part reste à vérifier sur le terrain :
      un score parfait affirmerait qu'il ne reste rien à confronter au réel.
    </p>
  `,
  );
}

// ---------------------------------------------------------------------------
// 03 — Le projet et ses chiffres
// ---------------------------------------------------------------------------

/**
 * Les paramètres d'entrée, et l'économie unitaire qu'ils produisent.
 *
 * C'est le chapitre qui manquait le plus : le rapport donnait un verdict sur un
 * modèle dont il ne montrait aucun paramètre. Le lecteur ne pouvait ni vérifier
 * l'hypothèse de rétention, ni voir que sa valeur vie client tombait sous son
 * coût d'acquisition — le fait qui explique à lui seul un tiers de l'indice.
 */
function baselineBlock(baseline: BusinessBaseline, unit?: UnitEconomics): string {
  const currency = baseline.currency;
  const rows: [string, string, string][] = [
    ['Prix unitaire encaissé', money(baseline.unitPrice, currency), 'Par transaction, toutes remises déduites.'],
    ['Coût variable unitaire', money(baseline.unitVariableCost, currency), 'Ce que chaque transaction coûte à servir.'],
    ['Charges fixes mensuelles', money(baseline.monthlyFixedCosts, currency), 'Dues que le chiffre d’affaires soit là ou non.'],
    ["Coût d'acquisition client", money(baseline.acquisitionCost, currency), 'Dépense marketing et commerciale par client gagné.'],
    ['Clients au premier mois', group(baseline.initialMonthlyCustomers), 'Nouveaux clients acquis le mois 1.'],
    ['Croissance mensuelle', pct(baseline.monthlyGrowthRate, 1), 'Progression des acquisitions d’un mois sur l’autre.'],
    ['Rétention mensuelle', pct(baseline.monthlyRetentionRate, 1), 'Part des clients encore actifs le mois suivant.'],
    ['Achats par client et par mois', decimal(baseline.purchasesPerCustomerPerMonth, 2), 'Fréquence d’achat d’un client actif.'],
    ['Capital de départ', money(baseline.startingCapital, currency), 'Trésorerie disponible au lancement.'],
  ];

  const unitCards = unit
    ? grid(
        [
          stat(
            'Marge par transaction',
            money(unit.grossMarginPerTransaction, currency),
            `Soit ${pct(unit.grossMarginRate, 1)} du prix encaissé.`,
          ),
          stat(
            'Durée de vie client',
            `${decimal(unit.expectedLifetimeMonths)} mois`,
            'Déduite de la rétention mensuelle : un client reste en moyenne ce temps-là.',
          ),
          stat(
            'Valeur vie client',
            money(unit.lifetimeValue, currency),
            'Marge totale attendue d’un client sur sa durée de vie.',
          ),
          stat(
            'Valeur vie / coût d’acquisition',
            ratio(unit.ltvToCac),
            unit.ltvToCac >= 3
              ? 'Au-dessus du seuil usuel de 3 : chaque client acquis rembourse largement son coût.'
              : unit.ltvToCac >= 1
                ? 'Sous le seuil usuel de 3 : le client rembourse son acquisition, mais laisse peu pour les charges fixes.'
                : 'Sous 1 : chaque client acquis coûte plus qu’il ne rapportera. Le modèle perd de l’argent en croissant.',
          ),
          stat(
            'Retour sur acquisition',
            unit.paybackMonths === null ? 'jamais' : `${decimal(unit.paybackMonths)} mois`,
            unit.paybackMonths === null
              ? 'Un client ne dégage aucune marge : son acquisition n’est jamais remboursée.'
              : 'Mois de marge nécessaires pour rembourser l’acquisition d’un client.',
          ),
        ],
        3,
      )
    : '';

  return `
    ${heading(
      'Les paramètres du modèle',
      'Toute la projection sort de ces neuf nombres. Une valeur fausse ici fausse tout ce qui suit.',
    )}
    ${table(
      ['Paramètre', 'Valeur', 'Ce que c’est'],
      rows.map(([label, value, note]) => [
        `<span style="font-weight:500">${esc(label)}</span>`,
        numeric(value),
        `<span style="font-size:8.5pt;color:${IDEM.inkMuted}">${esc(note)}</span>`,
      ]),
      ['l', 'r', 'l'],
    )}

    ${
      unit
        ? `${heading(
            'Économie unitaire',
            'Ce que ces paramètres impliquent pour un client, calculé par le moteur — c’est ce calcul qui note la première composante de l’indice.',
          )}
           ${unitCards}
           ${readingNote(
             `Le rapport valeur vie / coût d'acquisition est la mesure la plus dure de ce tableau : sous <strong style="color:${IDEM.ink}">1×</strong>, croître détruit de la trésorerie ; le seuil usuellement exigé par un investisseur est <strong style="color:${IDEM.ink}">3×</strong>. Ici : <strong style="color:${unit.ltvToCac >= 3 ? IDEM.go : unit.ltvToCac >= 1 ? IDEM.warn : IDEM.stop}">${esc(ratio(unit.ltvToCac))}</strong>.`,
           )}`
        : ''
    }`;
}

export function profileSection(c: Chrome, report: SimulationReport): string {
  const p = report.profile;
  const rows: [string, string | undefined][] = [
    ['Secteur', p.sector],
    ['Modèle économique', p.businessModel],
    ['Produit', p.product],
    ['Client cible', p.targetCustomer],
    ['Marché', p.market],
    ['Implantation', `${p.location}, ${p.country}`],
    ['Prix affiché', p.pricePoint],
    ['Financement prévu', p.plannedFunding],
    ['Équipe', p.teamSize],
  ];

  return page(
    c,
    'Le projet',
    `
    ${chapterTitle(
      CHAPTERS.project,
      "Toute la simulation repose sur cette lecture. C'est le seul chapitre que le fondateur doit relire ligne à ligne : une erreur ici invalide tout ce qui suit, et rien dans le reste du rapport ne la signalerait.",
    )}
    ${table(
      ['Élément', 'Lecture retenue'],
      rows
        .filter(([, value]) => !!value)
        .map(([label, value]) => [
          `<span style="color:${IDEM.inkMuted}">${esc(label)}</span>`,
          `<span style="font-weight:500">${esc(value as string)}</span>`,
        ]),
    )}
    ${report.baseline ? baselineBlock(report.baseline, report.unitEconomics) : ''}
  `,
  );
}

// ---------------------------------------------------------------------------
// 04 — Facteurs déterminants
// ---------------------------------------------------------------------------

export function factorsSection(c: Chrome, factors: Factor[], summary?: FactorSummary): string {
  const counts: FactorSummary = summary ?? {
    total: factors.length,
    critical: factors.filter((f) => f.tier === 'critical').length,
    important: factors.filter((f) => f.tier === 'important').length,
    secondary: factors.filter((f) => f.tier === 'secondary').length,
    unknown: factors.filter((f) => f.tier === 'unknown').length,
  };

  const tiers: Factor['tier'][] = ['critical', 'important', 'secondary', 'unknown'];

  const groups = tiers
    .map((tier) => {
      const group = factors.filter((factor) => factor.tier === tier).sort((a, b) => b.impact - a.impact);
      if (!group.length) return '';
      return `
      ${heading(`${TIER_LABEL[tier]} · ${group.length}`, TIER_MEANING[tier])}
      ${table(
        ['Facteur', 'Catégorie', 'Influence'],
        group.map((factor) => [
          `<p style="font-weight:600">${esc(factor.name)}</p>
           <p style="font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted};margin-top:0.8mm">${esc(factor.description)}</p>
           ${
             factor.evidence
               ? `<p style="font-size:8pt;color:${IDEM.inkSubtle};margin-top:1mm">${esc(factor.evidence.label)} : <span style="font-family:${MONO}">${esc(factor.evidence.value)}</span> · ${esc(EVIDENCE_LABEL[factor.evidence.kind].toLowerCase())}</p>`
               : ''
           }`,
          tag(factor.category),
          `<span style="white-space:nowrap">${meter(factor.impact / 100, IDEM.primary, IDEM.primaryTrack, '20mm')} ${numeric(String(factor.impact))}</span>`,
        ]),
        ['l', 'l', 'r'],
      )}`;
    })
    .join('');

  return page(
    c,
    'Facteurs',
    `
    ${chapterTitle(
      CHAPTERS.factors,
      "Les variables dont dépend le résultat, classées par ce qu'elles déplacent. Le classement n'est pas un avis : il vient de l'amplitude que chaque facteur imprime au modèle quand on le fait varier seul.",
    )}

    ${grid(
      [
        stat('Facteurs identifiés', String(counts.total)),
        stat('Critiques', String(counts.critical), counts.critical > 0 ? 'Changent le verdict à eux seuls.' : 'Aucun facteur ne renverse le verdict seul.'),
        stat('Importants', String(counts.important)),
        stat('Non cernés', String(counts.unknown), counts.unknown > 0 ? "Influence non établie : c'est de l'incertitude, pas de l'absence de risque." : 'Tous les facteurs ont pu être qualifiés.'),
      ],
      4,
    )}

    ${readingNote(
      "L'<strong>influence</strong> est une note relative de 0 à 100 : elle compare les facteurs entre eux à l'intérieur de ce projet, et ne se compare pas d'un projet à l'autre. Un facteur « non cerné » n'est pas un facteur sans effet — c'est un facteur dont l'effet n'a pas pu être mesuré.",
    )}

    ${groups}
  `,
  );
}

// ---------------------------------------------------------------------------
// 05 — Scénarios et stress tests
// ---------------------------------------------------------------------------

export function scenariosSection(c: Chrome, scenarios: Scenario[], currency: string): string {
  const order: Record<Scenario['kind'], number> = {
    baseline: 0,
    favourable: 1,
    adverse: 2,
    stress: 3,
    extreme: 4,
  };
  const ordered = [...scenarios].sort((a, b) => order[a.kind] - order[b.kind]);
  const adverse = ordered.filter((s) => s.kind !== 'baseline' && s.outcome);
  const survived = adverse.filter((s) => s.outcome!.survives).length;

  const comparison = table(
    ['Scénario', 'Nature', 'Indice', 'Point mort', 'Autonomie', 'Trésorerie basse', 'Issue'],
    ordered.map((scenario) => {
      const o = scenario.outcome;
      return [
        `<span style="font-weight:600">${esc(scenario.name)}</span>`,
        tag(KIND_LABEL[scenario.kind]),
        o ? numeric(String(o.viability), o.survives ? IDEM.ink : IDEM.stop) : '—',
        o ? numeric(o.breakEvenMonth === null ? 'jamais' : `M${o.breakEvenMonth}`) : '—',
        o ? numeric(o.runwayMonths === null ? '> 36' : `M${o.runwayMonths}`) : '—',
        o ? numeric(moneyShort(o.lowestCash, currency), o.lowestCash < 0 ? IDEM.stop : IDEM.ink) : '—',
        o ? state(o.survives ? 'tient' : 'casse', o.survives ? IDEM.go : IDEM.stop) : '—',
      ];
    }),
    ['l', 'l', 'r', 'r', 'r', 'r', 'l'],
  );

  const cards = ordered
    .map((scenario) => {
      const o = scenario.outcome;
      return `
      <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-left:1mm solid ${o ? (o.survives ? IDEM.go : IDEM.stop) : IDEM.line};border-radius:2mm;padding:5mm;background:${IDEM.surface};margin-bottom:4mm">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4mm">
          <div style="flex:1">
            <p style="font-size:11pt;font-weight:600">${esc(scenario.name)}</p>
            <p style="font-size:8.5pt;line-height:1.5;color:${IDEM.inkMuted};margin-top:0.8mm">${esc(scenario.question)}</p>
          </div>
          <div style="text-align:right;white-space:nowrap">
            ${tag(KIND_LABEL[scenario.kind])}
            ${
              o
                ? `<p style="font-family:${MONO};font-size:13pt;font-weight:500;margin-top:1.5mm;color:${o.survives ? IDEM.ink : IDEM.stop}">${o.viability}<span style="font-size:8pt;color:${IDEM.inkSubtle}">/${VIABILITY_CEILING}</span></p>`
                : ''
            }
          </div>
        </div>
        ${
          scenario.shifts.length
            ? `<div style="margin-top:3mm;padding-top:2.5mm;border-top:0.2mm solid ${IDEM.lineSoft}">
                 <p style="font-size:7pt;letter-spacing:.09em;text-transform:uppercase;color:${IDEM.inkSubtle};margin-bottom:1.5mm">Ce qui change</p>
                 <div style="display:flex;flex-wrap:wrap;gap:2mm">
                   ${scenario.shifts
                     .map(
                       (shift) =>
                         `<span style="display:inline-block;padding:0.8mm 2.2mm;border-radius:1.5mm;background:${IDEM.surfaceSunken};font-size:8pt;color:${IDEM.inkMuted}">${esc(shift.label)} <span style="font-family:${MONO};color:${IDEM.ink}">${esc(shift.delta)}</span></span>`,
                     )
                     .join('')}
                 </div>
               </div>`
            : `<p style="margin-top:3mm;padding-top:2.5mm;border-top:0.2mm solid ${IDEM.lineSoft};font-size:8pt;color:${IDEM.inkSubtle}">Aucun décalage appliqué : c'est le modèle tel qu'il a été lu.</p>`
        }
        ${
          o
            ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:3mm;padding-top:2.5mm;border-top:0.2mm solid ${IDEM.lineSoft}">
                ${[
                  ['Point mort', months(o.breakEvenMonth)],
                  ['Autonomie', o.runwayMonths === null ? '> horizon' : `${o.runwayMonths} mois`],
                  ['Trésorerie basse', money(o.lowestCash, currency)],
                  ['CA an 3', money(o.revenueYear3, currency)],
                ]
                  .map(
                    ([label, value]) => `<div>
                      <p style="font-size:7pt;letter-spacing:.07em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
                      <p style="font-family:${MONO};font-size:9pt;margin-top:0.8mm">${esc(value)}</p>
                    </div>`,
                  )
                  .join('')}
              </div>
              <p style="margin-top:3mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted}">${esc(o.narrative)}</p>`
            : ''
        }
      </div>`;
    })
    .join('');

  return page(
    c,
    'Scénarios',
    `
    ${chapterTitle(
      CHAPTERS.scenarios,
      "Le modèle est rejoué sous d'autres hypothèses. Un scénario n'est pas une prévision : c'est une question posée au modèle — « et si le prix devait baisser de 30 % ? » — et la réponse que le calcul lui donne.",
    )}

    ${comparison}

    ${readingNote(
      `Un scénario est <strong>tenu</strong> quand le modèle atteint l'équilibre ET conserve de la trésorerie en y arrivant. Ici, <strong style="color:${IDEM.ink}">${survived} des ${adverse.length}</strong> scénarios non-référence sont tenus : c'est ce rapport, et lui seul, qui donne la robustesse ${adverse.length ? `« ${esc(survived / adverse.length >= 0.7 ? 'élevée' : survived / adverse.length >= 0.4 ? 'moyenne' : 'faible')} »` : 'du rapport'}.`,
    )}

    ${heading('Le détail, scénario par scénario')}
    ${cards}
  `,
  );
}

// ---------------------------------------------------------------------------
// 06 — Trajectoire financière
// ---------------------------------------------------------------------------

/**
 * Courbe de trésorerie, en SVG inline.
 *
 * Les barres mensuelles disaient l'ampleur mais pas le mouvement, et
 * n'attiraient l'œil sur rien. La forme juste pour une série unique dans le
 * temps est une ligne ; la polarité (au-dessus ou en dessous de zéro) est
 * portée par deux aplats découpés sur la ligne du zéro — bleu / rouge, une
 * paire validée en vision normale comme sous deutéranopie et protanopie.
 *
 * Deux points seulement sont étiquetés — le creux et l'arrivée : une valeur sur
 * chaque point ne se lit pas, et une courbe sans repère ne se lit pas non plus.
 */
function cashChart(points: FinancialPoint[], currency: string, breakEvenMonth: number | null): string {
  if (points.length < 2) return '';

  // Repère : marges généreuses à gauche pour les montants, en bas pour les mois.
  const W = 680;
  const H = 250;
  const M = { top: 16, right: 18, bottom: 28, left: 62 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const cash = points.map((p) => p.cash);
  const rawMin = Math.min(0, ...cash);
  const rawMax = Math.max(0, ...cash);
  // Le zéro doit rester dans le cadre : c'est la ligne qui porte tout le sens.
  // La marge n'est ouverte que du côté où la courbe va réellement : en ouvrir
  // une sous zéro quand la trésorerie n'y descend jamais posait une graduation
  // négative en bas du cadre, à un cheveu de la ligne du zéro — deux repères
  // qui se contredisent.
  const pad = (rawMax - rawMin) * 0.08 || 1;
  const min = rawMin < 0 ? rawMin - pad : 0;
  const max = rawMax > 0 ? rawMax + pad : 0;
  const span = max - min || 1;

  const x = (index: number) => M.left + (index / (points.length - 1)) * plotW;
  const y = (value: number) => M.top + (1 - (value - min) / span) * plotH;
  const zeroY = y(0);

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.cash).toFixed(1)}`).join(' ');
  const area = `M ${x(0).toFixed(1)},${zeroY.toFixed(1)} L ${line.split(' ').join(' L ')} L ${x(points.length - 1).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const troughIndex = cash.indexOf(Math.min(...cash));
  const trough = points[troughIndex];
  const last = points[points.length - 1];

  // Graduations : quatre repères ronds, hairline pleine — jamais pointillée.
  const ticks = [max, max - span / 3, min + span / 3, min]
    .map((value) => ({ value, y: y(value) }))
    // Une graduation qui tombe sur la ligne du zéro superpose deux étiquettes.
    .filter((tick) => Math.abs(tick.y - zeroY) > 14);

  const monthTicks = points
    .map((p, i) => ({ month: p.month, i }))
    .filter(({ month, i }) => i === 0 || i === points.length - 1 || month % 6 === 0);

  const troughX = x(troughIndex);
  const troughY = y(trough.cash);
  // L'étiquette du creux bascule à droite quand le creux est trop à gauche pour
  // qu'elle tienne : elle n'est jamais rognée par le cadre.
  const troughAnchor = troughX < M.left + plotW * 0.35 ? 'start' : 'end';
  const troughOffset = troughAnchor === 'start' ? 9 : -9;
  // Un creux qui frôle le zéro laisse son étiquette sur la courbe : on l'écarte
  // franchement, du côté où il reste de la place.
  const troughLabelY = trough.cash < 0 ? troughY + 20 : troughY - 15;

  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
       aria-label="Trésorerie cumulée mois par mois, scénario de référence">
    <defs>
      <clipPath id="idem-cash-above"><rect x="${M.left}" y="${M.top}" width="${plotW}" height="${Math.max(zeroY - M.top, 0).toFixed(1)}"/></clipPath>
      <clipPath id="idem-cash-below"><rect x="${M.left}" y="${zeroY.toFixed(1)}" width="${plotW}" height="${Math.max(M.top + plotH - zeroY, 0).toFixed(1)}"/></clipPath>
    </defs>

    ${ticks
      .map(
        (tick) => `
    <line x1="${M.left}" y1="${tick.y.toFixed(1)}" x2="${W - M.right}" y2="${tick.y.toFixed(1)}" stroke="${IDEM.lineSoft}" stroke-width="1"/>
    <text x="${M.left - 8}" y="${(tick.y + 3.5).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="10" fill="${IDEM.inkSubtle}">${esc(moneyShort(tick.value, ''))}</text>`,
      )
      .join('')}

    <path d="${area}" fill="${IDEM.primary}" fill-opacity="0.10" clip-path="url(#idem-cash-above)"/>
    <path d="${area}" fill="${IDEM.stop}" fill-opacity="0.10" clip-path="url(#idem-cash-below)"/>

    <line x1="${M.left}" y1="${zeroY.toFixed(1)}" x2="${W - M.right}" y2="${zeroY.toFixed(1)}" stroke="${IDEM.inkSubtle}" stroke-width="1"/>
    <text x="${M.left - 8}" y="${(zeroY + 3.5).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="10" fill="${IDEM.ink}">0</text>

    ${
      breakEvenMonth !== null && breakEvenMonth >= 1 && breakEvenMonth <= points.length
        ? `<line x1="${x(breakEvenMonth - 1).toFixed(1)}" y1="${M.top}" x2="${x(breakEvenMonth - 1).toFixed(1)}" y2="${(M.top + plotH).toFixed(1)}" stroke="${IDEM.go}" stroke-width="1"/>
           <text x="${(x(breakEvenMonth - 1) + 5).toFixed(1)}" y="${(M.top + 10).toFixed(1)}" font-family="${MONO}" font-size="10" fill="${IDEM.go}">point mort · M${breakEvenMonth}</text>`
        : ''
    }

    <polyline points="${line}" fill="none" stroke="${IDEM.primary}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#idem-cash-above)"/>
    <polyline points="${line}" fill="none" stroke="${IDEM.stop}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#idem-cash-below)"/>

    <circle cx="${troughX.toFixed(1)}" cy="${troughY.toFixed(1)}" r="5" fill="${trough.cash < 0 ? IDEM.stop : IDEM.primary}" stroke="${IDEM.surface}" stroke-width="2"/>
    <text x="${(troughX + troughOffset).toFixed(1)}" y="${troughLabelY.toFixed(1)}" text-anchor="${troughAnchor}" font-family="${MONO}" font-size="10.5" fill="${IDEM.ink}">creux M${trough.month} · ${esc(moneyShort(trough.cash, currency))}</text>

    <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.cash).toFixed(1)}" r="5" fill="${last.cash < 0 ? IDEM.stop : IDEM.primary}" stroke="${IDEM.surface}" stroke-width="2"/>
    <text x="${(x(points.length - 1) - 7).toFixed(1)}" y="${(y(last.cash) - 10).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="10.5" fill="${IDEM.ink}">M${last.month} · ${esc(moneyShort(last.cash, currency))}</text>

    ${monthTicks
      .map(
        ({ month, i }) =>
          `<text x="${x(i).toFixed(1)}" y="${(M.top + plotH + 18).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="${IDEM.inkSubtle}">M${month}</text>`,
      )
      .join('')}
  </svg>`;
}

/** Agrégation annuelle — les périodes de douze mois depuis le lancement. */
function yearlyRows(points: FinancialPoint[]): {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  endCash: number;
  endCustomers: number;
}[] {
  const years: ReturnType<typeof yearlyRows> = [];
  for (let start = 0; start < points.length; start += 12) {
    const slice = points.slice(start, start + 12);
    if (!slice.length) break;
    const revenue = slice.reduce((sum, p) => sum + p.revenue, 0);
    const costs = slice.reduce((sum, p) => sum + p.costs, 0);
    years.push({
      year: Math.floor(start / 12) + 1,
      revenue,
      costs,
      result: revenue - costs,
      endCash: slice[slice.length - 1].cash,
      endCustomers: slice[slice.length - 1].activeCustomers,
    });
  }
  return years;
}

export function financialsSection(c: Chrome, f: FinancialSummary): string {
  const points = f.points ?? [];
  const lowest = points.length ? Math.min(...points.map((p) => p.cash)) : 0;
  const years = yearlyRows(points);

  // Détail mensuel : les douze premiers mois en entier — c'est là que tout se
  // joue et que le besoin de financement se constitue — puis un mois par
  // trimestre. Un tableau de 36 lignes identiques ne se lit pas.
  const detail = points.filter((p, index) => index < 12 || p.month % 3 === 0);

  return page(
    c,
    'Trajectoire',
    `
    ${chapterTitle(
      CHAPTERS.financials,
      "La trésorerie mois par mois dans le scénario de référence. Le creux le plus bas de la courbe est le chiffre le plus important du rapport : c'est le capital qu'il faut avoir réuni avant de lancer.",
    )}

    ${grid(
      [
        stat(
          'Capital requis',
          money(f.capitalRequired, f.currency),
          'Capital de départ augmenté du creux de trésorerie.',
        ),
        stat(
          'Trésorerie au plus bas',
          money(lowest, f.currency),
          lowest < 0 ? `Découvert atteint dans le scénario de référence.` : 'La trésorerie ne passe jamais sous zéro.',
        ),
        stat(
          'Consommation mensuelle',
          money(f.monthlyBurnRate, f.currency),
          'Moyenne des mois déficitaires : le rythme auquel la réserve se vide.',
        ),
      ],
      3,
    )}

    <div data-keep-together style="margin-top:6mm;border:0.25mm solid ${IDEM.line};border-radius:2mm;padding:5mm 5mm 4mm;background:${IDEM.surface}">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:3mm">
        <p style="font-size:9pt;font-weight:600;color:${IDEM.ink}">Trésorerie cumulée · ${points.length} mois</p>
        <p style="font-size:7.5pt;color:${IDEM.inkSubtle}">Au-dessus de zéro : réserve · en dessous : découvert</p>
      </div>
      ${cashChart(points, f.currency, f.breakEvenMonth)}
    </div>

    ${readingNote(
      f.breakEvenMonth === null
        ? "La courbe ne remonte jamais durablement : l'exploitation n'atteint pas l'équilibre sur l'horizon simulé. Le capital requis n'est donc pas un besoin ponctuel, c'est un financement à reconduire."
        : `La courbe descend jusqu'au creux, puis remonte à partir du point mort (mois ${f.breakEvenMonth}). Ce qu'il faut réunir n'est pas le total des pertes mais la <strong style="color:${IDEM.ink}">profondeur du creux</strong> — au-delà, l'exploitation se finance elle-même.`,
    )}

    ${heading(
      'Par période de douze mois',
      'Périodes comptées depuis le lancement, distinctes de l’exercice comptable.',
    )}
    ${table(
      [
        'Période',
        `Chiffre d’affaires (${f.currency})`,
        `Coûts (${f.currency})`,
        `Résultat (${f.currency})`,
        'Clients actifs',
        `Trésorerie (${f.currency})`,
      ],
      years.map((year) => [
        `<span style="white-space:nowrap"><span style="font-weight:600">An ${year.year}</span> <span style="font-size:8pt;color:${IDEM.inkSubtle}">M${(year.year - 1) * 12 + 1}–M${year.year * 12}</span></span>`,
        numeric(money(year.revenue, '')),
        numeric(money(year.costs, '')),
        numeric(money(year.result, ''), year.result < 0 ? IDEM.stop : IDEM.ink),
        numeric(group(year.endCustomers)),
        numeric(money(year.endCash, ''), year.endCash < 0 ? IDEM.stop : IDEM.ink),
      ]),
      ['l', 'r', 'r', 'r', 'r', 'r'],
    )}

    ${heading(
      'Le détail mensuel',
      'Les douze premiers mois en entier, puis un mois par trimestre.',
    )}
    ${table(
      [
        'Mois',
        'Clients actifs',
        `Revenus (${f.currency})`,
        `Coûts (${f.currency})`,
        `Résultat (${f.currency})`,
        `Trésorerie (${f.currency})`,
      ],
      detail.map((point) => [
        numeric(`M${point.month}`),
        numeric(group(point.activeCustomers)),
        numeric(money(point.revenue, '')),
        numeric(money(point.costs, '')),
        numeric(
          money(point.revenue - point.costs, ''),
          point.revenue - point.costs < 0 ? IDEM.stop : IDEM.ink,
        ),
        numeric(money(point.cash, ''), point.cash < 0 ? IDEM.stop : IDEM.ink),
      ]),
      ['l', 'r', 'r', 'r', 'r', 'r'],
    )}
  `,
  );
}

// ---------------------------------------------------------------------------
// 07 — Leviers et conditions
// ---------------------------------------------------------------------------

export function leversSection(
  c: Chrome,
  sensitivity: SensitivityEntry[],
  conditions: ViabilityCondition[],
): string {
  const ordered = [...sensitivity].sort(
    (a, b) => Math.abs(b.viabilityDelta) - Math.abs(a.viabilityDelta),
  );
  const maxDelta = Math.max(1, ...ordered.map((entry) => Math.abs(entry.viabilityDelta)));
  const strongest = ordered[0];
  const unmet = conditions.filter((condition) => condition.met === false).length;
  const unknown = conditions.filter((condition) => condition.met === null).length;

  return page(
    c,
    'Leviers',
    `
    ${chapterTitle(
      CHAPTERS.levers,
      "Ce qui déplace réellement le résultat, et les seuils que le modèle doit tenir. Chaque levier est bougé seul, tout le reste maintenu constant : l'effet lu ici est celui de ce levier, et d'aucun autre.",
    )}

    ${heading('Sensibilité', 'Points d’indice gagnés ou perdus quand un levier bouge, seul.')}
    ${table(
      ['Levier', 'Variation testée', 'Effet sur l’indice'],
      ordered.map((entry) => {
        const positive = entry.viabilityDelta >= 0;
        return [
          `<span style="font-weight:500">${esc(entry.factorName)}</span>`,
          `<span style="color:${IDEM.inkMuted}">${esc(entry.change)}</span>`,
          `<span style="white-space:nowrap">${divergingBar(entry.viabilityDelta / maxDelta, positive)}
           <span style="font-family:${MONO};font-size:9pt;font-weight:500;color:${positive ? IDEM.primary : IDEM.stop};margin-left:2mm;font-variant-numeric:tabular-nums">${positive ? '+' : '−'}${Math.abs(entry.viabilityDelta)}</span></span>`,
        ];
      }),
      ['l', 'l', 'r'],
    )}

    ${
      strongest
        ? readingNote(
            `La barre part du centre : à droite le levier fait gagner des points, à gauche il en fait perdre, et sa longueur dit combien. Le levier le plus puissant est ici <strong style="color:${IDEM.ink}">${esc(strongest.factorName.toLowerCase())}</strong> (${esc(strongest.change)}, ${strongest.viabilityDelta >= 0 ? '+' : '−'}${Math.abs(strongest.viabilityDelta)} points) : c'est par lui qu'un effort produit le plus d'effet.`,
          )
        : ''
    }

    ${heading(
      'Conditions de viabilité',
      'Des seuils, pas des objectifs : sous ces valeurs, les scénarios cessent de tenir.',
    )}
    ${table(
      ['Condition', 'Seuil à tenir', 'Valeur actuelle', 'État'],
      conditions.map((condition) => [
        `<span style="font-weight:500">${esc(condition.label)}</span>`,
        numeric(condition.threshold),
        numeric(condition.currentValue ?? '—'),
        condition.met === null
          ? tag('à vérifier', IDEM.inkSubtle)
          : condition.met
            ? state('tenue', IDEM.go)
            : state('non tenue', IDEM.stop),
      ]),
      ['l', 'r', 'r', 'l'],
    )}

    ${
      conditions.length
        ? readingNote(
            unmet > 0
              ? `<strong style="color:${IDEM.stop}">${unmet} condition${unmet > 1 ? 's ne sont pas tenues' : ' n’est pas tenue'}</strong>${unknown ? `, et ${unknown} reste${unknown > 1 ? 'nt' : ''} à vérifier` : ''}. Ce sont les seuils à traiter en premier : le chapitre 8 dit comment.`
              : `Toutes les conditions mesurables sont tenues${unknown ? ` ; ${unknown} reste${unknown > 1 ? 'nt' : ''} à vérifier sur le terrain` : ''}. Cela ne garantit pas le résultat : cela signifie que le modèle n'est pas disqualifié par ses propres seuils.`,
          )
        : ''
    }
  `,
  );
}

// ---------------------------------------------------------------------------
// 08 — Recommandations
// ---------------------------------------------------------------------------

/**
 * RECOMMANDATIONS — un seul chapitre, mené par l'action.
 *
 * ── CE QUE CE CHAPITRE CORRIGE ──────────────────────────────────────────────
 *
 * Il a d'abord fallu réunir ce qui était séparé : les risques d'un côté, les
 * recommandations de l'autre, à trente pages de distance. Le lecteur qui venait
 * de lire « la marge ne tient pas sous un choc de prix » devait retenir le
 * problème, poursuivre, et refaire lui-même l'appariement à l'arrivée. Personne
 * ne le fait.
 *
 * Il fallait ensuite décider lequel des deux mène. Un chapitre nommé
 * « Problèmes » se lit comme une liste d'inquiétudes : le fondateur en sort en
 * sachant ce qui ne va pas, pas ce qu'il doit faire lundi matin. C'est donc
 * l'ACTION qui porte la carte, et le problème qui vient dessous, en
 * justification — le même appariement, dans l'ordre où on l'utilise.
 *
 * Les problèmes qu'aucune action ne traite ne disparaissent pas pour autant :
 * ils sont listés à part, annoncés comme non résolus. Les taire pour ne garder
 * que ce qui a une réponse serait le seul vrai mensonge possible ici.
 */
export function actionsSection(
  c: Chrome,
  risks: Risk[],
  recommendations: Recommendation[],
  validationNeeded: string[],
): string {
  const severityRank = (severity: Risk['severity']) =>
    ['moderate', 'high', 'critical'].indexOf(severity);
  const priorityRank = (priority: Recommendation['priority']) =>
    ['low', 'medium', 'high', 'critical'].indexOf(priority);

  const riskById = new Map(risks.map((risk) => [risk.id, risk]));
  const answered = new Set<string>();

  const ordered = [...recommendations].sort((a, b) => {
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority !== 0) return byPriority;
    const riskA = a.addressesRiskId ? riskById.get(a.addressesRiskId) : undefined;
    const riskB = b.addressesRiskId ? riskById.get(b.addressesRiskId) : undefined;
    return (riskB ? severityRank(riskB.severity) : -1) - (riskA ? severityRank(riskA.severity) : -1);
  });

  const cards = ordered
    .map((item, index) => {
      const risk = item.addressesRiskId ? riskById.get(item.addressesRiskId) : undefined;
      if (risk) answered.add(risk.id);

      return `
      <div data-keep-together style="border:0.25mm solid ${IDEM.line};border-left:1.2mm solid ${PRIORITY_COLOR[item.priority]};border-radius:2mm;padding:5mm;background:${IDEM.surface};margin-bottom:4mm">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4mm">
          <p style="font-size:10.5pt;font-weight:600;color:${IDEM.ink};flex:1">
            <span style="font-family:${MONO};color:${IDEM.inkSubtle};margin-right:2.5mm">${String(index + 1).padStart(2, '0')}</span>${esc(item.title)}
          </p>
          ${pill(`Priorité ${PRIORITY_LABEL[item.priority].toLowerCase()}`, PRIORITY_COLOR[item.priority])}
        </div>
        <p style="margin-top:2.5mm;font-size:9pt;line-height:1.65;color:${IDEM.inkMuted}">${esc(item.body)}</p>

        <div style="margin-top:3.5mm;border-left:0.6mm solid ${risk ? SEVERITY_COLOR[risk.severity] : IDEM.line};padding-left:4mm">
          <p style="font-size:7pt;letter-spacing:.11em;text-transform:uppercase;color:${IDEM.inkSubtle};font-weight:600">Pourquoi</p>
          ${
            risk
              ? `<p style="margin-top:1.2mm;font-size:9pt;font-weight:600;color:${IDEM.ink}">${esc(risk.title)} <span style="font-weight:500;font-size:8pt;color:${SEVERITY_COLOR[risk.severity]}">· problème ${esc(SEVERITY_LABEL[risk.severity].toLowerCase())}</span></p>
                 <p style="margin-top:1.2mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted}">${esc(risk.description)}</p>`
              : `<p style="margin-top:1.2mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted}">Cette action ne répond à aucun problème identifié en particulier : elle renforce le modèle dans son ensemble.</p>`
          }
        </div>

        <p style="margin-top:3mm;padding-top:2.5mm;border-top:0.2mm solid ${IDEM.lineSoft};font-size:8pt;color:${IDEM.inkSubtle}">
          Impact attendu ${LEVEL_LABEL[item.expectedImpact]} · confiance dans cette recommandation ${LEVEL_LABEL[item.confidence]}
        </p>
      </div>`;
    })
    .join('');

  const open = risks
    .filter((risk) => !answered.has(risk.id))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const openBlock = open.length
    ? `${heading(
        'Problèmes sans réponse dégagée',
        "L'analyse les a relevés sans pouvoir proposer d'action : ils restent ouverts et doivent être arbitrés.",
      )}
       ${open
         .map(
           (risk) => `
         <div data-keep-together style="display:flex;gap:4mm;align-items:baseline;padding:3.5mm 0;border-bottom:0.2mm solid ${IDEM.lineSoft}">
           <div style="flex:1">
             <p style="font-size:9.5pt;font-weight:600;color:${IDEM.ink}">${esc(risk.title)}</p>
             <p style="margin-top:1.2mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted}">${esc(risk.description)}</p>
           </div>
           ${tag(SEVERITY_LABEL[risk.severity], SEVERITY_COLOR[risk.severity])}
         </div>`,
         )
         .join('')}`
    : '';

  const criticalCount = ordered.filter((item) => item.priority === 'critical').length;

  return page(
    c,
    'Problèmes et Recommandations',
    `
    ${chapterTitle(
      CHAPTERS.actions,
      "Les actions dégagées par l'analyse, classées par priorité. Chaque action porte, juste dessous, le problème qu'elle traite : c'est ce lien qui la rend vérifiable — une recommandation dont on ne voit pas le problème n'est qu'un conseil.",
    )}

    ${
      ordered.length
        ? `${readingNote(
            criticalCount > 0
              ? `<strong style="color:${IDEM.stop}">${criticalCount} action${criticalCount > 1 ? 's sont critiques' : ' est critique'}</strong> : elle${criticalCount > 1 ? 's traitent' : ' traite'} un problème qui remet le modèle en cause. Les autres se planifient ; celles-là se traitent avant de lancer.`
              : "Aucune action n'est critique : l'analyse n'a relevé aucun problème qui remette le modèle en cause. Les actions ci-dessous consolident un modèle qui tient.",
          )}
           <div style="margin-top:6mm">${cards}</div>`
        : `<p style="font-size:9.5pt;color:${IDEM.inkMuted}">L'analyse n'a dégagé aucune action à ce stade.</p>`
    }

    ${openBlock}

    ${
      validationNeeded.length
        ? `${heading(
            'À confronter au marché réel',
            'Ce que la simulation ne peut pas trancher, et qu’une semaine de terrain trancherait.',
          )}
           <ul data-keep-together style="list-style:none">
             ${validationNeeded
               .map(
                 (item) =>
                   `<li style="display:flex;gap:2.5mm;font-size:9pt;line-height:1.6;color:${IDEM.inkMuted};margin-bottom:2mm">
                      <span style="color:${IDEM.primary};flex:none">—</span><span>${esc(item)}</span>
                    </li>`,
               )
               .join('')}
           </ul>`
        : ''
    }
  `,
  );
}

// ---------------------------------------------------------------------------
// 09 — Hypothèses, sources et portée
// ---------------------------------------------------------------------------

export function evidenceSection(
  c: Chrome,
  evidence: Evidence[],
  keyUncertainties: string[] = [],
): string {
  const counts = {
    data: evidence.filter((e) => e.kind === 'data').length,
    estimate: evidence.filter((e) => e.kind === 'estimate').length,
    assumption: evidence.filter((e) => e.kind === 'assumption').length,
  };

  return page(
    c,
    'Sources',
    `
    ${chapterTitle(
      CHAPTERS.evidence,
      "Chaque valeur porte sa nature et son niveau de confiance. Une hypothèse n'est pas une donnée : la distinction est ce qui autorise à se servir du reste du rapport.",
    )}

    ${grid(
      [
        stat('Données observées', String(counts.data), 'Chiffres sourcés, vérifiables.'),
        stat('Estimations', String(counts.estimate), 'Dérivées de comparables.'),
        stat('Hypothèses', String(counts.assumption), 'Choix assumés du moteur, faute de mieux.'),
      ],
      3,
    )}

    ${readingNote(
      `C'est cette répartition, et rien d'autre, qui produit le niveau de confiance affiché en couverture. Les lignes marquées <strong style="color:${IDEM.warn}">hypothèse</strong> sont celles à confronter au terrain en premier : ce sont les seules que la simulation n'a pas pu appuyer.`,
    )}

    ${heading('Le détail des valeurs')}
    ${table(
      ['Élément', 'Valeur', 'Nature', 'Confiance', 'Source'],
      evidence.map((item) => [
        `<p style="font-weight:500">${esc(item.label)}</p>${item.note ? `<p style="font-size:8pt;line-height:1.5;color:${IDEM.inkSubtle};margin-top:0.6mm">${esc(item.note)}</p>` : ''}`,
        numeric(item.value),
        tag(EVIDENCE_LABEL[item.kind], item.kind === 'assumption' ? IDEM.warn : IDEM.inkMuted),
        `<span style="font-size:8.5pt;color:${IDEM.inkMuted}">${LEVEL_LABEL[item.confidence]}</span>`,
        `<span style="font-size:8pt;color:${IDEM.inkSubtle}">${esc(item.source ?? '—')}${item.asOf ? ` · ${esc(item.asOf)}` : ''}</span>`,
      ]),
    )}

    ${
      keyUncertainties.length
        ? `${heading(
            'Ce que la simulation ne peut pas trancher',
            'Les incertitudes qu’aucun calcul ne lèvera : seule la confrontation au réel le fera.',
          )}
           <ul data-keep-together style="list-style:none">
             ${keyUncertainties
               .map(
                 (item) =>
                   `<li style="display:flex;gap:2.5mm;font-size:9pt;line-height:1.6;color:${IDEM.inkMuted};margin-bottom:2mm">
                      <span style="color:${IDEM.warn};flex:none">—</span><span>${esc(item)}</span>
                    </li>`,
               )
               .join('')}
           </ul>`
        : ''
    }

    <div data-keep-together style="margin-top:8mm;border:0.25mm solid ${IDEM.line};border-radius:2mm;padding:5mm;background:${IDEM.surfaceSunken}">
      <p style="font-size:9pt;line-height:1.65;color:${IDEM.inkMuted}">
        <strong style="color:${IDEM.ink}">Portée de ce rapport.</strong>
        Une simulation met un modèle à l'épreuve dans les scénarios testés. Elle ne prédit pas
        l'avenir de l'entreprise et ne remplace ni une étude de marché, ni un avis comptable ou
        juridique. Les valeurs marquées « hypothèse » sont des choix assumés du moteur, à
        confronter au terrain avant toute décision d'engagement. C'est pour la même raison que
        l'indice de viabilité est plafonné à ${VIABILITY_CEILING} sur 100 : l'échelle réserve
        ce qu'aucune estimation ne peut établir.
      </p>
    </div>
  `,
  );
}
