/**
 * L'ENVELOPPE d'une page, selon sa famille de mise en page.
 *
 * Trois décisions se voient avant qu'on ait lu un mot : comment la section
 * S'OUVRE, comment la page se FERME, et où court le texte entre les deux.
 * C'étaient les trois constantes de toutes les pages livrées — un titre posé en
 * haut à gauche, un pied « marque à gauche, titre à droite » sous un filet, un
 * flux pleine largeur —, quel que soit le projet et quelle que soit la graine.
 *
 * ── LE CONTRAT DU PAGINATEUR RESTE ENTIER ───────────────────────────────────
 *
 * En portrait paginé, `flow-pagination.runtime` prend les enfants DIRECTS de la
 * racine pour blocs et lit ses retraits dans son padding. Rien ici n'enveloppe
 * le flux : une colonne décalée ou une mesure étroite est un PADDING de la
 * racine, l'index d'un bloc est un repère en position absolue DANS le bloc qu'il
 * numérote, et l'en-tête reste un enfant direct, comme avant.
 */

import { Block, SectionContent } from './sectionContent';
import { HeaderTreatment, LayoutFamily } from './layoutFamilies';
import { snap } from './layoutGrid';
import {
  atomic,
  cornerRadius,
  Ctx,
  displayFont,
  esc,
  figureInk,
  formatIndex,
  labelStyle,
  MM_TO_PX,
  readableOn,
  renderKicker,
  renderLede,
  renderTitle,
  ruleLine,
  style,
} from './renderKit';

/** Colonne décalée : la marge gauche que seul l'en-tête reprend. */
export const OFFSET_MM = 28;
/** Colonne des index de bloc (2.1, 2.2…). */
export const INDEX_MM = 18;
/** Retrait, de chaque côté, d'une mesure de livre. */
export const NARROW_MM = 14;

/**
 * Ouverture de CETTE section.
 *
 * Une famille en propose une ou plusieurs ; l'archétype tiré pour la page
 * choisit. Deux pages voisines d'un même plan peuvent donc s'ouvrir
 * différemment, tout en parlant la même grammaire.
 */
export function headerTreatmentFor(ctx: Ctx): HeaderTreatment {
  const list = ctx.family.headers;
  if (list.length === 0) return 'archetype';
  const code = (ctx.seed.archetype || 'A').charCodeAt(0);
  return list[code % list.length];
}

/**
 * Retraits de la colonne de texte, en mm, portés par le padding de la racine.
 *
 * Réservés au portrait PAGINÉ. Sur une page à hauteur fixe (charte, deck),
 * `fitToPage` budgète la page sur sa largeur utile : lui retirer une colonne
 * sans le lui dire ferait déborder ce qu'il a jugé tenir.
 */
export function bodyInsetsMm(ctx: Ctx, cramped: boolean): { left: number; right: number } {
  if (ctx.landscape || cramped) return { left: 0, right: 0 };
  switch (ctx.family.body) {
    case 'offset':
      return { left: OFFSET_MM, right: 0 };
    case 'indexed':
      return { left: INDEX_MM, right: 0 };
    case 'narrow':
      return { left: NARROW_MM, right: NARROW_MM };
    default:
      return { left: 0, right: 0 };
  }
}

/**
 * L'ouverture reprend-elle la marge d'une colonne décalée ?
 *
 * C'est le geste de la grille suisse : le texte court dans sa colonne, le titre
 * part du bord. Les ouvertures en colonnes (numéro en marge, sur-titre tourné)
 * ont déjà leur propre marge, et l'aplat saignant atteint le bord de lui-même.
 */
export function hangsIntoMargin(treatment: HeaderTreatment): boolean {
  return (
    treatment === 'underscored' ||
    treatment === 'numbered-rule' ||
    treatment === 'opener' ||
    treatment === 'split-lede'
  );
}

const withWidth = (ctx: Ctx, widthPx: number): Ctx => ({
  ...ctx,
  headerWidthPx: Math.max(160, Math.round(widthPx)),
});

