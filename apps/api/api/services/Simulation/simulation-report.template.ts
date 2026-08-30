/**
 * Template fixe du rapport de simulation.
 *
 * Fixe, et non généré: un rapport que l'on met entre les mains d'un banquier ou
 * d'un investisseur doit être identique d'une exécution à l'autre. Seules les
 * données changent. La charte est celle d'IDEM — Jura, le bleu #1447e6, le
 * motif de fond — appliquée sur une page claire, qui reste lisible à
 * l'impression comme à l'écran.
 *
 * Chaque section rend un bloc `.idem-flow` : les enfants positionnés en absolu
 * (motif, en-tête, pied) sont répliqués par le paginateur sur chaque page de la
 * section, le reste est du flux que le paginateur redécoupe sans jamais couper
 * un bloc.
 */

import {
  ConfidenceLevel,
  Evidence,
  Factor,
  FinancialSummary,
  Recommendation,
  Robustness,
  Scenario,
  SensitivityEntry,
  SimulationModel,
  SimulationReport,
  Verdict,
  ViabilityCondition,
} from '../../models/simulation.model';

// ---------------------------------------------------------------------------
// Charte
// ---------------------------------------------------------------------------

export const IDEM = {
  primary: '#1447e6',
  primarySoft: '#eaf0ff',
  accent: '#22d3ee',
  ink: '#0b1220',
  inkMuted: '#4d5769',
  inkSubtle: '#8a93a5',
  line: '#e3e8f0',
  surface: '#ffffff',
  surfaceSunken: '#f7f9fc',
  go: '#0f7a56',
  warn: '#a45a09',
  stop: '#bb2d45',
} as const;

/** Jura est la police de marque IDEM ; JetBrains Mono porte les chiffres. */
export const IDEM_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

const MONO = "'JetBrains Mono', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Utilitaires de rendu
// ---------------------------------------------------------------------------

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${currency}`;
}

function months(value: number | null): string {
  return value === null || value === undefined ? 'jamais atteint' : `mois ${value}`;
}

function pct(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value * 100)} %` : '—';
}

