/**
 * LES COMPOSANTS DOCUMENTAIRES — dessinés par le code, aux jetons de la marque.
 *
 * Sept blocs qu'un business plan et un pitch deck réclament à chaque fois, et qu'aucun bloc
 * existant ne couvrait : la matrice concurrentielle, les étapes d'un processus, la matrice des
 * risques, le SWOT, l'entonnoir, la fiche persona et le modèle économique. Jusqu'ici l'agent
 * devait les écrire en HTML — quand il y parvenait, c'étaient des divs approximatives ; le plus
 * souvent la page tombait dans la prose.
 *
 * Règles communes, tenues ici une fois pour toutes :
 *  - styles EN LIGNE (ces blocs vivent dans une page de document, une diapositive, un aperçu
 *    d'éditeur : aucun ne charge la même feuille) ;
 *  - jetons de la marque seulement, et l'encre choisie pour se lire sur son fond ;
 *  - aucune donnée inventée : ce que le rédacteur n'a pas donné n'apparaît pas ;
 *  - rien d'absolu ni de flottant : le paginateur doit pouvoir mesurer la hauteur.
 */
import { contrastRatio } from '../color';
import { mixHex } from '../../visual/poster/kit/math';
import { UiDataError, type UiComponent, type UiTokens } from './types';

const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * Les propriétés CSS qui n'ont PAS d'unité. Sans cette liste, un `line-height: 1.4` devient
 * `1.4px` : les lignes se superposent, et un `font-weight: 700` devient invalide donc ignoré.
 * Le défaut était invisible à la lecture du code et évident au premier rendu.
 */
const UNITLESS = new Set(['line-height', 'font-weight', 'opacity', 'z-index', 'flex', 'flex-grow', 'flex-shrink', 'order', 'zoom']);

const css = (rules: Record<string, string | number | undefined>) =>
  ` style="${Object.entries(rules)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : v}`)
    .join(';')}"`;

/** L'encre qui se lit sur ce fond : celle de la charte si elle passe, sinon blanc ou noir. */
const inkOn = (bg: string, t: UiTokens) => (contrastRatio(t.colors.ink, bg) >= 4.5 ? t.colors.ink : contrastRatio('#ffffff', bg) >= contrastRatio('#111111', bg) ? '#ffffff' : '#111111');

/** Les tons d'une série : des nuances de la marque, jamais des couleurs étrangères. */
function series(t: UiTokens, count: number): string[] {
  const bases = [t.colors.primary, t.colors.accent, t.colors.secondary];
  return Array.from({ length: count }, (_, i) => {
    const base = bases[i % bases.length];
    const round = Math.floor(i / bases.length);
    return round === 0 ? base : mixHex(base, t.colors.surface, Math.min(0.6, round * 0.2));
  });
}

const list = (value: unknown, field: string, min = 1, max = 12): string[] => {
  const out = (Array.isArray(value) ? value : []).map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, max);
  if (out.length < min) throw new UiDataError(`"${field}" needs at least ${min} item${min > 1 ? 's' : ''}`);
  return out;
};
const text = (value: unknown, field: string, required = true): string => {
  const out = String(value ?? '').trim();
  if (!out && required) throw new UiDataError(`"${field}" is required`);
  return out;
};

/** Le titre d'un bloc : discret, au-dessus, jamais un second titre de page. */
const caption = (label: string, t: UiTokens) =>
  label ? `<div${css({ 'font-family': `'${t.fonts.body}', system-ui, sans-serif`, 'font-size': t.typeScale.xs, 'font-weight': 700, 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: t.colors.inkMuted, 'margin-bottom': Math.round(t.spacing * 0.75) })}>${esc(label)}</div>` : '';

const wrap = (inner: string, t: UiTokens, label = '') => `<div${css({ 'font-family': `'${t.fonts.body}', system-ui, sans-serif`, color: t.colors.ink, 'break-inside': 'avoid' })}>${caption(label, t)}${inner}</div>`;