/** Raccourcit une étiquette au mot, pour qu'elle tienne sur sa ligne. */
const clip = (text: string, max: number): string => {
  const value = text.trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

/**
 * L'en-tête de section dessiné par la famille. `null` pour `archetype` : c'est
 * alors l'archétype de la page qui compose son en-tête, comme avant.
 *
 * `ctx.headerWidthPx` doit porter la largeur RÉELLE offerte à l'en-tête
 * (retraits de colonne déduits) : c'est sur elle que `fitTitleSize` compose.
 */
export function renderFamilyHeader(
  content: SectionContent,
  ctx: Ctx,
  treatment: HeaderTreatment
): string | null {
  const { ds, roles } = ctx;
  const after = `${snap(ds.spacing * 2)}px`;
  const muted = ds.colors.inkMuted;
  const index = formatIndex(ctx, ctx.options.index ?? 1);
  const cramped = ctx.options.multiPage === false;

  switch (treatment) {
    // Le numéro tient sa propre colonne, en grand ; le titre s'aligne à côté.
    case 'hanging-number': {
      const columnMm = 24;
      const gap = snap(ds.spacing * 1.5);
      // Le numéro doit tenir dans sa colonne quel que soit son format : « II »,
      // « [02] » et « § 2 » n'ont pas la même chasse.
      const numberPx = Math.max(
        ds.typeScale.lg,
        Math.min(ds.typeScale['3xl'], Math.floor((columnMm * MM_TO_PX) / (Math.max(index.length, 2) * 0.62)))
      );
      const inner = withWidth(ctx, ctx.headerWidthPx - columnMm * MM_TO_PX - gap);
      return `<div${style({
        display: 'grid',
        'grid-template-columns': `${columnMm}mm minmax(0, 1fr)`,
        'column-gap': `${gap}px`,
        'align-items': 'start',
        'padding-bottom': `${snap(ds.spacing)}px`,
        'border-bottom': ruleLine(ctx, 'strong'),
        'margin-bottom': after,
      })}>
  <div${style({
        'font-family': displayFont(ds),
        'font-size': `${numberPx}px`,
        'font-weight': 800,
        'line-height': 0.9,
        'letter-spacing': '-0.03em',
        color: figureInk(ctx),
        'white-space': 'nowrap',
      })}>${esc(index)}</div>
  <div${style({ 'min-width': '0' })}>${renderKicker(content, inner, roles.highlight)}${renderTitle(content, inner, roles.heading)}${renderLede(content, inner, muted)}</div>
</div>`;
    }

    // L'aplat saigne jusqu'aux trois bords : haut, gauche, droite. Ses marges
    // négatives reprennent EXACTEMENT les retraits de la page — colonne décalée
    // comprise à gauche —, sans quoi un liseré de fond resterait visible.
    case 'bleed-band': {
      const ink = readableOn(ds, roles.band);
      return `<div${style({
        'background-color': roles.band,
        color: ink,
        margin: `-${ctx.padMm}mm -${ctx.bleedMm}mm ${after} -${ctx.bleedLeftMm}mm`,
        padding: `${snap(ds.spacing * 2.5)}px ${ctx.bleedMm}mm ${snap(ds.spacing * 2)}px ${ctx.bleedLeftMm}mm`,
      })}>${renderKicker(content, ctx, ink)}${renderTitle(content, ctx, ink)}${renderLede(content, ctx, ink)}</div>`;
    }

    case 'centered-rule': {
      const inner = withWidth(ctx, ctx.headerWidthPx * 0.86);
      return `<div${style({ 'text-align': 'center', 'margin-bottom': after })}>
  ${renderKicker(content, inner, roles.highlight)}
  ${renderTitle(content, inner, roles.heading)}
  <div${style({ width: '22mm', height: '0', 'border-top': ruleLine(ctx, 'strong'), margin: `${snap(ds.spacing)}px auto 0` })}></div>
  ${content.lede ? `<div${style({ display: 'flex', 'justify-content': 'center' })}>${renderLede(content, inner, muted)}</div>` : ''}
</div>`;
    }

    // Le titre pose sur un filet pleine largeur ; le sur-titre se cale à droite,
    // sur la même ligne de pied — la manchette d'une revue.
    case 'underscored': {
      const line =
        ctx.family.rules === 'hairline' || ctx.family.rules === 'none'
          ? `2px solid ${ds.colors.ink}`
          : ruleLine(ctx, 'strong');
      const kicker = content.kicker ? clip(content.kicker, 28) : '';
      const inner = withWidth(ctx, ctx.headerWidthPx * (kicker ? 0.74 : 1));
      return `<div${style({ 'margin-bottom': after })}>
  <div${style({
        display: 'flex',
        'align-items': 'flex-end',
        'justify-content': 'space-between',
        gap: `${snap(ds.spacing * 1.5)}px`,
        'padding-bottom': `${snap(ds.spacing * 0.75)}px`,
        'border-bottom': line,
      })}>
    <div${style({ 'min-width': '0' })}>${renderTitle(content, inner, roles.heading)}</div>
    ${kicker ? `<div${style({ ...labelStyle(ctx, roles.highlight), 'white-space': 'nowrap', 'padding-bottom': '2px' })}>${esc(kicker)}</div>` : ''}
  </div>
  ${renderLede(content, ctx, muted)}
</div>`;
    }

    // Ouverture de chapitre : un bloc haut, le numéro en tête, le titre en pied.
    // La hauteur plancher n'existe qu'en document paginé — sur une page rognée,
    // chaque millimètre d'en-tête est un millimètre de contenu perdu.
    case 'opener': {
      return `<div${style({
        display: 'flex',
        'flex-direction': 'column',
        'justify-content': 'space-between',
        'min-height': cramped ? undefined : '58mm',
        gap: `${snap(ds.spacing * 1.5)}px`,
        'padding-bottom': `${snap(ds.spacing)}px`,
        'border-bottom': ruleLine(ctx, 'strong'),
        'margin-bottom': after,
      })}>
  <div${style({ display: 'flex', 'align-items': 'baseline', gap: `${snap(ds.spacing)}px`, 'min-width': '0' })}>
    <span${style({
        'font-family': displayFont(ds),
        'font-size': `${ds.typeScale['2xl']}px`,
        'font-weight': 800,
        'line-height': 1,
        color: figureInk(ctx),
        'white-space': 'nowrap',
      })}>${esc(index)}</span>
    ${content.kicker ? `<span${style({ ...labelStyle(ctx, muted), 'min-width': '0' })}>${esc(clip(content.kicker, 40))}</span>` : ''}
  </div>
  <div>${renderTitle(content, ctx, roles.heading)}${renderLede(content, ctx, muted)}</div>
</div>`;
    }

    // Titre et chapô côte à côte, sur leur ligne de pied. Sans chapô, il n'y a
    // rien à mettre en regard : la manchette soulignée prend le relais.
    case 'split-lede': {
      if (!content.lede) return renderFamilyHeader(content, ctx, 'underscored');
      const gap = snap(ds.spacing * 2);
      const inner = withWidth(ctx, (ctx.headerWidthPx - gap) * 0.53);
      return `<div${style({
        display: 'grid',
        'grid-template-columns': 'minmax(0, 1.12fr) minmax(0, 1fr)',
        'column-gap': `${gap}px`,
        'align-items': 'end',
        'padding-top': `${snap(ds.spacing)}px`,
        'border-top': ruleLine(ctx, 'strong'),
        'margin-bottom': after,
      })}>
  <div${style({ 'min-width': '0' })}>${renderKicker(content, inner, roles.highlight)}${renderTitle(content, inner, roles.heading)}</div>
  <div${style({ 'min-width': '0' })}>${renderLede(content, inner, muted)}</div>
</div>`;
    }

    case 'boxed': {
      const padY = snap(ds.spacing * 1.5);
      const padX = snap(ds.spacing * 2);
      const border =
        ctx.family.rules === 'double' ? `4px double ${roles.heading}` : `2px solid ${roles.heading}`;
      const inner = withWidth(ctx, ctx.headerWidthPx - 2 * padX - 8);
      return `<div${style({
        border,
        'border-radius': `${cornerRadius(ctx)}px`,
        padding: `${padY}px ${padX}px`,
        'margin-bottom': after,
      })}>${renderKicker(content, inner, roles.highlight)}${renderTitle(content, inner, roles.heading)}${renderLede(content, inner, muted)}</div>`;
    }

    // Le sur-titre tourné court le long d'une colonne étroite, lu de bas en
    // haut. Sans sur-titre, c'est le numéro de section qui l'occupe.
    case 'margin-kicker': {
      const columnMm = 11;
      const gap = snap(ds.spacing * 1.2);
      const mark = clip(content.kicker || index, 22);
      const soft = ruleLine(ctx, 'soft');
      const inner = withWidth(ctx, ctx.headerWidthPx - columnMm * MM_TO_PX - gap);
      return `<div${style({
        display: 'grid',
        'grid-template-columns': `${columnMm}mm minmax(0, 1fr)`,
        'column-gap': `${gap}px`,
        'margin-bottom': after,
      })}>
  <div${style({ display: 'flex', 'align-items': 'flex-end', 'border-right': soft === 'none' ? undefined : soft })}>
    <div${style({
        ...labelStyle(ctx, roles.highlight),
        'writing-mode': 'vertical-rl',
        transform: 'rotate(180deg)',
        'white-space': 'nowrap',
        'line-height': 1,
      })}>${esc(mark)}</div>
  </div>
  <div${style({ 'min-width': '0' })}>${renderTitle(content, inner, roles.heading)}${renderLede(content, inner, muted)}</div>
</div>`;
    }

    // Une ligne d'index — numéro, filet, sur-titre — puis le titre.
    case 'numbered-rule': {
      const kicker = content.kicker ? clip(content.kicker, 32) : '';
      return `<div${style({ 'margin-bottom': after })}>
  <div${style({ display: 'flex', 'align-items': 'center', gap: `${snap(ds.spacing * 0.75)}px`, 'margin-bottom': `${snap(ds.spacing * 0.75)}px` })}>
    <span${style({ ...labelStyle(ctx, figureInk(ctx)), 'white-space': 'nowrap' })}>${esc(index)}</span>
    <span${style({ flex: '1 1 auto', height: '0', 'border-top': ruleLine(ctx, 'strong') })}></span>
    ${kicker ? `<span${style({ ...labelStyle(ctx, muted), 'white-space': 'nowrap' })}>${esc(kicker)}</span>` : ''}
  </div>
  ${renderTitle(content, ctx, roles.heading)}
  ${renderLede(content, ctx, muted)}
</div>`;
    }

    case 'archetype':
    default:
      return null;
  }
}

/**
 * Le pied de page de la famille.
 *
 * Toujours insécable et toujours dernier enfant de la racine : le paginateur le
 * traite comme un bloc, et une page rognée le budgète à hauteur constante
 * (`fitToPage`) — aucun dessin ne dépasse donc la hauteur d'un logo de pied.
 *
 * `numberShown` : l'ouverture compose déjà le numéro de section. Le pied « index
 * à droite » y met alors le titre — le même « 09 » en haut et en bas de la page
 * se lit comme une erreur de mise en page.
 */
export function renderFolio(content: SectionContent, ctx: Ctx, cramped: boolean, numberShown = false): string {
  if (ctx.options.footer === false) return '';
  const { ds, options } = ctx;
  const muted = ds.colors.inkMuted;
  const top = `${ds.spacing * (cramped ? 1.2 : 2)}px`;
  const logo = (height: string): string =>
    options.logoUrl
      ? `<img src="${esc(options.logoUrl)}" alt="${esc(options.brandName ? `${options.brandName} — logo` : 'Logo')}"${style({
          height,
          width: 'auto',
          display: 'block',
        })}>`
      : '';
  const markHeight = ctx.landscape ? '8mm' : '9mm';
  const brandName = options.brandName ?? '';
  const brand = logo(markHeight) || `<span>${esc(brandName)}</span>`;
  const titleLabel = (color: string) =>
    `<span${style({
      ...labelStyle(ctx, color),
      'min-width': '0',
      'white-space': 'nowrap',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
    })}>${esc(content.title)}</span>`;

  switch (ctx.family.folio) {
    case 'centered': {
      const mark = logo(ctx.landscape ? '6mm' : '7mm') || (brandName ? `<span>${esc(brandName)}</span>` : '');
      return `<div${style({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        gap: `${snap(ds.spacing)}px`,
        'margin-top': top,
        'font-size': `${ds.typeScale.xs}px`,
        color: muted,
      })}${atomic}>
  ${mark}
  ${mark ? `<span${style({ width: '1px', 'align-self': 'stretch', 'background-color': ds.colors.rule })}></span>` : ''}
  ${titleLabel(muted)}
</div>`;
    }

    case 'index-right':
      if (numberShown) {
        return `<div${style({
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          gap: `${snap(ds.spacing)}px`,
          'margin-top': top,
          'font-size': `${ds.typeScale.xs}px`,
          color: muted,
        })}${atomic}>
  ${brand}
  ${titleLabel(muted)}
</div>`;
      }
      return `<div${style({
        display: 'grid',
        'grid-template-columns': 'minmax(0, 1fr) auto',
        'align-items': 'end',
        gap: `${snap(ds.spacing)}px`,
        'margin-top': top,
        'font-size': `${ds.typeScale.xs}px`,
        color: muted,
      })}${atomic}>
  <div${style({ display: 'flex', 'align-items': 'center', gap: `${snap(ds.spacing)}px`, 'min-width': '0' })}>${brand}${titleLabel(muted)}</div>
  <div${style({
        'font-family': displayFont(ds),
        'font-size': `${ds.typeScale.xl}px`,
        'font-weight': 700,
        'line-height': 1,
        color: figureInk(ctx),
        'white-space': 'nowrap',
      })}>${esc(formatIndex(ctx, options.index ?? 1))}</div>
</div>`;

    case 'heavy-bar':
      return `<div${style({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: `${snap(ds.spacing)}px`,
        'margin-top': top,
        'padding-top': `${snap(ds.spacing * 0.75)}px`,
        'border-top': `3px solid ${ds.colors.ink}`,
        'font-size': `${ds.typeScale.xs}px`,
        'font-weight': 700,
        color: ds.colors.ink,
      })}${atomic}>
  ${brand}
  ${titleLabel(ds.colors.ink)}
</div>`;

    case 'mark-only':
      return `<div${style({
        display: 'flex',
        'justify-content': 'flex-end',
        'align-items': 'center',
        'margin-top': top,
        'font-size': `${ds.typeScale.xs}px`,
        color: muted,
      })}${atomic}>${logo(markHeight) || `<span${style(labelStyle(ctx, muted))}>${esc(brandName)}</span>`}</div>`;

    case 'tinted-strip':
      return `<div${style({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: `${snap(ds.spacing)}px`,
        'margin-top': top,
        padding: `${snap(ds.spacing * 0.5)}px ${snap(ds.spacing)}px`,
        'background-color': ctx.roles.panel,
        'border-radius': `${cornerRadius(ctx)}px`,
        'font-size': `${ds.typeScale.xs}px`,
        color: ds.colors.ink,
      })}${atomic}>
  ${logo(ctx.landscape ? '7mm' : '8mm') || `<span>${esc(brandName)}</span>`}
  ${titleLabel(ds.colors.ink)}
</div>`;

    case 'rule-split':
    default:
      return `<div${style({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'margin-top': top,
        'padding-top': `${ds.spacing * 0.75}px`,
        'border-top': `1px solid ${ds.colors.rule}`,
        'font-size': `${ds.typeScale.xs}px`,
        color: muted,
      })}${atomic}>
  ${brand}
  <span>${esc(content.title)}</span>
</div>`;
  }
}

/**
 * Index d'un bloc, posé dans la colonne de marge d'une famille `indexed`.
 *
 * En position ABSOLUE dans le bloc qu'il numérote, jamais dans une colonne de
 * grille : une grille ferait de chaque bloc une rangée à deux cellules, que le
 * paginateur ne sait plus découper — un long tableau serait alors réduit à
 * l'échelle au lieu de continuer sur la page suivante.
 */
export function indexMarker(ctx: Ctx, blockNumber: number, topPx: number): string {
  const section = ctx.options.index ?? 1;
  return `<div${style({
    position: 'absolute',
    left: `-${INDEX_MM}mm`,
    top: `${topPx}px`,
    width: `${INDEX_MM - 5}mm`,
    ...labelStyle(ctx, ctx.ds.colors.inkMuted),
    'font-variant-numeric': 'tabular-nums',
    'line-height': 1.3,
    'white-space': 'nowrap',
  })}>${esc(`${section}.${blockNumber}`)}</div>`;
}

/**
 * Un bloc peut-il partager sa rangée (famille `paired`) ?
 *
 * Seulement s'il est COURT : la paire est insécable, et deux blocs longs
 * côte à côte feraient une rangée plus haute qu'une page.
 *
 * Et seulement si son DESSIN est vertical. Une frise en étapes horizontales ou
 * une rangée de chiffres, rangée dans une demi-colonne, serre ses colonnes
 * jusqu'à coller ses dates les unes aux autres — vu sur la planche contact.
 */
export function pairable(block: Block, family: LayoutFamily): boolean {
  switch (block.kind) {
    case 'quote':
      return block.text.length <= 320;
    case 'assumption':
      return block.statement.length <= 260;
    case 'prose':
      return block.paragraphs.join(' ').length <= 520;
    case 'timeline':
      return (
        block.steps.length <= 3 &&
        (family.timeline === 'rail' || family.timeline === 'date-column' || family.timeline === 'leaders')
      );
    case 'cards':
      return (
        block.items.length <= 2 &&
        (family.cards === 'numbered' || family.cards === 'edge-stack' || family.cards === 'definitions')
      );
    default:
      return false;
  }
}
