/**
 * Les POINTS ILLUSTRÉS : chaque point porte son image (le média trouvé, sinon l'icône locale, sinon son
 * numéro), un libellé court et au plus une ligne de détail. C'est la réponse du moteur à la diapositive qui
 * écrit trois difficultés en trois paragraphes : ici, on les MONTRE.
 *
 *   column — en colonnes, l'image au-dessus (le cas d'une rangée de trois ou quatre) ;
 *   list   — en liste, l'image à gauche (une colonne étroite, cinq ou six points) ;
 *   tiles  — des tuiles dont l'image occupe le haut (quand chaque point a son média).
 *
 * Le chiffre d'un point (`value`) passe avant son libellé : c'est lui que l'œil lit d'abord.
 */
import { mixHex } from '../../foundation/color';
import { css, escAttr, safeUrl } from '../../foundation/html';
import { estimateTextHeight } from '../../html-css-compiler/text';
import { iconSvg } from '../../capability-registry/local/icons';
import type { Env } from '../../html-css-compiler/context';
import { box, ink, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

type Item = Extract<Parameters<ComponentFor<'points'>['render']>[0]['block'], { kind: 'points' }>['items'][number];

/** Une icône locale à l'encre d'emphase, sinon `null`. */
function iconHtml(name: string | undefined, size: number, color: string): string | null {
  if (!name) return null;
  const svg = iconSvg(name, 'tabler') ?? iconSvg(name, 'lucide');
  return svg ? `<span aria-hidden="true" data-ge-icon="${escAttr(name)}" style="${css({ display: 'inline-flex', width: size, height: size, color, 'flex-shrink': 0 })}">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</span>` : null;
}

/** L'image d'un point : son média, sinon son icône dans une pastille, sinon son numéro dans la pastille. */
function mark(item: Item, i: number, ctx: Parameters<typeof txt>[0], env: Env, size: number, ratio?: number): string {
  const url = item.media ? safeUrl(item.media.url) : '';
  if (url) {
    return `<div style="${box({ position: 'relative', width: '100%', 'aspect-ratio': String(ratio ?? 1.4), overflow: 'hidden', 'border-radius': ctx.tokens.radius.md, background: mixHex(env.surface, '#000000', 0.06) })}"><img src="${escAttr(url)}" alt="${escAttr(item.media?.alt ?? item.label)}" style="${css({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' })}"></div>`;
  }
  const disc = mixHex(env.surface, ctx.tokens.color.primary, 0.12);
  const color = ink(ctx, { ...env, surface: disc }, 'emphasis', true);
  const glyph = iconHtml(item.icon, Math.round(size * 0.5), color) ?? txt(ctx, { ...env, surface: disc, width: size }, 'number', String(i + 1).padStart(2, '0'), { size: 'lg', ink: 'emphasis', align: 'center' });
  // La pastille suit le rayon du style : ronde où la charte arrondit, carrée pour un style suisse.
  return `<div aria-hidden="true" style="${box({ width: size, height: size, 'border-radius': ctx.tokens.radius.pill ? '50%' : ctx.tokens.radius.sm, background: disc, display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'flex-shrink': 0 })}">${glyph}</div>`;
}

const words = (item: Item, ctx: Parameters<typeof txt>[0], env: Env, align?: 'center'): string =>
  [
    item.value ? txt(ctx, env, 'figure', item.value, { size: '2xl', maxLines: 1, align }) : '',
    txt(ctx, env, 'subtitle', item.label, { size: 'lg', align }),
    item.detail ? txt(ctx, env, 'small', item.detail, { ink: 'muted', align }) : '',
  ].join('');

export const points: ComponentFor<'points'> = registerComponent({
  id: 'ui.points',
  kinds: ['points'],
  summary: 'Points illustrés : une image, une icône ou un numéro par point, un libellé court, une ligne de détail.',
  variants: { style: ['column', 'list', 'tiles'], align: ['start', 'center'] },
  defaults: { style: 'column', align: 'center' },
  estimate(block, ctx, width, variant) {
    const style = String(variant.style);
    const markSize = ctx.tokens.size.base * (style === 'list' ? 3.2 : 4.2);
    const text = (item: Item, w: number) => (item.value ? ctx.tokens.size['2xl'] * 1.25 : 0) + estimateTextHeight(item.label, 'subtitle', ctx, w, 'lg') + (item.detail ? estimateTextHeight(item.detail, 'small', ctx, w) : 0);
    if (style === 'list' || width < ctx.tokens.size.base * 22) {
      const w = width - markSize - ctx.tokens.space.md;
      return block.items.reduce((h, it) => h + Math.max(markSize, text(it, w)) + ctx.tokens.space.md, 0);
    }
    const cols = block.items.length <= 4 ? block.items.length : 3;
    const w = (width - ctx.tokens.space.lg * (cols - 1)) / cols;
    const media = block.items.some((it) => it.media);
    const top = style === 'tiles' || media ? w / 1.4 : markSize;
    const rows = Math.ceil(block.items.length / cols);
    return rows * (top + ctx.tokens.space.sm + Math.max(...block.items.map((it) => text(it, w)))) + (rows - 1) * ctx.tokens.space.lg;
  },
  render({ block, ctx, env, variant }) {
    // La pastille est l'image du point : assez grande pour se lire avant le libellé.
    const size = Math.round(ctx.tokens.size.base * (variant.style === 'list' ? 3.2 : 4.2));
    const narrow = env.width < ctx.tokens.size.base * 22;
    if (variant.style === 'list' || narrow) {
      const w = env.width - size - ctx.tokens.space.md;
      const rows = block.items
        .map((it, i) => `<div style="${css({ display: 'flex', gap: ctx.tokens.space.md, 'align-items': 'center' })}">${mark({ ...it, media: undefined }, i, ctx, env, size)}<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: 2, 'min-width': 0, width: w })}">${words(it, ctx, { ...env, width: w })}</div></div>`)
        .join('');
      return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.md })}">${rows}</div>`;
    }
    const cols = block.items.length <= 4 ? block.items.length : 3;
    const gap = ctx.tokens.space.lg;
    const w = (env.width - gap * (cols - 1)) / cols;
    const center = variant.align === 'center' && variant.style !== 'tiles' ? 'center' : undefined;
    const cells = block.items
      .map((it, i) => {
        const cEnv: Env = { ...env, width: w };
        return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, 'align-items': center ? 'center' : 'stretch', 'min-width': 0 })}">${mark(it, i, ctx, cEnv, size)}${words(it, ctx, cEnv, center)}</div>`;
      })
      .join('');
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: `${gap}px`, 'align-items': 'start' })}">${cells}</div>`;
  },
});
