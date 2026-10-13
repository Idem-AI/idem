/**
 * Les blocs SOCIAUX de la charte (publications au carré, bannières au ratio réel, mockups) et les rendus
 * de repli d'une couverture et d'une carte de contact quand elles sont posées dans une page ordinaire.
 *
 * Les mockups de réseaux sont des IMAGES déjà rendues à partir de gabarits HTML (jamais par un modèle
 * d'image) : ce composant les met en rangée à hauteur commune, la largeur répartie selon le rapport de
 * chacun, pour qu'un profil en paysage et une publication en portrait se lisent côte à côte et en GRAND.
 */
import { contrastRatio } from '../../foundation/color';
import { appendStyle, css, esc, escAttr, safeUrl } from '../../foundation/html';
import type { CompileContext, Env } from '../../html-css-compiler/context';
import { box, ink, ruleColor, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

function ground(ctx: CompileContext, g: 'primary' | 'accent' | 'dark' | 'light'): { bg: string; ink: string; sub: string } {
  const c = ctx.tokens.color;
  const bg = g === 'primary' ? (c.neonPrimary ? c.deep : c.primary) : g === 'accent' ? c.accent : g === 'dark' ? c.neutral['950'] : c.neutral['50'];
  const ink = contrastRatio('#ffffff', bg) >= 4.5 ? '#ffffff' : '#111111';
  return { bg, ink, sub: ink === '#ffffff' ? 'rgba(255,255,255,0.74)' : 'rgba(0,0,0,0.64)' };
}

export const socialPosts: ComponentFor<'socialPosts'> = registerComponent({
  id: 'ui.social-posts',
  elastic: { minHeight: (_block, ctx) => ctx.tokens.size.base * 10 },
  kinds: ['socialPosts'],
  summary: 'Publications au carré composées à la charte (sur-titre, accroche, logo au même angle).',
  variants: { style: ['series'] },
  defaults: { style: 'series' },
  estimate(block, ctx, width) {
    const n = block.posts.length;
    return (width - ctx.tokens.space.md * (n - 1)) / n + ctx.tokens.size.xs * 2.4;
  },
  render({ block, ctx, env }) {
    const n = block.posts.length;
    const gap = ctx.tokens.space.md;
    const side = Math.min((env.width - gap * (n - 1)) / n, env.height ? env.height - ctx.tokens.size.xs * 3 : Infinity);
    return `<div style="${css({ display: 'flex', gap, 'justify-content': 'center' })}">${block.posts
      .map((post) => {
        const g = ground(ctx, post.ground);
        const logo = safeUrl(post.logoUrl);
        const head = Math.round(side / 11);
        return `<figure style="${css({ margin: 0, width: Math.floor(side), flex: 'none' })}"><div style="${box({ background: g.bg, color: g.ink, width: '100%', 'aspect-ratio': '1 / 1', 'border-radius': ctx.tokens.radius.md, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, padding: Math.round(side * 0.08), display: 'flex', 'flex-direction': 'column', 'justify-content': 'space-between', overflow: 'hidden' })}"><p style="${css({ margin: 0, 'font-size': Math.max(9, Math.round(side / 26)), 'text-transform': 'uppercase', 'letter-spacing': '0.16em', color: g.sub })}">${esc(post.kicker ?? post.platform)}</p><p style="${css({ margin: 0, 'font-family': ctx.tokens.font.displayStack, 'font-size': head, 'font-weight': 700, 'line-height': 1.05, 'letter-spacing': '-0.02em', 'text-wrap': 'balance' })}">${esc(post.headline)}</p>${logo ? `<img src="${escAttr(logo)}" alt="${escAttr(`Logo ${ctx.tokens.brand.name}`)}" style="${css({ height: Math.round(side / 12), width: 'auto', 'align-self': 'flex-start', 'object-fit': 'contain' })}">` : `<div style="${css({ width: Math.round(side / 7), height: 2, background: g.ink })}"></div>`}</div><figcaption style="margin-top:4px">${txt(ctx, env, 'caption', post.platform)}</figcaption></figure>`;
      })
      .join('')}</div>`;
  },
});

export const socialBanners: ComponentFor<'socialBanners'> = registerComponent({
  id: 'ui.social-banners',
  kinds: ['socialBanners'],
  summary: 'Bannières de profil au ratio réel de chaque réseau, avec ce ratio affiché.',
  variants: { style: ['stack'] },
  defaults: { style: 'stack' },
  estimate(block, ctx, width) {
    return block.banners.reduce((h, b) => {
      const m = b.ratio.match(/(\d+)\s*[×x]\s*(\d+)/);
      return h + width / (m ? Number(m[1]) / Number(m[2]) : 4) + ctx.tokens.size.xs * 2 + ctx.tokens.space.md;
    }, 0);
  },
  render({ block, ctx, env }) {
    return `<div style="${css({ display: 'grid', gap: ctx.tokens.space.md })}">${block.banners
      .map((b) => {
        const g = ground(ctx, b.ground);
        const m = b.ratio.match(/(\d+)\s*[×x]\s*(\d+)/);
        const ratio = m ? `${m[1]} / ${m[2]}` : '4 / 1';
        const logo = safeUrl(b.logoUrl);
        return `<div><div style="${box({ background: g.bg, color: g.ink, 'aspect-ratio': ratio, 'border-radius': ctx.tokens.radius.md, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, padding: `${ctx.tokens.space.md}px ${ctx.tokens.space.lg}px`, display: 'flex', 'align-items': 'center', gap: ctx.tokens.space.lg, overflow: 'hidden' })}">${logo ? `<img src="${escAttr(logo)}" alt="${escAttr(`Logo ${ctx.tokens.brand.name}`)}" style="${css({ height: Math.round(ctx.tokens.size.base * 2.4), width: 'auto', 'object-fit': 'contain', 'flex-shrink': 0 })}">` : ''}<div style="min-width:0"><p style="${css({ margin: 0, 'font-family': ctx.tokens.font.displayStack, 'font-size': ctx.tokens.size.lg, 'font-weight': 700, 'line-height': 1.1 })}">${esc(b.headline)}</p>${b.tagline ? `<p style="${css({ margin: '2px 0 0', 'font-size': ctx.tokens.size.xs, color: g.sub })}">${esc(b.tagline)}</p>` : ''}</div></div>${appendStyle(txt(ctx, env, 'caption', `${b.platform} — ${b.ratio} px`), 'margin-top:3px')}</div>`;
      })
      .join('')}</div>`;
  },
});

export const mockupShowcase: ComponentFor<'mockupShowcase'> = registerComponent({
  id: 'ui.mockup-showcase',
  elastic: { minHeight: (_block, ctx) => ctx.tokens.size.base * 12 },
  kinds: ['mockupShowcase'],
  summary: 'Mockups en rangée à hauteur commune (largeur selon le ratio), légende en une ligne au-dessus.',
  variants: { caption: ['above', 'below'] },
  defaults: { caption: 'above' },
  estimate(block, ctx, width) {
    const sum = block.items.reduce((s, i) => s + i.ratio, 0);
    return (width - ctx.tokens.space.lg * (block.items.length - 1)) / sum + ctx.tokens.size.sm * 2;
  },
  render({ block, ctx, env, variant }) {
    const items = block.items.filter((i) => safeUrl(i.url) && i.ratio > 0);
    if (!items.length) return '';
    const gap = ctx.tokens.space.lg;
    const sum = items.reduce((s, i) => s + i.ratio, 0);
    const captionH = Math.ceil(ctx.tokens.size.sm * 1.4) + ctx.tokens.space.xs;
    // La hauteur : la largeur disponible répartie selon les ratios, bornée par la hauteur de la page.
    const byWidth = (env.width - gap * (items.length - 1)) / sum;
    const height = Math.floor(env.height ? Math.min(byWidth, env.height - captionH - 4) : byWidth);
    const above = variant.caption !== 'below';
    return `<div style="${css({ display: 'flex', gap, 'justify-content': 'center', 'align-items': 'flex-start' })}">${items
      .map((i) => {
        const w = Math.floor(height * i.ratio);
        const img = `<img src="${escAttr(safeUrl(i.url))}" alt="${escAttr(i.label)}" style="${css({ width: w, height, display: 'block', 'object-fit': 'cover', 'border-radius': ctx.tokens.radius.md, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` })}">`;
        const cap = `<figcaption style="${css({ 'font-size': ctx.tokens.size.sm, 'line-height': 1.4, color: ink(ctx, env, 'muted'), 'white-space': above ? 'nowrap' : undefined, overflow: 'hidden', 'text-overflow': 'ellipsis', margin: above ? `0 0 ${ctx.tokens.space.xs}px` : `${ctx.tokens.space.xs}px 0 0` })}"><span style="${css({ 'font-weight': 600, color: ink(ctx, env, 'ink') })}">${esc(i.label)}</span>${i.caption ? `&nbsp;&nbsp;${esc(i.caption)}` : ''}</figcaption>`;
        return `<figure style="${css({ margin: 0, width: w, flex: 'none' })}">${above ? cap + img : img + cap}</figure>`;
      })
      .join('')}</div>`;
  },
});

export const coverFallback: ComponentFor<'cover'> = registerComponent({
  id: 'ui.cover',
  kinds: ['cover'],
  summary: 'Couverture en flux (repli) : nom, promesse, mention du document.',
  variants: {},
  defaults: {},
  estimate(_block, ctx) {
    return ctx.tokens.size['5xl'] * 2 + ctx.tokens.size.lg * 3;
  },
  render({ block, ctx, env }) {
    return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.md })}">${[txt(ctx, env, 'kicker', block.kicker), txt(ctx, env, 'display', block.brandName), txt(ctx, env, 'lede', block.promise), txt(ctx, env, 'label', [block.documentLabel, block.detail, block.dateLabel].filter(Boolean).join(' · '))].join('')}</div>`;
  },
});

export const contactFallback: ComponentFor<'contact'> = registerComponent({
  id: 'ui.contact',
  kinds: ['contact'],
  summary: 'Coordonnées en liste (repli d’une carte de visite).',
  variants: {},
  defaults: {},
  estimate(_block, ctx) {
    return ctx.tokens.size.base * 8;
  },
  render({ block, ctx, env }) {
    const markers = block.binding === 'markers';
    const lines = (['fullName', 'jobTitle', 'companyName', 'email', 'phone', 'mobile', 'website', 'address', 'linkedin'] as const)
      .filter((f) => markers || block.fields[f])
      .map((f) => `<p data-field="${f}" style="${css({ margin: 0, 'font-size': f === 'fullName' ? ctx.tokens.size.lg : ctx.tokens.size.sm, 'font-weight': f === 'fullName' ? 700 : 400, color: ink(ctx, env as Env, f === 'fullName' ? 'heading' : 'ink') })}">${markers ? `{{${f}}}` : esc(block.fields[f] ?? '')}</p>`);
    return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: 2 })}">${lines.join('')}</div>`;
  },
});
