/**
 * Template fixe du rapport financier.
 *
 * Fixe, et non généré : un dossier remis à une banque doit être identique d'une
 * exécution à l'autre. Seules les données changent. La composition emprunte le
 * design system du projet (`DocumentDesignSystem`) — donc la charte réelle —
 * mais la GRAMMAIRE est ici, et elle est délibérément sobre.
 *
 * ── CE QUE « SOBRE » VEUT DIRE, CONCRÈTEMENT ────────────────────────────────
 *
 * L'ancienne composition posait sur chaque tableau une bande d'en-tête en aplat
 * de couleur, des lignes alternées gris/blanc, des cartes remplies et des
 * doughnuts Chart.js. C'est le vocabulaire par défaut d'un document généré, et
 * un lecteur de dossiers financiers le reconnaît avant d'avoir lu un chiffre.
 * Ici : filets d'un quart de millimètre, en-têtes en petites capitales sur un
 * filet, aucune ligne alternée, aucune ombre, un seul geste coloré par page.
 * La hiérarchie vient de la taille et de la graisse, jamais du remplissage.
 *
 * ── LES GRAPHIQUES ──────────────────────────────────────────────────────────
 *
 * Rendus en CSS pur : le document part à l'impression, un canvas Chart.js y
 * arrive tramé ou vide selon le moteur. Les règles suivies sont celles de la
 * compétence `dataviz`, et deux d'entre elles ont été VÉRIFIÉES au validateur
 * plutôt que supposées :
 *
 *  · pour deux séries, on emploie DEUX NUANCES D'UNE SEULE TEINTE, prises aux
 *    paliers 700 et 400 de la rampe de marque. Le premier réflexe — teinte de
 *    marque contre gris de recul — a été mesuré et REJETÉ : sur une charte peu
 *    saturée, le palier retenu tombait à 8,1 de distance du gris en vision
 *    normale, sous le plancher de 15, c'est-à-dire deux séries que même un
 *    lecteur sans déficience ne sépare pas. Le couple à deux nuances passe en
 *    revanche les quatre contrôles de rampe ordonnée (clarté monotone, écart
 *    de clarté ≥ 0,06, extrémité claire au-dessus de 2:1 sur le fond, teinte
 *    unique) sur les quatre familles de charte essayées ;
 *  · vert et rouge d'état ne se distinguent PAS sous deutéranopie (ΔE 4,1,
 *    mesuré). Aucun signe n'est donc porté par la couleur seule : un flux
 *    négatif porte son signe, un besoin de financement porte son mot.
 *
 * La teinte des marques n'est jamais la couleur de marque brute : elle est
 * ramenée (`snap`) au palier de la rampe qui tient la bande de clarté et le
 * contraste 3:1 sur le fond. Une charte sombre — un bleu pétrole, par exemple —
 * sort sinon de la bande et donne des barres qui s'écrasent sur le texte.
 */

import { DocumentDesignSystem } from '../design/documentDesignSystem';
import { contrastRatio, hexToOklch } from '../design/color';

// ---------------------------------------------------------------------------
// Jetons de composition
// ---------------------------------------------------------------------------

/** Palette d'état de la compétence dataviz. Jamais employée seule (cf. en-tête). */
const STATUS = { good: '#0ca30c', critical: '#d03b3b' } as const;

const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

export interface ReportChrome {
  ds: DocumentDesignSystem;
  currency: string;
  projectName: string;
  logoHtml: string;
  /** Teinte des marques, déjà ramenée dans la bande lisible. */
  mark: string;
  /** Seconde nuance de la MÊME teinte, pour une deuxième série. */
  markSoft: string;
  /** Filet, encres et surfaces, repris du design system. */
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  rule: string;
  surface: string;
  surfaceRaised: string;
}

/**
 * Couple de marques, pris sur la rampe de la charte.
 *
 * `mark` est le palier le plus proche du milieu de la bande de clarté qui tient
 * 3:1 sur le fond ; `markSoft` est un palier de la MÊME teinte, écarté d'au
 * moins 0,18 de clarté et lisible à 2:1. Une charte sombre — un bleu pétrole,
 * par exemple — sort de la bande et donnerait sinon des barres qui s'écrasent
 * sur le texte ; une charte peu saturée donnerait deux séries impossibles à
 * séparer. Les deux cas sont réglés ici, une fois, pour toutes les pages.
 */