// ─── 1. La matrice concurrentielle ──────────────────────────────────────────

/**
 * Qui fait quoi, nous compris. La première colonne porte les critères, la première ligne les
 * acteurs ; NOTRE colonne est tenue par la couleur de marque — c'est le seul endroit du document
 * où la comparaison se lit d'un coup d'œil.
 */
const comparisonMatrix: UiComponent = {
  id: 'ui.comparison-matrix',
  label: 'Matrice concurrentielle',
  summary: 'compare you and the others on a few criteria: a tick, a cross or a word per cell',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.42,
  params: {
    criteria: { kind: 'list', summary: 'the criteria, one per row (3 to 7)', required: true },
    columns: { kind: 'list', summary: 'the players, you FIRST (2 to 5)', required: true },
    rows: { kind: 'rows', summary: 'one row per criterion: "yes" | "no" | "partial" | a short word, one per player', required: true },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const criteria = list(data.criteria, 'criteria', 2, 7);
    const columns = list(data.columns, 'columns', 2, 5);
    const rows = (Array.isArray(data.rows) ? data.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []));
    if (rows.length !== criteria.length) throw new UiDataError(`"rows" must have exactly one row per criterion (${criteria.length})`);
    const mine = mixHex(t.colors.primary, t.colors.surface, 0.9);
    const cell = (value: string, isMine: boolean) => {
      const v = value.toLowerCase();
      const mark = v === 'yes' || v === 'oui' ? '✓' : v === 'no' || v === 'non' ? '✕' : v === 'partial' || v === 'partiel' ? '~' : value;
      const strong = mark === '✓';
      const weak = mark === '✕';
      return `<td${css({
        padding: `${Math.round(t.spacing * 0.6)}px ${Math.round(t.spacing * 0.5)}px`,
        'text-align': 'center',
        'font-size': t.typeScale.sm,
        'font-weight': strong ? 700 : 500,
        color: weak ? t.colors.inkMuted : strong ? t.colors.primary : t.colors.ink,
        background: isMine ? mine : 'transparent',
        'border-bottom': `1px solid ${t.colors.rule}`,
      })}>${esc(mark)}</td>`;
    };
    const head = columns
      .map((c, i) => `<th${css({ padding: `${Math.round(t.spacing * 0.55)}px ${Math.round(t.spacing * 0.5)}px`, 'text-align': 'center', 'font-size': t.typeScale.xs, 'font-weight': 700, 'letter-spacing': '0.04em', color: i === 0 ? inkOn(t.colors.primary, t) : t.colors.ink, background: i === 0 ? t.colors.primary : 'transparent', 'border-bottom': `2px solid ${i === 0 ? t.colors.primary : t.colors.rule}` })}>${esc(c)}</th>`)
      .join('');
    const body = criteria
      .map(
        (criterion, r) =>
          `<tr><th${css({ padding: `${Math.round(t.spacing * 0.6)}px ${Math.round(t.spacing * 0.5)}px`, 'text-align': 'left', 'font-size': t.typeScale.sm, 'font-weight': 500, color: t.colors.ink, 'border-bottom': `1px solid ${t.colors.rule}` })}>${esc(criterion)}</th>${columns.map((_, c) => cell(rows[r][c] ?? '', c === 0)).join('')}</tr>`
      )
      .join('');
    return wrap(
      `<table${css({ width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed' })}><thead><tr><th${css({ 'border-bottom': `2px solid ${t.colors.rule}` })}></th>${head}</tr></thead><tbody>${body}</tbody></table>`,
      t,
      text(data.label, 'label', false)
    );
  },
};

// ─── 2. Les étapes d'un processus ───────────────────────────────────────────

