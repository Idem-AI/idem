import type { CorpusPage } from './types';
import { charter, folio } from './kit';

const F = (n: number) => folio('Brand book', n);

/** Charte graphique — pages A4 fixes (1 à 10). Chaque page montre l'actif de la marque : il est le héros. */
export const PAGES: CorpusPage[] = [
  {
    id: 'ch01', doc: 'brand-charter', format: 'page-a4', role: 'opening', brand: 3, style: 'editorial',
    intent: 'brand story: a large statement of the brand’s purpose, three values beneath it, calm and typographic',
    texts: { folio: F(1), kicker: 'Notre marque', brandline: 'Charte graphique 2026', title: 'Le goût du Bénin, sans détour', lede: 'Cotonou Saveurs réunit des producteurs, des cuisiniers et des familles autour des produits d’ici. Notre identité doit se lire comme un étal bien tenu : claire, généreuse, honnête.', 'v0.t': 'Généreux', 'v0.b': 'Nous donnons toujours un peu plus que prévu.', 'v1.t': 'Honnête', 'v1.b': 'Nous disons d’où vient chaque produit.', 'v2.t': 'Vivant', 'v2.b': 'Nous parlons comme on parle au marché.' },
    html: charter(`<div class="flex flex-1 flex-col justify-center"><h2 class="font-display text-[68px] font-bold leading-[0.98] tracking-[-0.015em] text-ink">{{title}}</h2><p class="mt-[28px] max-w-[88%] text-[17px] leading-[1.6] text-ink">{{lede}}</p></div>
<section class="mb-[30px] grid grid-cols-3 gap-[24px] border-t-[3px] border-brand-primary pt-[16px]"><div><p class="font-display text-[22px] font-bold text-brand-primary">{{v0.t}}</p><p class="mt-[6px] text-[13px] leading-[1.5] text-ink">{{v0.b}}</p></div><div><p class="font-display text-[22px] font-bold text-brand-primary">{{v1.t}}</p><p class="mt-[6px] text-[13px] leading-[1.5] text-ink">{{v1.b}}</p></div><div><p class="font-display text-[22px] font-bold text-brand-primary">{{v2.t}}</p><p class="mt-[6px] text-[13px] leading-[1.5] text-ink">{{v2.b}}</p></div></section>`),
  },
  {
    id: 'ch02', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 4,
    intent: 'primary logo shown whole and large on a clean ground with a short caption, nothing else',
    texts: { folio: F(2), kicker: 'Logo', brandline: 'Brand guidelines', title: 'The primary logo', body: 'Use it by default. It carries the name and the mark together and never changes proportion.' },
    html: charter(`<h2 class="mt-[30px] font-display text-[34px] font-bold text-ink">{{title}}</h2>
<div class="my-[24px] flex flex-1 items-center justify-center border border-rule bg-ground"><idem-logo variant="primary" class="h-[190px]"></idem-logo></div>
<p class="mb-[28px] max-w-[70%] text-[14px] leading-[1.6] text-muted">{{body}}</p>`),
  },
  {
    id: 'ch03', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 5,
    intent: 'logo on three grounds: light, deep and brand colour, three equal panels stacked with a label each',
    texts: { folio: F(3), kicker: 'Logo', brandline: 'Charte graphique', title: 'Le logo sur trois fonds', 'a.l': 'Sur fond clair', 'b.l': 'Sur fond profond', 'c.l': 'Sur la couleur de marque' },
    html: charter(`<h2 class="mt-[26px] font-display text-[32px] font-bold uppercase text-ink">{{title}}</h2>
<div class="my-[22px] grid flex-1 grid-rows-3 gap-[10px]">
<div class="relative flex items-center justify-center border border-rule bg-sunken"><idem-logo variant="primary" class="h-[90px]"></idem-logo><p class="absolute left-[14px] top-[10px] text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{{a.l}}</p></div>
<div class="relative flex items-center justify-center bg-deep"><idem-logo variant="onDark" class="h-[90px]"></idem-logo><p class="absolute left-[14px] top-[10px] text-[11px] font-bold uppercase tracking-[0.12em] text-on-deep/80">{{b.l}}</p></div>
<div class="relative flex items-center justify-center bg-brand-primary"><idem-logo variant="onDark" class="h-[90px]"></idem-logo><p class="absolute left-[14px] top-[10px] text-[11px] font-bold uppercase tracking-[0.12em] text-on-brand/90">{{c.l}}</p></div></div>`),
  },
  {
    id: 'ch04', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 9,
    intent: 'colour palette: five full-height swatches side by side, each carrying its name, role and code',
    texts: { folio: F(4), kicker: 'Couleurs', brandline: 'Charte graphique', title: 'La palette', 's0.n': 'Brun café', 's0.r': 'Couleur principale', 's0.h': '#5B3A29', 's1.n': 'Vert plantation', 's1.r': 'Secondaire', 's1.h': '#2F6B4F', 's2.n': 'Or de récolte', 's2.r': 'Accent', 's2.h': '#D9A441', 's3.n': 'Papier', 's3.r': 'Fond des pages', 's3.h': '#FAF8F4', 's4.n': 'Encre', 's4.r': 'Texte', 's4.h': '#1A1D21' },
    html: charter(`<h2 class="mt-[26px] font-display text-[34px] font-bold text-ink">{{title}}</h2>
<div class="my-[22px] grid flex-1 grid-cols-5 gap-[6px]">
<div class="flex flex-col justify-end bg-brand-primary p-[12px] text-on-brand"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s0.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s0.r}}</p><p class="mt-[10px] text-[11px] font-semibold tabular-nums">{{s0.h}}</p></div>
<div class="flex flex-col justify-end bg-brand-secondary p-[12px] text-on-brand"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s1.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s1.r}}</p><p class="mt-[10px] text-[11px] font-semibold tabular-nums">{{s1.h}}</p></div>
<div class="flex flex-col justify-end bg-brand-accent p-[12px] text-on-accent"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s2.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s2.r}}</p><p class="mt-[10px] text-[11px] font-semibold tabular-nums">{{s2.h}}</p></div>
<div class="flex flex-col justify-end border border-rule bg-ground p-[12px] text-ink"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s3.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s3.r}}</p><p class="mt-[10px] text-[11px] font-semibold tabular-nums">{{s3.h}}</p></div>
<div class="flex flex-col justify-end bg-ink p-[12px] text-ground"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s4.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s4.r}}</p><p class="mt-[10px] text-[11px] font-semibold tabular-nums">{{s4.h}}</p></div></div>`),
  },
  {
    id: 'ch05', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 7, style: 'swiss',
    intent: 'colour proportions: a stacked horizontal bar showing 60/25/10/5 shares with a legend of usage rules beneath',
    texts: { folio: F(5), kicker: 'Colours', brandline: 'Brand guidelines', title: 'How much of each colour', lede: 'A page reads as Osusu when the colours keep these proportions.', 'u0.p': '60 %', 'u0.t': 'Ground and ink', 'u0.b': 'Pages, backgrounds and text.', 'u1.p': '25 %', 'u1.t': 'Primary', 'u1.b': 'Headings, rules, key figures, buttons.', 'u2.p': '10 %', 'u2.t': 'Deep', 'u2.b': 'Bands and panels that carry white text.', 'u3.p': '5 %', 'u3.t': 'Accent', 'u3.b': 'One highlight per page, never more.' },
    html: charter(`<h2 class="mt-[28px] font-display text-[34px] font-bold leading-[1.05] text-ink">{{title}}</h2><p class="mt-[10px] text-[14px] text-muted">{{lede}}</p>
<div class="mt-[34px] flex h-[210px] w-full gap-[3px]"><div class="w-[60%] border border-rule bg-sunken"></div><div class="w-[25%] bg-brand-primary"></div><div class="w-[10%] bg-deep"></div><div class="w-[5%] bg-brand-accent"></div></div>
<div class="mt-[8px] grid grid-cols-[60fr_25fr_10fr_5fr] gap-[3px] text-[12px] font-bold tabular-nums text-muted"><span>{{u0.p}}</span><span>{{u1.p}}</span><span>{{u2.p}}</span><span>{{u3.p}}</span></div>
<dl class="my-[30px] flex flex-1 flex-col justify-between border-t-[2px] border-ink text-[14px]"><div class="grid grid-cols-[170px_1fr] gap-[18px] border-b border-rule py-[14px]"><dt class="font-bold text-ink">{{u0.t}}</dt><dd class="text-muted">{{u0.b}}</dd></div><div class="grid grid-cols-[170px_1fr] gap-[18px] border-b border-rule py-[14px]"><dt class="font-bold text-brand-primary">{{u1.t}}</dt><dd class="text-muted">{{u1.b}}</dd></div><div class="grid grid-cols-[170px_1fr] gap-[18px] border-b border-rule py-[14px]"><dt class="font-bold text-ink">{{u2.t}}</dt><dd class="text-muted">{{u2.b}}</dd></div><div class="grid grid-cols-[170px_1fr] gap-[18px] border-b border-rule py-[14px]"><dt class="font-bold text-ink">{{u3.t}}</dt><dd class="text-muted">{{u3.b}}</dd></div></dl>`),
  },
  {
    id: 'ch06', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 8,
    intent: 'typeface specimen: a huge letterform pair in the display font, the alphabet and figures, a short caption',
    texts: { folio: F(6), kicker: 'Typographie', brandline: 'Charte graphique', title: 'Police d’affichage', 'big': 'Aa', abc: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', low: 'abcdefghijklmnopqrstuvwxyz', num: '0123456789 ? ! & % €', body: 'À employer pour les titres, les chiffres-clés et les accroches. Jamais pour un paragraphe.' },
    html: charter(`<div class="flex flex-1 flex-col justify-between pb-[24px] pt-[24px]"><p class="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-primary">{{title}}</p><p class="font-display text-[300px] font-bold leading-[0.85] tracking-[-0.04em] text-ink">{{big}}</p>
<div class="border-t-[3px] border-brand-primary pt-[18px]"><p class="break-all font-display text-[34px] font-bold leading-[1.15] text-ink">{{abc}}</p><p class="mt-[6px] break-all font-display text-[34px] leading-[1.15] text-ink">{{low}}</p><p class="mt-[6px] font-display text-[34px] leading-[1.15] tabular-nums text-brand-primary">{{num}}</p><p class="mt-[18px] max-w-[75%] text-[13px] leading-[1.6] text-muted">{{body}}</p></div></div>`),
  },
  {
    id: 'ch07', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 10,
    intent: 'type scale: five rows from headline to caption, each set at its real size with its size label on the left',
    texts: { folio: F(7), kicker: 'Typography', brandline: 'Brand guidelines', title: 'The type scale', 'r0.l': 'Headline · 44', 'r0.t': 'Wildlife, seen slowly', 'r1.l': 'Title · 28', 'r1.t': 'Ten years in the Laikipia conservancies', 'r2.l': 'Subtitle · 18', 'r2.t': 'Every print is numbered and signed on the back', 'r3.l': 'Body · 13', 'r3.t': 'Our prints are made on cotton paper in an edition of fifty. Each comes with a card describing the place and the day it was taken.', 'r4.l': 'Caption · 10', 'r4.t': 'Nikon Z9, 400 mm, 06:40, Mount Kenya in the distance' },
    html: charter(`<h2 class="mt-[26px] font-display text-[30px] font-bold text-ink">{{title}}</h2>
<div class="my-[20px] flex flex-1 flex-col border-t-[2px] border-ink">
<div class="grid flex-1 grid-cols-[120px_1fr] items-center gap-[16px] border-b border-rule"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r0.l}}</p><p class="font-display text-[44px] font-bold leading-[1.05] text-ink">{{r0.t}}</p></div>
<div class="grid flex-1 grid-cols-[120px_1fr] items-center gap-[16px] border-b border-rule"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r1.l}}</p><p class="font-display text-[28px] font-bold leading-[1.15] text-ink">{{r1.t}}</p></div>
<div class="grid flex-1 grid-cols-[120px_1fr] items-center gap-[16px] border-b border-rule"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r2.l}}</p><p class="font-display text-[18px] font-medium leading-[1.3] text-ink">{{r2.t}}</p></div>
<div class="grid flex-1 grid-cols-[120px_1fr] items-center gap-[16px] border-b border-rule"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r3.l}}</p><p class="text-[13px] leading-[1.6] text-ink">{{r3.t}}</p></div>
<div class="grid flex-1 grid-cols-[120px_1fr] items-center gap-[16px] border-b border-rule"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r4.l}}</p><p class="text-[10px] leading-[1.5] text-muted">{{r4.t}}</p></div></div>`),
  },
  {
    id: 'ch08', doc: 'brand-charter', format: 'page-a4', role: 'showcase', brand: 11, style: 'pop-art',
    intent: 'procedural brand pattern shown as a full-bleed panel on the upper two thirds, its name and rule below',
    texts: { folio: F(8), kicker: 'Motivo', brandline: 'Guia da marca', title: 'O motivo capulana', body: 'Linhas e pontos desenhados à mão, nas cores da marca. Usa-se em faixas, capas e embalagens, nunca por baixo de texto pequeno.' },
    html: `<div class="flex h-full w-full flex-col bg-ground"><div class="relative flex-[2] overflow-hidden bg-brand-primary"><idem-pattern kind="hand-circles" density="0.6" class="absolute inset-0 opacity-70"></idem-pattern><header class="absolute left-[56px] right-[56px] top-[48px] flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-on-brand"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header></div>
<div class="flex flex-1 flex-col justify-between px-[56px] py-[40px]"><div><h2 class="font-display text-[44px] font-bold leading-[1.02] text-ink">{{title}}</h2><p class="mt-[14px] max-w-[80%] text-[14px] leading-[1.6] text-muted">{{body}}</p></div><div class="flex items-center justify-between border-t border-rule pt-[10px]"><idem-logo variant="primary" class="h-[20px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></div></div></div>`,
  },
  {
    id: 'ch09', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 2,
    intent: 'iconography: a three-by-three grid of line icons, each with its name beneath, shown evenly',
    texts: { folio: F(9), kicker: 'Iconographie', brandline: 'Charte graphique', title: 'Des icônes au trait fin', lede: 'Un trait de 2 px, des angles arrondis, une seule couleur. Elles illustrent une idée, jamais une décoration.', 'i0.icon': 'leaf', 'i0.n': 'Nature', 'i1.icon': 'bed', 'i1.n': 'Hébergement', 'i2.icon': 'map-pin', 'i2.n': 'Lieu', 'i3.icon': 'sun', 'i3.n': 'Énergie solaire', 'i4.icon': 'bird', 'i4.n': 'Observation', 'i5.icon': 'utensils', 'i5.n': 'Cuisine', 'i6.icon': 'droplet', 'i6.n': 'Eau', 'i7.icon': 'users', 'i7.n': 'Villages', 'i8.icon': 'compass', 'i8.n': 'Guides' },
    html: charter(`<h2 class="mt-[26px] font-display text-[36px] font-bold text-ink">{{title}}</h2><p class="mt-[10px] max-w-[85%] text-[14px] leading-[1.6] text-muted">{{lede}}</p>
<div class="my-[26px] grid flex-1 grid-cols-3 border-l border-t border-rule">
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i0.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i0.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i1.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i1.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i2.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i2.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i3.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i3.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i4.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i4.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i5.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i5.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i6.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i6.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i7.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i7.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[14px] border-b border-r border-rule"><idem-icon name="{{i8.icon}}" class="size-[64px] text-brand-primary"></idem-icon><p class="text-[13px] font-semibold text-ink">{{i8.n}}</p></div></div>`),
  },
  {
    id: 'ch10', doc: 'brand-charter', format: 'page-a4', role: 'showcase', brand: 10,
    intent: 'imagery: one tall photograph filling the page’s upper part, three rules for choosing photographs below it in columns',
    texts: { folio: F(10), kicker: 'Imagery', brandline: 'Brand guidelines', title: 'Photograph the place, not the pose', 'r0.t': 'Natural light', 'r0.b': 'Early morning or late afternoon. No flash, no filters.', 'r1.t': 'One subject', 'r1.b': 'A single animal, person or landscape fills the frame.', 'r2.t': 'Honest crops', 'r2.b': 'Never crop an animal at the joints or beyond its eyes.' },
    images: { 'hero.url': 'photo:#f4d58d,#d17a22,#254d32' },
    html: `<div class="flex h-full w-full flex-col bg-ground"><div class="relative flex-[3]"><img src="{{hero.url}}" alt="" class="h-full w-full object-cover"><header class="absolute left-[56px] right-[56px] top-[48px] flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-ink"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header></div>
<div class="flex flex-[2] flex-col justify-between px-[56px] py-[36px]"><h2 class="font-display text-[38px] font-bold leading-[1.05] text-ink">{{title}}</h2><div class="grid grid-cols-3 gap-[22px] border-t-[3px] border-brand-primary pt-[14px]"><div><p class="text-[14px] font-bold text-brand-primary">{{r0.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{r0.b}}</p></div><div><p class="text-[14px] font-bold text-brand-primary">{{r1.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{r1.b}}</p></div><div><p class="text-[14px] font-bold text-brand-primary">{{r2.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{r2.b}}</p></div></div><div class="flex items-center justify-between border-t border-rule pt-[10px]"><idem-logo variant="primary" class="h-[20px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></div></div></div>`,
  },
];