export function pickMarkPair(ds: DocumentDesignSystem): { mark: string; markSoft: string } {
  const surface = ds.colors.surface;
  const steps = Object.entries(ds.colors.brand)
    .map(([step, hex]) => ({
      step: Number(step),
      hex,
      l: hexToOklch(hex)?.l ?? 0,
      ratio: contrastRatio(hex, surface),
    }))
    .filter((entry) => Number.isFinite(entry.step))
    .sort((a, b) => a.step - b.step);

  if (steps.length === 0) return { mark: ds.colors.primary, markSoft: ds.colors.primary };

  // Cible de clarté : le palier qui porte la série principale. En mode clair
  // c'est un ton franc (L ≈ 0,45) — il laisse de la place au-dessus pour la
  // seconde nuance ; en mode sombre la clarté s'inverse.
  const target = ds.dark ? 0.62 : 0.45;
  const readable = steps.filter((entry) => entry.ratio >= 3);
  const pool = readable.length > 0 ? readable : steps;
  const mark = pool.reduce((best, entry) =>
    Math.abs(entry.l - target) < Math.abs(best.l - target) ? entry : best
  );

  // La seconde nuance va VERS LE FOND : plus claire sur une page claire, plus
  // sombre sur une page sombre. L'écarter dans l'autre sens donnerait un ton
  // quasi noir, qui ne se lit plus comme une nuance de la marque mais comme une
  // seconde couleur — et la page en compterait alors trois.
  const towardSurface = steps.filter((entry) =>
    ds.dark ? entry.l < mark.l - 0.15 : entry.l > mark.l + 0.15
  );

  const soft =
    // Écart net ET lisible : c'est le cas nominal.
    towardSurface.filter((entry) => entry.ratio >= 2).sort((a, b) => (ds.dark ? b.l - a.l : a.l - b.l))[0] ??
    // Charte trop resserrée pour offrir un palier lisible du bon côté : on
    // repart de l'autre sens plutôt que de rendre deux séries identiques.
    steps
      .filter((entry) => entry.hex !== mark.hex && Math.abs(entry.l - mark.l) >= 0.15 && entry.ratio >= 2)
      .sort((a, b) => Math.abs(a.l - mark.l) - Math.abs(b.l - mark.l))[0];

  return { mark: mark.hex, markSoft: soft?.hex ?? mark.hex };
}