/** Ce qui se passe, dans l'ordre : des pastilles numérotées reliées par un filet. */
const processSteps: UiComponent = {
  id: 'ui.process-steps',
  label: 'Étapes d’un processus',
  summary: 'a process or a value chain in 3 to 6 numbered steps, each with a short line',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.3,
  params: {
    steps: { kind: 'list', summary: 'the title of each step (3 to 6)', required: true },
    notes: { kind: 'list', summary: 'one short line per step (same order, optional)' },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const steps = list(data.steps, 'steps', 2, 6);
    const notes = (Array.isArray(data.notes) ? data.notes : []).map((n) => String(n ?? '').trim());
    const tones = series(t, steps.length);
    const cells = steps
      .map((step, i) => {
        const tone = tones[i];
        return `<div${css({ flex: '1 1 0', 'min-width': 0, position: 'relative', 'padding-right': i < steps.length - 1 ? Math.round(t.spacing * 0.75) : 0 })}>
  <div${css({ display: 'flex', 'align-items': 'center', gap: Math.round(t.spacing * 0.5), 'margin-bottom': Math.round(t.spacing * 0.5) })}>
    <div${css({ width: Math.round(t.typeScale.lg * 1.5), height: Math.round(t.typeScale.lg * 1.5), 'border-radius': '50%', background: tone, color: inkOn(tone, t), display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-weight': 800, 'font-size': t.typeScale.sm, flex: '0 0 auto' })}>${i + 1}</div>
    <div${css({ height: 2, background: i < steps.length - 1 ? t.colors.rule : 'transparent', flex: '1 1 auto' })}></div>
  </div>
  <div${css({ 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.base, 'font-weight': 700, color: t.colors.ink, 'line-height': 1.25 })}>${esc(step)}</div>
  ${notes[i] ? `<div${css({ 'font-size': t.typeScale.xs, color: t.colors.inkMuted, 'line-height': 1.4, 'margin-top': Math.round(t.spacing * 0.3) })}>${esc(notes[i])}</div>` : ''}
</div>`;
      })
      .join('');
    return wrap(`<div${css({ display: 'flex', 'align-items': 'flex-start', gap: 0 })}>${cells}</div>`, t, text(data.label, 'label', false));
  },
};

// ─── 3. La matrice des risques ──────────────────────────────────────────────