const VERDICT_LABEL: Record<Verdict, string> = {
  go: 'GO',
  'go-with-conditions': 'GO SOUS CONDITIONS',
  'no-go': 'NO-GO',
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

const TIER_COLOR: Record<Factor['tier'], string> = {
  critical: IDEM.stop,
  important: IDEM.warn,
  secondary: IDEM.primary,
  unknown: IDEM.inkSubtle,
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

// ---------------------------------------------------------------------------
// Briques communes
// ---------------------------------------------------------------------------

/** Numéro + titre de section, l'ancrage visuel de tout le document. */
function sectionTitle(index: number, title: string, lead?: string): string {
  return `
    <div style="margin-bottom:7mm">
      <p style="font-family:${MONO};font-size:8pt;letter-spacing:.14em;color:${IDEM.primary};margin-bottom:2mm">
        ${String(index).padStart(2, '0')}
      </p>
      <h2 style="font-size:19pt;font-weight:600;color:${IDEM.ink};line-height:1.2">${esc(title)}</h2>
      ${
        lead
          ? `<p style="margin-top:2.5mm;font-size:9.5pt;line-height:1.6;color:${IDEM.inkMuted};max-width:150mm">${esc(lead)}</p>`
          : ''
      }
    </div>`;
}

/** Étiquette pleine, réservée aux verdicts et aux niveaux de gravité. */
function pill(text: string, color: string): string {
  return `<span style="display:inline-block;padding:1mm 2.6mm;border-radius:999px;background:${color};color:#fff;font-size:7.5pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase">${esc(text)}</span>`;
}

/** Étiquette discrète, pour les catégories et les provenances. */
function tag(text: string, color: string = IDEM.inkMuted): string {
  return `<span style="display:inline-block;padding:0.8mm 2.2mm;border:0.3mm solid ${IDEM.line};border-radius:1.5mm;color:${color};font-size:7.5pt;font-weight:500">${esc(text)}</span>`;
}

/** Chiffre isolé : le rapport se parcourt d'abord par ses nombres. */
function stat(label: string, value: string, hint?: string): string {
  return `
    <div style="border:0.3mm solid ${IDEM.line};border-radius:2.5mm;padding:4mm;background:${IDEM.surface}">
      <p style="font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
      <p style="font-family:${MONO};font-size:14pt;font-weight:500;color:${IDEM.ink};margin-top:1.5mm">${esc(value)}</p>
      ${hint ? `<p style="font-size:8pt;color:${IDEM.inkMuted};margin-top:1mm">${esc(hint)}</p>` : ''}
    </div>`;
}

function grid(cells: string[], columns = 3): string {
  return `<div style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:3.5mm">${cells.join('')}</div>`;
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
                `<th style="text-align:${align(i)};padding:2.5mm 2mm;border-bottom:0.4mm solid ${IDEM.ink};font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:${IDEM.inkMuted};font-weight:600">${esc(h)}</th>`,
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
                    `<td style="text-align:${align(i)};padding:2.5mm 2mm;border-bottom:0.25mm solid ${IDEM.line};color:${IDEM.ink};vertical-align:top">${cell}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

/** Barre proportionnelle : rendue en CSS, aucun graphique à rasteriser. */
function bar(ratio: number, color: string): string {
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return `<span style="display:inline-block;width:26mm;height:1.6mm;border-radius:999px;background:${IDEM.line};vertical-align:middle">
    <span style="display:block;width:${width.toFixed(1)}%;height:1.6mm;border-radius:999px;background:${color}"></span>
  </span>`;
}

// ---------------------------------------------------------------------------
// Enveloppe de page
// ---------------------------------------------------------------------------

interface Chrome {
  motifDataUri: string;
  logoDataUri: string;
  projectName: string;
}

/**
 * Décor répété sur chaque page de la section : le paginateur clone les enfants
 * positionnés en absolu, c'est par eux que passent le motif, l'en-tête et le
 * pied de page.
 */
function chrome(c: Chrome, sectionName: string): string {
  return `
    <div style="position:absolute;inset:0;background-image:url('${c.motifDataUri}');background-repeat:repeat;background-size:140mm;opacity:0.09;pointer-events:none"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:20mm;padding:8mm 18mm 0;display:flex;align-items:center;justify-content:space-between">
      <img src="${c.logoDataUri}" alt="IDEM" style="height:5.5mm;width:auto" />
      <p style="font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(sectionName)}</p>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:14mm;padding:0 18mm 7mm;display:flex;align-items:flex-end;justify-content:space-between">
      <p style="font-size:7.5pt;color:${IDEM.inkSubtle}">${esc(c.projectName)} — Rapport de simulation IDEM</p>
      <p style="font-size:7.5pt;color:${IDEM.inkSubtle}">Aide à la décision, non une prédiction</p>
    </div>`;
}

/** Une section du rapport : décor fixe + flux paginable. */
function page(c: Chrome, sectionName: string, body: string): string {
  return `
    <div style="position:relative;width:210mm;min-height:297mm;background:${IDEM.surface};padding:26mm 18mm 20mm;font-family:'Jura',system-ui,sans-serif;color:${IDEM.ink}">
      ${chrome(c, sectionName)}
      ${body}
    </div>`;
}

// ---------------------------------------------------------------------------
// Sections
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
      <div style="position:absolute;inset:0;background-image:url('${c.motifDataUri}');background-repeat:repeat;background-size:140mm;opacity:0.11;pointer-events:none"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:2.2mm;background:linear-gradient(90deg,${IDEM.primary},${IDEM.accent})"></div>

      <div style="position:relative">
        <img src="${c.logoDataUri}" alt="IDEM" style="height:9mm;width:auto" />
        <p style="margin-top:2mm;font-size:9pt;letter-spacing:.22em;text-transform:uppercase;color:${IDEM.inkSubtle}">Simulator</p>
      </div>

      <div style="position:relative">
        <p style="font-family:${MONO};font-size:9pt;letter-spacing:.14em;color:${IDEM.primary}">RAPPORT DE SIMULATION</p>
        <h1 style="margin-top:4mm;font-size:34pt;font-weight:600;line-height:1.1;letter-spacing:-0.01em">${esc(report.profile.name)}</h1>
        <p style="margin-top:5mm;font-size:11pt;line-height:1.6;color:${IDEM.inkMuted};max-width:140mm">${esc(report.profile.product)}</p>

        <div style="margin-top:12mm;display:flex;align-items:center;gap:6mm">
          <div>
            <p style="font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:${IDEM.inkSubtle}">Indice de viabilité</p>
            <p style="font-family:${MONO};font-size:44pt;font-weight:500;line-height:1;color:${IDEM.ink}">${summary.viabilityIndex}<span style="font-size:16pt;color:${IDEM.inkSubtle}">/100</span></p>
          </div>
          <div style="width:0.3mm;height:24mm;background:${IDEM.line}"></div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2.5mm">
            ${pill(VERDICT_LABEL[summary.verdict], VERDICT_COLOR[summary.verdict])}
            <p style="font-size:9pt;color:${IDEM.inkMuted}">Robustesse ${LEVEL_LABEL[summary.robustness]} · Confiance ${LEVEL_LABEL[summary.confidence]}</p>
          </div>
        </div>
      </div>

      <div style="position:relative">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;padding-top:6mm;border-top:0.3mm solid ${IDEM.line}">
          ${[
            ['Secteur', report.profile.sector],
            ['Marché', report.profile.market],
            ['Modèle', report.profile.businessModel],
            ['Révision', `n° ${simulation.revision}`],
          ]
            .map(
              ([label, value]) => `<div>
                <p style="font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
                <p style="margin-top:1mm;font-size:9pt;color:${IDEM.ink}">${esc(value)}</p>
              </div>`,
            )
            .join('')}
        </div>
        <p style="margin-top:6mm;font-size:8pt;color:${IDEM.inkSubtle}">Généré le ${generated} · ${esc(report.profile.location)}, ${esc(report.profile.country)}</p>
      </div>
    </div>`;
}

export function summarySection(c: Chrome, report: SimulationReport): string {
  const s = report.executiveSummary;
  const f = report.financials;

  return page(
    c,
    'Synthèse',
    `
    ${sectionTitle(1, 'Synthèse', "Ce que la simulation dit du modèle, dans les scénarios testés — et rien au-delà.")}

    <div style="border:0.3mm solid ${IDEM.line};border-left:1.2mm solid ${VERDICT_COLOR[s.verdict]};border-radius:2.5mm;padding:6mm;background:${IDEM.surfaceSunken};margin-bottom:6mm">
      <div style="display:flex;align-items:center;gap:4mm;margin-bottom:3.5mm">
        ${pill(VERDICT_LABEL[s.verdict], VERDICT_COLOR[s.verdict])}
        <span style="font-family:${MONO};font-size:12pt;font-weight:500">${s.viabilityIndex}/100</span>
        <span style="font-size:8.5pt;color:${IDEM.inkMuted}">robustesse ${LEVEL_LABEL[s.robustness]} · confiance ${LEVEL_LABEL[s.confidence]}</span>
      </div>
      <p style="font-size:10pt;line-height:1.65;color:${IDEM.ink}">${esc(s.statement)}</p>
    </div>

    ${grid([
      stat('Point mort', months(f.breakEvenMonth)),
      stat('Autonomie', f.runwayMonths === null ? '> horizon' : `${f.runwayMonths} mois`, f.runwayMonths === null ? 'jamais épuisée sur 36 mois' : undefined),
      stat('Capital requis', money(f.capitalRequired, f.currency)),
      stat('Marge brute', pct(f.grossMargin)),
      stat('Chiffre d’affaires an 1', money(f.revenueYear1, f.currency)),
      stat('Chiffre d’affaires an 3', money(f.revenueYear3, f.currency)),
    ])}
  `,
  );
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
    ['Prix', p.pricePoint],
    ['Financement prévu', p.plannedFunding],
    ['Équipe', p.teamSize],
  ];

  return page(
    c,
    'Le projet',
    `
    ${sectionTitle(2, 'Le projet tel que le moteur l’a lu', 'Toute la simulation repose sur cette lecture. Une erreur ici invalide ce qui suit.')}
    ${table(
      ['Élément', 'Valeur'],
      rows
        .filter(([, value]) => !!value)
        .map(([label, value]) => [
          `<span style="color:${IDEM.inkMuted}">${esc(label)}</span>`,
          esc(value as string),
        ]),
    )}
  `,
  );
}

export function factorsSection(c: Chrome, factors: Factor[]): string {
  const ordered = [...factors].sort((a, b) => b.impact - a.impact);

  return page(
    c,
    'Facteurs',
    `
    ${sectionTitle(3, 'Facteurs déterminants', "Ce qui fait bouger le résultat, classé par influence relative sur le modèle.")}
    ${table(
      ['Facteur', 'Catégorie', 'Niveau', 'Influence'],
      ordered.map((factor) => [
        `<p style="font-weight:600">${esc(factor.name)}</p><p style="font-size:8.5pt;line-height:1.55;color:${IDEM.inkMuted};margin-top:0.8mm">${esc(factor.description)}</p>`,
        tag(factor.category),
        `<span style="color:${TIER_COLOR[factor.tier]};font-weight:600;font-size:8.5pt">${TIER_LABEL[factor.tier]}</span>`,
        `<span style="white-space:nowrap">${bar(factor.impact / 100, TIER_COLOR[factor.tier])} <span style="font-family:${MONO};font-size:8.5pt">${factor.impact}</span></span>`,
      ]),
      ['l', 'l', 'l', 'r'],
    )}
  `,
  );
}

export function scenariosSection(c: Chrome, scenarios: Scenario[], currency: string): string {
  const cards = scenarios
    .map((scenario) => {
      const o = scenario.outcome;
      return `
      <div style="border:0.3mm solid ${IDEM.line};border-radius:2.5mm;padding:5mm;background:${IDEM.surface};margin-bottom:4mm">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4mm;margin-bottom:2mm">
          <div>
            <p style="font-size:11pt;font-weight:600">${esc(scenario.name)}</p>
            <p style="font-size:8.5pt;color:${IDEM.inkMuted};margin-top:0.8mm">${esc(scenario.question)}</p>
          </div>
          <div style="text-align:right;white-space:nowrap">
            ${tag(KIND_LABEL[scenario.kind])}
            ${
              o
                ? `<p style="font-family:${MONO};font-size:13pt;font-weight:500;margin-top:1.5mm;color:${o.survives ? IDEM.go : IDEM.stop}">${o.viability}/100</p>`
                : ''
            }
          </div>
        </div>
        ${
          scenario.shifts.length
            ? `<p style="font-size:8pt;color:${IDEM.inkSubtle};margin-bottom:2mm">${scenario.shifts
                .map((shift) => `${esc(shift.label)} ${esc(shift.delta)}`)
                .join(' · ')}</p>`
            : ''
        }
        ${
          o
            ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;padding-top:2.5mm;border-top:0.25mm solid ${IDEM.line}">
                ${[
                  ['Point mort', months(o.breakEvenMonth)],
                  ['Autonomie', o.runwayMonths === null ? '—' : `${o.runwayMonths} mois`],
                  ['Trésorerie basse', money(o.lowestCash, currency)],
                  ['CA an 3', money(o.revenueYear3, currency)],
                ]
                  .map(
                    ([label, value]) => `<div>
                      <p style="font-size:7pt;letter-spacing:.06em;text-transform:uppercase;color:${IDEM.inkSubtle}">${esc(label)}</p>
                      <p style="font-family:${MONO};font-size:9pt;margin-top:0.6mm">${esc(value)}</p>
                    </div>`,
                  )
                  .join('')}
              </div>
              <p style="margin-top:2.5mm;font-size:8.5pt;line-height:1.6;color:${IDEM.inkMuted}">${esc(o.narrative)}</p>`
            : ''
        }
      </div>`;
    })
    .join('');

  return page(
    c,
    'Scénarios',
    `${sectionTitle(4, 'Scénarios et stress tests', "Le modèle est rejoué sous d'autres hypothèses : ce qu'il devient quand les choses se passent mal.")}${cards}`,
  );
}

export function financialsSection(c: Chrome, f: FinancialSummary): string {
  // Une courbe de trésorerie tracée en CSS : ni canvas, ni image à charger.
  const points = f.points ?? [];
  const cash = points.map((p) => p.cash);
  const min = Math.min(0, ...cash);
  const max = Math.max(1, ...cash);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  // Barres ancrées sur la ligne du zéro : au-dessus on capitalise, en dessous
  // on creuse. Une barre partant du bas ferait passer un découvert pour une
  // réserve.
  const bars = points
    .map((point) => {
      const value = ((point.cash - min) / span) * 100;
      const negative = point.cash < 0;
      const bottom = negative ? value : zero;
      const height = Math.abs(value - zero);
      const color = negative ? IDEM.stop : IDEM.primary;
      return `<span style="display:inline-block;width:${(100 / Math.max(points.length, 1)).toFixed(3)}%;height:34mm;vertical-align:bottom;position:relative">
        <span style="position:absolute;bottom:${bottom.toFixed(1)}%;left:8%;right:8%;height:${Math.max(height, 0.4).toFixed(1)}%;background:${color};opacity:.85;border-radius:${negative ? '0 0 0.5mm 0.5mm' : '0.5mm 0.5mm 0 0'}"></span>
      </span>`;
    })
    .join('');

  return page(
    c,
    'Trajectoire',
    `
    ${sectionTitle(5, 'Trajectoire financière', "La trésorerie mois par mois dans le scénario de référence. Le creux le plus bas dicte le capital à réunir.")}

    ${grid(
      [
        stat('Consommation mensuelle', money(f.monthlyBurnRate, f.currency)),
        stat('Point mort', months(f.breakEvenMonth)),
        stat('Capital requis', money(f.capitalRequired, f.currency)),
      ],
      3,
    )}

    <div style="margin-top:6mm;border:0.3mm solid ${IDEM.line};border-radius:2.5mm;padding:5mm;background:${IDEM.surface}">
      <p style="font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:${IDEM.inkSubtle};margin-bottom:3mm">Trésorerie cumulée · ${points.length} mois</p>
      <div style="position:relative;font-size:0;white-space:nowrap;border-bottom:0.3mm solid ${IDEM.line}">
        <span style="position:absolute;left:0;right:0;bottom:${zero.toFixed(1)}%;height:0.25mm;background:${IDEM.line}"></span>
        ${bars}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2mm;font-family:${MONO};font-size:7.5pt;color:${IDEM.inkSubtle}">
        <span>M1</span><span>Creux ${money(min, f.currency)}</span><span>M${points.length}</span>
      </div>
    </div>

    <div style="margin-top:6mm">
      ${table(
        ['Mois', 'Clients actifs', 'Revenus', 'Coûts', 'Trésorerie'],
        points
          .filter((_, index) => index % 6 === 0 || index === points.length - 1)
          .map((point) => [
            `<span style="font-family:${MONO}">M${point.month}</span>`,
            `<span style="font-family:${MONO}">${Math.round(point.activeCustomers)}</span>`,
            `<span style="font-family:${MONO}">${money(point.revenue, f.currency)}</span>`,
            `<span style="font-family:${MONO}">${money(point.costs, f.currency)}</span>`,
            `<span style="font-family:${MONO};color:${point.cash < 0 ? IDEM.stop : IDEM.ink}">${money(point.cash, f.currency)}</span>`,
          ]),
        ['l', 'r', 'r', 'r', 'r'],
      )}
    </div>
  `,
  );
}

export function leversSection(
  c: Chrome,
  sensitivity: SensitivityEntry[],
  conditions: ViabilityCondition[],
): string {
  const maxDelta = Math.max(1, ...sensitivity.map((entry) => Math.abs(entry.viabilityDelta)));

  return page(
    c,
    'Leviers',
    `
    ${sectionTitle(6, 'Leviers et conditions', "Ce qui déplace réellement le résultat, et les seuils que le modèle doit tenir.")}

    <h3 style="font-size:11pt;font-weight:600;margin-bottom:3mm">Sensibilité</h3>
    ${table(
      ['Levier', 'Variation testée', 'Effet sur la viabilité'],
      sensitivity.map((entry) => {
        const positive = entry.viabilityDelta >= 0;
        return [
          esc(entry.factorName),
          `<span style="color:${IDEM.inkMuted}">${esc(entry.change)}</span>`,
          `<span style="white-space:nowrap">${bar(Math.abs(entry.viabilityDelta) / maxDelta, positive ? IDEM.go : IDEM.stop)}
           <span style="font-family:${MONO};font-size:9pt;color:${positive ? IDEM.go : IDEM.stop}">${positive ? '+' : ''}${entry.viabilityDelta}</span></span>`,
        ];
      }),
      ['l', 'l', 'r'],
    )}

    <h3 style="font-size:11pt;font-weight:600;margin:7mm 0 3mm">Conditions de viabilité</h3>
    ${table(
      ['Condition', 'Seuil', 'Valeur actuelle', 'État'],
      conditions.map((condition) => [
        esc(condition.label),
        `<span style="font-family:${MONO};font-size:8.5pt">${esc(condition.threshold)}</span>`,
        `<span style="font-family:${MONO};font-size:8.5pt">${esc(condition.currentValue ?? '—')}</span>`,
        condition.met === null
          ? tag('à vérifier', IDEM.inkSubtle)
          : condition.met
            ? `<span style="color:${IDEM.go};font-weight:600;font-size:8.5pt">tenue</span>`
            : `<span style="color:${IDEM.stop};font-weight:600;font-size:8.5pt">non tenue</span>`,
      ]),
    )}
  `,
  );
}

export function recommendationsSection(
  c: Chrome,
  recommendations: Recommendation[],
  validationNeeded: string[],
): string {
  const ranked = [...recommendations].sort(
    (a, b) =>
      ['low', 'medium', 'high', 'critical'].indexOf(b.priority) -
      ['low', 'medium', 'high', 'critical'].indexOf(a.priority),
  );

  const cards = ranked
    .map(
      (item, index) => `
      <div style="display:flex;gap:4mm;padding:4.5mm 0;border-bottom:0.25mm solid ${IDEM.line}">
        <p style="font-family:${MONO};font-size:11pt;color:${IDEM.primary};min-width:8mm">${String(index + 1).padStart(2, '0')}</p>
        <div style="flex:1">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:3mm">
            <p style="font-size:10.5pt;font-weight:600">${esc(item.title)}</p>
            ${tag(PRIORITY_LABEL[item.priority], item.priority === 'critical' ? IDEM.stop : IDEM.inkMuted)}
          </div>
          <p style="margin-top:1.5mm;font-size:9pt;line-height:1.6;color:${IDEM.inkMuted}">${esc(item.body)}</p>
          <p style="margin-top:1.5mm;font-size:8pt;color:${IDEM.inkSubtle}">Impact attendu ${LEVEL_LABEL[item.expectedImpact]} · confiance ${LEVEL_LABEL[item.confidence]}</p>
        </div>
      </div>`,
    )
    .join('');

  return page(
    c,
    'Recommandations',
    `
    ${sectionTitle(7, 'Recommandations', "Par ordre de priorité. Chacune porte l'impact attendu et le niveau de confiance du moteur.")}
    ${cards}

    ${
      validationNeeded.length
        ? `<h3 style="font-size:11pt;font-weight:600;margin:7mm 0 3mm">À confronter au marché réel</h3>
           <ul style="list-style:none">
             ${validationNeeded
               .map(
                 (item) =>
                   `<li style="display:flex;gap:2.5mm;font-size:9pt;line-height:1.6;color:${IDEM.inkMuted};margin-bottom:1.8mm">
                      <span style="color:${IDEM.primary}">—</span><span>${esc(item)}</span>
                    </li>`,
               )
               .join('')}
           </ul>`
        : ''
    }
  `,
  );
}

export function evidenceSection(c: Chrome, evidence: Evidence[]): string {
  return page(
    c,
    'Sources',
    `
    ${sectionTitle(8, 'Hypothèses et sources', "Chaque valeur porte sa nature et son niveau de confiance. Une hypothèse n'est pas une donnée.")}
    ${table(
      ['Élément', 'Valeur', 'Nature', 'Confiance', 'Source'],
      evidence.map((item) => [
        `<p>${esc(item.label)}</p>${item.note ? `<p style="font-size:8pt;color:${IDEM.inkSubtle};margin-top:0.6mm">${esc(item.note)}</p>` : ''}`,
        `<span style="font-family:${MONO};font-size:8.5pt">${esc(item.value)}</span>`,
        tag(EVIDENCE_LABEL[item.kind], item.kind === 'assumption' ? IDEM.warn : IDEM.inkMuted),
        `<span style="font-size:8.5pt;color:${IDEM.inkMuted}">${LEVEL_LABEL[item.confidence]}</span>`,
        `<span style="font-size:8pt;color:${IDEM.inkSubtle}">${esc(item.source ?? '—')}${item.asOf ? ` · ${esc(item.asOf)}` : ''}</span>`,
      ]),
    )}

    <div style="margin-top:8mm;border:0.3mm solid ${IDEM.line};border-radius:2.5mm;padding:5mm;background:${IDEM.surfaceSunken}">
      <p style="font-size:9pt;line-height:1.65;color:${IDEM.inkMuted}">
        <strong style="color:${IDEM.ink}">Portée de ce rapport.</strong>
        Une simulation met un modèle à l'épreuve dans les scénarios testés. Elle ne prédit pas
        l'avenir de l'entreprise et ne remplace ni une étude de marché, ni un avis comptable ou
        juridique. Les valeurs marquées « hypothèse » sont des choix assumés du moteur, à
        confronter au terrain avant toute décision d'engagement.
      </p>
    </div>
  `,
  );
}