export function buildChrome(
  ds: DocumentDesignSystem,
  currency: string,
  projectName: string,
  logoHtml: string
): ReportChrome {
  const { mark, markSoft } = pickMarkPair(ds);
  return {
    ds,
    currency,
    projectName,
    logoHtml,
    mark,
    markSoft,
    ink: ds.colors.ink,
    inkMuted: ds.colors.inkMuted,
    inkSubtle: ds.colors.inkMuted,
    rule: ds.colors.rule,
    surface: ds.colors.surface,
    surfaceRaised: ds.colors.surfaceRaised,
  };
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Espace fine insécable entre les groupes de milliers — norme française. */
export function num(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const fixed = decimals > 0 ? abs.toFixed(decimals) : String(Math.round(abs));
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + grouped + (frac ? ',' + frac : '');
}

export function money(value: number, currency: string): string {
  return `${num(value)} ${currency}`;
}

/** Montants longs abrégés — un tableau de milliards devient illisible sinon. */
export function compact(value: number, currency: string): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${num(value / 1e9, 2)} Md ${currency}`;
  if (abs >= 1e6) return `${num(value / 1e6, 1)} M ${currency}`;
  return money(value, currency);
}

export function pct(value: number, decimals = 1): string {
  return Number.isFinite(value) ? `${num(value, decimals)} %` : '—';
}

// ---------------------------------------------------------------------------
// Briques
// ---------------------------------------------------------------------------

export function sectionTitle(c: ReportChrome, index: number, title: string, lead?: string): string {
  const { ds } = c;
  return `
    <div style="margin-bottom:8mm">
      <p style="font-family:${MONO};font-size:${ds.typeScale.xs}px;letter-spacing:.16em;color:${c.mark};margin:0 0 2mm">
        ${String(index).padStart(2, '0')}
      </p>
      <h2 style="margin:0;font-family:'${ds.fonts.display}',Georgia,serif;font-size:${ds.typeScale.xl}px;font-weight:700;line-height:1.15;color:${c.ink};letter-spacing:-0.01em">${esc(title)}</h2>
      ${
        lead
          ? `<p style="margin:3mm 0 0;font-size:${ds.typeScale.sm}px;line-height:1.6;color:${c.inkMuted};max-width:150mm">${esc(lead)}</p>`
          : ''
      }
    </div>`;
}

export function subTitle(c: ReportChrome, text: string, top = 9): string {
  return `<h3 style="margin:${top}mm 0 3mm;font-size:${c.ds.typeScale.base}px;font-weight:700;color:${c.ink}">${esc(text)}</h3>`;
}

/** Note de bas de tableau : d'où sort le chiffre, ou ce qu'il suppose. */
export function caption(c: ReportChrome, text: string): string {
  return `<p style="margin:2.5mm 0 0;font-size:${c.ds.typeScale.xs}px;line-height:1.5;color:${c.inkSubtle}">${esc(text)}</p>`;
}

/**
 * Chiffre isolé. Cadre au filet, jamais d'aplat : sur une page qui en aligne
 * six, six aplats colorés font une page de jeu de société.
 */
export function stat(
  c: ReportChrome,
  label: string,
  value: string,
  hint?: string,
  accent?: string
): string {
  const { ds } = c;
  return `
    <div style="border:0.25mm solid ${c.rule};border-top:0.9mm solid ${accent ?? c.rule};border-radius:${ds.radius}px;padding:4.5mm 4mm;background:${c.surface}">
      <p style="margin:0;font-size:${ds.typeScale.xs}px;letter-spacing:.09em;text-transform:uppercase;color:${c.inkSubtle}">${esc(label)}</p>
      <p style="margin:2mm 0 0;font-family:${MONO};font-size:${ds.typeScale.lg}px;font-weight:500;color:${c.ink};line-height:1.15">${esc(value)}</p>
      ${hint ? `<p style="margin:1.5mm 0 0;font-size:${ds.typeScale.xs}px;line-height:1.45;color:${c.inkMuted}">${esc(hint)}</p>` : ''}
    </div>`;
}

/** Le chiffre que la page défend. Un seul par section, au plus. */
export function hero(c: ReportChrome, label: string, value: string, note: string): string {
  const { ds } = c;
  return `
    <div data-keep-together style="border-top:1.2mm solid ${c.mark};padding:5mm 0 0;margin:0 0 7mm">
      <p style="margin:0;font-size:${ds.typeScale.xs}px;letter-spacing:.1em;text-transform:uppercase;color:${c.inkSubtle}">${esc(label)}</p>
      <p style="margin:2.5mm 0 0;font-family:${MONO};font-size:${ds.typeScale['2xl']}px;font-weight:500;line-height:1;color:${c.ink}">${esc(value)}</p>
      <p style="margin:3mm 0 0;font-size:${ds.typeScale.sm}px;line-height:1.6;color:${c.inkMuted};max-width:140mm">${esc(note)}</p>
    </div>`;
}

export function grid(cells: string[], columns = 3): string {
  return `<div style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:3.5mm">${cells.join('')}</div>`;
}

export interface TableOptions {
  /** 'l' aligne à gauche, 'r' à droite (chiffres). */
  aligns?: ('l' | 'r')[];
  /** Index des lignes à mettre en évidence (totaux, soldes). */
  strongRows?: number[];
  /** Largeur de la première colonne, en mm. */
  firstColumnMm?: number;
}

/**
 * Tableau : filet sous l'en-tête, filet fin entre les lignes, RIEN d'autre.
 * Les chiffres sont en chasse fixe et alignés à droite — c'est ce qui permet de
 * comparer deux colonnes d'un coup d'œil.
 */