/** Probabilité × impact : chaque risque tombe dans sa case, et la case dit quoi en faire. */
const riskMatrix: UiComponent = {
  id: 'ui.risk-matrix',
  label: 'Matrice des risques',
  summary: 'risks placed on probability × impact, so the page says which ones to handle first',
  deliverables: ['business plan'],
  weight: 0.5,
  params: {
    risks: { kind: 'rows', summary: 'one per risk: [name, probability low|medium|high, impact low|medium|high]', required: true },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const LEVELS = ['low', 'medium', 'high'];
    const FR: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };
    const risks = (Array.isArray(data.risks) ? data.risks : [])
      .map((r) => (Array.isArray(r) ? r : []))
      .map(([name, p, i]) => ({ name: String(name ?? '').trim(), p: LEVELS.indexOf(String(p ?? '').toLowerCase()), i: LEVELS.indexOf(String(i ?? '').toLowerCase()) }))
      .filter((r) => r.name && r.p >= 0 && r.i >= 0)
      .slice(0, 12);
    if (!risks.length) throw new UiDataError('"risks" needs at least one [name, low|medium|high, low|medium|high]');
    const cellBg = (p: number, i: number) => mixHex(t.colors.surface, t.colors.primary, 0.04 + (p + i) * 0.055);
    const grid = [2, 1, 0]
      .map(
        (impact) =>
          `<tr><th${css({ 'font-size': t.typeScale.xs, color: t.colors.inkMuted, 'font-weight': 600, 'text-align': 'right', padding: `0 ${Math.round(t.spacing * 0.5)}px 0 0`, 'white-space': 'nowrap' })}>${esc(FR[LEVELS[impact]])}</th>${[0, 1, 2]
            .map((prob) => {
              const here = risks.filter((r) => r.p === prob && r.i === impact);
              return `<td${css({ background: cellBg(prob, impact), border: `1px solid ${t.colors.rule}`, padding: Math.round(t.spacing * 0.5), 'vertical-align': 'top', height: Math.round(t.spacing * 4.5), width: '31%' })}>${here
                .map((r) => `<div${css({ 'font-size': t.typeScale.xs, 'line-height': 1.3, color: t.colors.ink, 'margin-bottom': 2 })}>• ${esc(r.name)}</div>`)
                .join('')}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');
    const foot = `<tr><td></td>${[0, 1, 2].map((p) => `<td${css({ 'font-size': t.typeScale.xs, color: t.colors.inkMuted, 'text-align': 'center', padding: `${Math.round(t.spacing * 0.35)}px 0 0` })}>${esc(FR[LEVELS[p]])}</td>`).join('')}</tr>`;
    const axis = (label: string, vertical: boolean) =>
      `<div${css({ 'font-size': t.typeScale.xs, 'font-weight': 700, 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: t.colors.inkMuted, ...(vertical ? { writing_mode: '' } : {}) })}>${esc(label)}</div>`;
    return wrap(
      `<div${css({ display: 'flex', gap: Math.round(t.spacing * 0.5), 'align-items': 'stretch' })}>
  <div${css({ display: 'flex', 'align-items': 'center' })}><div${css({ transform: 'rotate(180deg)', 'writing-mode': 'vertical-rl', 'font-size': t.typeScale.xs, 'font-weight': 700, 'letter-spacing': '0.08em', 'text-transform': 'uppercase', color: t.colors.inkMuted })}>Impact</div></div>
  <div${css({ flex: '1 1 auto', 'min-width': 0 })}>
    <table${css({ width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed' })}>${grid}${foot}</table>
    <div${css({ 'text-align': 'center', 'margin-top': Math.round(t.spacing * 0.35) })}>${axis('Probabilité', false)}</div>
  </div>
</div>`,
      t,
      text(data.label, 'label', false)
    );
  },
};

// ─── 4. Le SWOT ─────────────────────────────────────────────────────────────

const swot: UiComponent = {
  id: 'ui.swot',
  label: 'SWOT',
  summary: 'strengths, weaknesses, opportunities and threats, four quadrants, 2 to 4 lines each',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.45,
  params: {
    strengths: { kind: 'list', summary: 'strengths (2 to 4)', required: true },
    weaknesses: { kind: 'list', summary: 'weaknesses (2 to 4)', required: true },
    opportunities: { kind: 'list', summary: 'opportunities (2 to 4)', required: true },
    threats: { kind: 'list', summary: 'threats (2 to 4)', required: true },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const quads = [
      { title: 'Forces', items: list(data.strengths, 'strengths', 1, 4), tone: t.colors.primary },
      { title: 'Faiblesses', items: list(data.weaknesses, 'weaknesses', 1, 4), tone: t.colors.secondary },
      { title: 'Opportunités', items: list(data.opportunities, 'opportunities', 1, 4), tone: t.colors.accent },
      { title: 'Menaces', items: list(data.threats, 'threats', 1, 4), tone: mixHex(t.colors.ink, t.colors.surface, 0.3) },
    ];
    const cells = quads
      .map(
        (q) => `<div${css({ border: `1px solid ${t.colors.rule}`, 'border-top': `3px solid ${q.tone}`, 'border-radius': t.radius, padding: Math.round(t.spacing * 0.85), background: t.colors.surfaceRaised })}>
  <div${css({ 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.sm, 'font-weight': 800, color: q.tone, 'margin-bottom': Math.round(t.spacing * 0.45), 'letter-spacing': '0.02em' })}>${esc(q.title)}</div>
  ${q.items.map((i) => `<div${css({ 'font-size': t.typeScale.xs, 'line-height': 1.45, color: t.colors.ink, 'margin-bottom': Math.round(t.spacing * 0.25), 'padding-left': Math.round(t.spacing * 0.6), position: 'relative' })}><span${css({ position: 'absolute', left: 0, color: q.tone })}>•</span>${esc(i)}</div>`).join('')}
</div>`
      )
      .join('');
    return wrap(`<div${css({ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: Math.round(t.spacing * 0.75) })}>${cells}</div>`, t, text(data.label, 'label', false));
  },
};

// ─── 5. L'entonnoir ─────────────────────────────────────────────────────────

/** De l'audience au client : chaque étage dit sa valeur, et sa largeur la dit aussi. */
const funnel: UiComponent = {
  id: 'ui.funnel',
  label: 'Entonnoir',
  summary: 'an acquisition or conversion funnel: each stage with its figure, the width says the drop',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.38,
  params: {
    stages: { kind: 'rows', summary: 'one per stage, widest first: [name, value as written in the content]', required: true },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const stages = (Array.isArray(data.stages) ? data.stages : [])
      .map((s) => (Array.isArray(s) ? s : []))
      .map(([name, value]) => ({ name: String(name ?? '').trim(), value: String(value ?? '').trim() }))
      .filter((s) => s.name)
      .slice(0, 6);
    if (stages.length < 2) throw new UiDataError('"stages" needs at least two [name, value]');
    const tones = series(t, stages.length);
    const rows = stages
      .map((s, i) => {
        const width = 100 - (i * 52) / Math.max(1, stages.length - 1);
        const tone = tones[i];
        return `<div${css({ display: 'flex', 'align-items': 'center', gap: Math.round(t.spacing * 0.6), 'margin-bottom': Math.round(t.spacing * 0.35) })}>
  <div${css({ width: `${width.toFixed(1)}%`, background: tone, color: inkOn(tone, t), padding: `${Math.round(t.spacing * 0.55)}px ${Math.round(t.spacing * 0.75)}px`, 'border-radius': t.radius, 'font-size': t.typeScale.sm, 'font-weight': 600, display: 'flex', 'justify-content': 'space-between', gap: Math.round(t.spacing * 0.5), 'min-width': 0 })}>
    <span${css({ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' })}>${esc(s.name)}</span>
    ${s.value ? `<span${css({ 'font-weight': 800, 'white-space': 'nowrap' })}>${esc(s.value)}</span>` : ''}
  </div>
</div>`;
      })
      .join('');
    return wrap(rows, t, text(data.label, 'label', false));
  },
};

// ─── 6. La fiche persona ────────────────────────────────────────────────────

const persona: UiComponent = {
  id: 'ui.persona',
  label: 'Persona',
  summary: 'one customer in a card: who they are, what they need, what stops them today',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.33,
  params: {
    name: { kind: 'text', summary: 'the persona’s name and role', required: true },
    profile: { kind: 'text', summary: 'one line: who they are' },
    needs: { kind: 'list', summary: 'what they need (1 to 3)' },
    blockers: { kind: 'list', summary: 'what stops them today (1 to 3)' },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const name = text(data.name, 'name');
    const profile = text(data.profile, 'profile', false);
    const needs = (Array.isArray(data.needs) ? data.needs : []).map((n) => String(n).trim()).filter(Boolean).slice(0, 3);
    const blockers = (Array.isArray(data.blockers) ? data.blockers : []).map((n) => String(n).trim()).filter(Boolean).slice(0, 3);
    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
    const column = (title: string, items: string[], tone: string) =>
      items.length
        ? `<div${css({ flex: '1 1 0', 'min-width': 0 })}><div${css({ 'font-size': t.typeScale.xs, 'font-weight': 700, 'letter-spacing': '0.06em', 'text-transform': 'uppercase', color: tone, 'margin-bottom': Math.round(t.spacing * 0.3) })}>${esc(title)}</div>${items
            .map((i) => `<div${css({ 'font-size': t.typeScale.xs, 'line-height': 1.45, color: t.colors.ink, 'margin-bottom': 2 })}>${esc(i)}</div>`)
            .join('')}</div>`
        : '';
    return wrap(
      `<div${css({ display: 'flex', gap: Math.round(t.spacing * 0.9), padding: Math.round(t.spacing * 0.9), background: t.colors.surfaceRaised, border: `1px solid ${t.colors.rule}`, 'border-radius': t.radius })}>
  <div${css({ width: Math.round(t.typeScale['2xl'] * 1.8), height: Math.round(t.typeScale['2xl'] * 1.8), 'border-radius': '50%', background: t.colors.primary, color: inkOn(t.colors.primary, t), display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.lg, 'font-weight': 800, flex: '0 0 auto' })}>${esc(initials)}</div>
  <div${css({ flex: '1 1 auto', 'min-width': 0 })}>
    <div${css({ 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.base, 'font-weight': 800, color: t.colors.ink })}>${esc(name)}</div>
    ${profile ? `<div${css({ 'font-size': t.typeScale.xs, color: t.colors.inkMuted, 'line-height': 1.45, 'margin-bottom': Math.round(t.spacing * 0.5) })}>${esc(profile)}</div>` : ''}
    <div${css({ display: 'flex', gap: Math.round(t.spacing * 0.9) })}>${column('Besoins', needs, t.colors.primary)}${column('Freins', blockers, t.colors.inkMuted)}</div>
  </div>
</div>`,
      t,
      text(data.label, 'label', false)
    );
  },
};