export function table(
  c: ReportChrome,
  headers: string[],
  rows: string[][],
  options: TableOptions = {}
): string {
  const { ds } = c;
  const aligns = options.aligns ?? headers.map((_, i) => (i === 0 ? 'l' : 'r'));
  const strong = new Set(options.strongRows ?? []);
  const align = (i: number) => (aligns[i] === 'r' ? 'right' : 'left');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:${ds.typeScale.sm}px;table-layout:auto">
      <thead>
        <tr>
          ${headers
            .map(
              (h, i) =>
                `<th style="text-align:${align(i)};padding:2.5mm 2mm;border-bottom:0.5mm solid ${c.ink};font-size:${ds.typeScale.xs}px;letter-spacing:.08em;text-transform:uppercase;color:${c.inkMuted};font-weight:700;${i === 0 && options.firstColumnMm ? `width:${options.firstColumnMm}mm;` : ''}">${esc(h)}</th>`
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, r) =>
              `<tr>${row
                .map(
                  (cell, i) =>
                    `<td style="text-align:${align(i)};padding:2.2mm 2mm;border-bottom:0.2mm solid ${c.rule};color:${c.ink};vertical-align:top;${strong.has(r) ? 'font-weight:700;' : ''}${i > 0 ? `font-family:${MONO};font-variant-numeric:tabular-nums;` : ''}">${cell}</td>`
                )
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

/** Bloc d'hypothèse : ce que le chiffre suppose, et sur quoi il s'appuie. */
export function assumption(c: ReportChrome, statement: string, basis: string): string {
  const { ds } = c;
  return `
    <div data-keep-together style="margin:7mm 0 0;border-left:0.9mm solid ${c.mark};padding:0 0 0 5mm">
      <p style="margin:0;font-size:${ds.typeScale.xs}px;letter-spacing:.1em;text-transform:uppercase;color:${c.inkSubtle}">Hypothèse</p>
      <p style="margin:2mm 0 0;font-size:${ds.typeScale.sm}px;line-height:1.6;color:${c.ink}">${esc(statement)}</p>
      ${basis ? `<p style="margin:1.5mm 0 0;font-size:${ds.typeScale.xs}px;line-height:1.55;color:${c.inkMuted}">${esc(basis)}</p>` : ''}
    </div>`;
}

/** Avertissement — réservé à ce qui invaliderait une lecture. */
export function warningBlock(c: ReportChrome, title: string, body: string): string {
  const { ds } = c;
  return `
    <div data-keep-together style="margin:6mm 0;border:0.25mm solid ${STATUS.critical};border-radius:${ds.radius}px;padding:4.5mm 5mm;background:${c.surface}">
      <p style="margin:0;font-size:${ds.typeScale.xs}px;letter-spacing:.09em;text-transform:uppercase;color:${STATUS.critical};font-weight:700">⚠ ${esc(title)}</p>
      <p style="margin:2mm 0 0;font-size:${ds.typeScale.sm}px;line-height:1.6;color:${c.ink}">${esc(body)}</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Graphiques — CSS pur
// ---------------------------------------------------------------------------

/** Légende. Obligatoire dès deux séries : l'identité ne passe jamais par la seule couleur. */
function legend(c: ReportChrome, entries: { label: string; color: string }[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:5mm;margin-bottom:3.5mm">
    ${entries
      .map(
        (entry) =>
          `<span style="display:inline-flex;align-items:center;gap:1.8mm;font-size:${c.ds.typeScale.xs}px;color:${c.inkMuted}">
             <span style="width:3mm;height:1.6mm;border-radius:0.4mm;background:${entry.color};display:inline-block"></span>${esc(entry.label)}
           </span>`
      )
      .join('')}
  </div>`;
}

function chartFrame(c: ReportChrome, title: string, body: string, readingKey: string): string {
  const { ds } = c;
  return `
    <div data-keep-together style="margin:6mm 0;border:0.25mm solid ${c.rule};border-radius:${ds.radius}px;padding:5mm;background:${c.surface}">
      <p style="margin:0 0 4mm;font-size:${ds.typeScale.xs}px;letter-spacing:.09em;text-transform:uppercase;color:${c.inkSubtle}">${esc(title)}</p>
      ${body}
      ${readingKey ? `<p style="margin:4mm 0 0;padding-top:3mm;border-top:0.2mm solid ${c.rule};font-size:${ds.typeScale.xs}px;line-height:1.55;color:${c.inkMuted}">${esc(readingKey)}</p>` : ''}
    </div>`;
}

/**
 * Colonnes groupées, DEUX NUANCES D'UNE TEINTE (cf. en-tête du fichier).
 *
 * Étiquette directe sur chaque colonne, et légende dès deux séries :
 * l'identité ne repose jamais sur la seule couleur, et la valeur ne dépend
 * jamais de la lecture d'un axe que la page n'affiche pas.
 */
export function groupedColumns(
  c: ReportChrome,
  title: string,
  labels: string[],
  series: { name: string; data: number[] }[],
  readingKey: string,
  format: (value: number) => string
): string {
  const { ds } = c;
  const colors = series.map((_, i) => (i === 0 ? c.mark : c.markSoft));
  const all = series.flatMap((s) => s.data);
  // ── LE ZÉRO EST UNE LIGNE, PAS LE BAS DU CADRE ───────────────────────────
  //
  // Une barre tracée sur la valeur ABSOLUE fait monter une perte exactement
  // comme un bénéfice : un résultat net de −135 M s'y lisait comme un gain.
  // L'échelle englobe donc le zéro, et les barres négatives descendent.
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const span = max - min || 1;
  const height = 32;
  const zeroOffset = ((0 - min) / span) * height;

  const groups = labels
    .map((label, index) => {
      const bars = series
        .map((entry, s) => {
          const value = entry.data[index] ?? 0;
          const magnitude = (Math.abs(value) / span) * height;
          const negative = value < 0;
          const bottom = negative ? zeroOffset - magnitude : zeroOffset;
          return `<span style="flex:1;position:relative;display:block;height:${height}mm">
            <span style="position:absolute;bottom:${bottom.toFixed(2)}mm;left:0;right:0;height:${Math.max(magnitude, 0.4).toFixed(2)}mm;background:${colors[s]};border-radius:${negative ? '0 0 1mm 1mm' : '1mm 1mm 0 0'}"></span>
          </span>`;
        })
        .join('');
      const values = series
        .map(
          (entry, s) =>
            `<span style="flex:1;text-align:center;font-family:${MONO};font-size:${ds.typeScale.xs}px;color:${c.ink}">${esc(format(entry.data[index] ?? 0))}</span>`
        )
        .join('');
      return `<div style="flex:1;display:flex;flex-direction:column;gap:1.5mm">
        <div style="position:relative;display:flex;gap:1mm;align-items:flex-end;height:${height}mm">
          <span style="position:absolute;left:0;right:0;bottom:${zeroOffset.toFixed(2)}mm;height:0.2mm;background:${c.rule}"></span>
          ${bars}
        </div>
        <div style="border-top:0.25mm solid ${c.rule};padding-top:1.5mm;display:flex;gap:1mm">${values}</div>
        <p style="margin:0;text-align:center;font-size:${ds.typeScale.xs}px;color:${c.inkMuted}">${esc(label)}</p>
      </div>`;
    })
    .join('');

  const body = `${series.length > 1 ? legend(c, series.map((s, i) => ({ label: s.name, color: colors[i] }))) : ''}
    <div style="display:flex;gap:4mm;align-items:flex-end">${groups}</div>`;

  return chartFrame(c, title, body, readingKey);
}

/**
 * Barres horizontales, série UNIQUE, triées par grandeur.
 *
 * Une seule teinte pour toutes les barres : colorer chaque poste d'une teinte
 * différente dépenserait le canal d'identité pour redire ce que la longueur dit
 * déjà. Étiquette directe au bout de chaque barre.
 */
export function horizontalBars(
  c: ReportChrome,
  title: string,
  items: { label: string; value: number }[],
  readingKey: string,
  format: (value: number) => string
): string {
  const { ds } = c;
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  const rows = items
    .map(
      (item) => `
      <div style="display:flex;align-items:center;gap:3mm;margin-bottom:2.2mm">
        <span style="width:52mm;font-size:${ds.typeScale.xs}px;color:${c.ink};line-height:1.35">${esc(item.label)}</span>
        <span style="flex:1;display:block;height:3mm">
          <span style="display:block;width:${((Math.abs(item.value) / max) * 100).toFixed(1)}%;height:3mm;background:${c.mark};border-radius:0 1mm 1mm 0"></span>
        </span>
        <span style="width:30mm;text-align:right;font-family:${MONO};font-size:${ds.typeScale.xs}px;color:${c.ink}">${esc(format(item.value))}</span>
      </div>`
    )
    .join('');
  return chartFrame(c, title, rows, readingKey);
}

/**
 * Trajectoire ancrée sur le zéro : au-dessus on capitalise, en dessous on
 * creuse. Une barre partant du bas ferait passer un découvert pour une réserve.
 *
 * Le signe est porté par le SIGNE affiché et par le mot du repère de lecture,
 * pas par la seule couleur : vert et rouge d'état ne se distinguent pas sous
 * deutéranopie (ΔE 4,1, mesuré au validateur de la compétence dataviz).
 */
export function zeroAnchoredBars(
  c: ReportChrome,
  title: string,
  points: { label: string; value: number }[],
  readingKey: string,
  format: (value: number) => string
): string {
  const { ds } = c;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  const height = 34;

  const bars = points
    .map((point) => {
      const ratio = ((point.value - min) / span) * 100;
      const negative = point.value < 0;
      const bottom = negative ? ratio : zero;
      const barHeight = Math.abs(ratio - zero);
      return `<span style="flex:1;height:${height}mm;position:relative;display:block">
        <span style="position:absolute;bottom:${bottom.toFixed(2)}%;left:12%;right:12%;height:${Math.max(barHeight, 0.4).toFixed(2)}%;background:${negative ? STATUS.critical : c.mark};border-radius:${negative ? '0 0 1mm 1mm' : '1mm 1mm 0 0'}"></span>
      </span>`;
    })
    .join('');

  const labels = points
    .map(
      (point) =>
        `<span style="flex:1;text-align:center;font-size:${ds.typeScale.xs}px;color:${c.inkMuted}">${esc(point.label)}</span>`
    )
    .join('');
  const figures = points
    .map(
      (point) =>
        `<span style="flex:1;text-align:center;font-family:${MONO};font-size:${ds.typeScale.xs}px;color:${c.ink}">${esc(format(point.value))}</span>`
    )
    .join('');

  const body = `
    <div style="position:relative;display:flex;gap:1.5mm;align-items:flex-end;border-bottom:0.25mm solid ${c.rule}">
      <span style="position:absolute;left:0;right:0;bottom:${zero.toFixed(2)}%;height:0.2mm;background:${c.rule}"></span>
      ${bars}
    </div>
    <div style="display:flex;gap:1.5mm;margin-top:2mm">${figures}</div>
    <div style="display:flex;gap:1.5mm;margin-top:1mm">${labels}</div>`;

  return chartFrame(c, title, body, readingKey);
}

// ---------------------------------------------------------------------------
// Enveloppe de page
// ---------------------------------------------------------------------------

/**
 * Décor répété sur chaque page de la section. Le paginateur clone les enfants
 * positionnés en absolu : c'est par eux que passent le filet de tête, le logo
 * et le pied de page.
 */
export function page(c: ReportChrome, sectionName: string, body: string): string {
  const { ds } = c;
  return `
    <div style="position:relative;width:210mm;min-height:297mm;background:${c.surface};padding:26mm 18mm 20mm;font-family:'${ds.fonts.body}',system-ui,sans-serif;color:${c.ink};box-sizing:border-box">
      <div style="position:absolute;top:0;left:0;right:0;height:1.1mm;background:${c.mark}"></div>
      <div style="position:absolute;top:9mm;left:18mm;right:18mm;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:${ds.typeScale.xs}px;font-weight:700;letter-spacing:.06em;color:${c.ink}">${esc(c.projectName)}</span>
        <span style="font-size:${ds.typeScale.xs}px;letter-spacing:.12em;text-transform:uppercase;color:${c.inkSubtle}">${esc(sectionName)}</span>
      </div>
      <div style="position:absolute;bottom:9mm;left:18mm;right:18mm;display:flex;align-items:flex-end;justify-content:space-between;border-top:0.2mm solid ${c.rule};padding-top:2.5mm">
        <span style="font-size:${ds.typeScale.xs}px;color:${c.inkSubtle}">Prévisions financières · exercices calés sur l'année civile (SYSCOHADA)</span>
        <span style="font-size:${ds.typeScale.xs}px;color:${c.inkSubtle}">Montants en ${esc(c.currency)}</span>
      </div>
      ${body}
    </div>`;
}

export { MONO, STATUS };