// ─── 7. Le modèle économique ────────────────────────────────────────────────

/** D'où vient l'argent : chaque source, ce qu'elle apporte, et à qui elle s'adresse. */
const businessModel: UiComponent = {
  id: 'ui.business-model',
  label: 'Modèle économique',
  summary: 'where the money comes from: each revenue stream, who pays and what it weighs',
  deliverables: ['business plan', 'pitch deck'],
  weight: 0.36,
  params: {
    streams: { kind: 'rows', summary: 'one per stream: [name, who pays, weight as written in the content]', required: true },
    label: { kind: 'text', summary: 'the small label above the block' },
  },
  render(data, t) {
    const streams = (Array.isArray(data.streams) ? data.streams : [])
      .map((s) => (Array.isArray(s) ? s : []))
      .map(([name, payer, weight]) => ({ name: String(name ?? '').trim(), payer: String(payer ?? '').trim(), weight: String(weight ?? '').trim() }))
      .filter((s) => s.name)
      .slice(0, 4);
    if (!streams.length) throw new UiDataError('"streams" needs at least one [name, who pays, weight]');
    const tones = series(t, streams.length);
    const cards = streams
      .map(
        (s, i) => `<div${css({ flex: '1 1 0', 'min-width': 0, border: `1px solid ${t.colors.rule}`, 'border-left': `4px solid ${tones[i]}`, 'border-radius': t.radius, padding: Math.round(t.spacing * 0.8), background: t.colors.surface })}>
  <div${css({ 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.sm, 'font-weight': 800, color: t.colors.ink, 'line-height': 1.25 })}>${esc(s.name)}</div>
  ${s.payer ? `<div${css({ 'font-size': t.typeScale.xs, color: t.colors.inkMuted, 'margin-top': 2 })}>${esc(s.payer)}</div>` : ''}
  ${s.weight ? `<div${css({ 'font-family': `'${t.fonts.display}', system-ui, sans-serif`, 'font-size': t.typeScale.xl, 'font-weight': 800, color: tones[i], 'margin-top': Math.round(t.spacing * 0.4), 'line-height': 1 })}>${esc(s.weight)}</div>` : ''}
</div>`
      )
      .join('');
    return wrap(`<div${css({ display: 'flex', gap: Math.round(t.spacing * 0.75) })}>${cards}</div>`, t, text(data.label, 'label', false));
  },
};

export const UI_COMPONENTS: UiComponent[] = [comparisonMatrix, processSteps, riskMatrix, swot, funnel, persona, businessModel];
