import type { CorpusPage } from './types';

/** Couvertures de documents (business plan, pitch deck, charte) — la signature du document, composition libre (20). */
export const PAGES: CorpusPage[] = [
  {
    id: 'cv01', doc: 'cover', format: 'page-a4', role: 'cover', brand: 0, style: 'editorial',
    intent: 'business plan cover: the upper two thirds a single brand-colour field with the title set large at its foot, logo above',
    texts: { kicker: 'Plan d’affaires 2026–2029', title: 'Transformer le cajou à Korhogo', sub: 'Dossier de financement bancaire', date: 'Mars 2026', by: 'Noix d’Or Korhogo SARL' },
    html: `<div class="flex h-full w-full flex-col"><div class="flex flex-[2] flex-col justify-between bg-brand-primary p-[56px] text-on-brand"><idem-logo variant="onDark" class="h-[48px] self-start"></idem-logo><div><p class="text-[13px] font-bold uppercase tracking-[0.2em]">{{kicker}}</p><h1 class="mt-[16px] font-display text-[78px] font-bold leading-[0.98] tracking-[-0.015em]">{{title}}</h1></div></div><div class="flex flex-1 flex-col justify-between bg-ground p-[56px]"><p class="max-w-[70%] font-display text-[22px] leading-[1.3] text-ink">{{sub}}</p><div class="flex items-end justify-between border-t-[3px] border-brand-accent pt-[14px] text-[13px] text-ink"><span class="font-bold">{{by}}</span><span class="tabular-nums">{{date}}</span></div></div></div>`,
  },
  {
    id: 'cv02', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 6, style: 'swiss',
    intent: 'pitch deck cover: the company name very large across the left, the one-line promise right-aligned beneath a heavy rule',
    texts: { kicker: 'Seed round · 2026', title: 'LastMile', promise: 'Same-day delivery for every pharmacy in Zambia', who: 'Chanda Mwila, founder' },
    html: `<div class="relative flex h-full w-full flex-col justify-between bg-ground p-[56px]"><div class="flex items-center justify-between"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><idem-logo variant="primary" class="h-[36px]"></idem-logo></div><div><h1 class="font-display text-[190px] font-black leading-[0.82] tracking-[-0.04em] text-ink">{{title}}</h1><div class="mt-[24px] flex items-end justify-between border-t-[6px] border-brand-primary pt-[14px]"><p class="max-w-[520px] font-display text-[26px] font-bold leading-[1.15] text-brand-primary">{{promise}}</p><p class="text-[14px] text-muted">{{who}}</p></div></div></div>`,
  },
  {
    id: 'cv03', doc: 'cover', format: 'page-a4', role: 'cover', brand: 3, style: 'maximalism',
    intent: 'brand book cover: an enormous logo filling the width on a deep ground, the document name at the foot',
    texts: { kicker: 'Charte graphique', title: 'Cotonou Saveurs', version: 'Version 1.0 · 2026' },
    html: `<div class="flex h-full w-full flex-col justify-between bg-deep p-[56px] text-on-deep"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-accent">{{kicker}}</p><idem-logo variant="onDark" class="h-[300px] self-center"></idem-logo><div class="flex items-end justify-between border-t border-on-deep/40 pt-[16px]"><h1 class="font-display text-[44px] font-bold leading-[1]">{{title}}</h1><p class="text-[13px] tabular-nums opacity-80">{{version}}</p></div></div>`,
  },
  {
    id: 'cv04', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 10,
    intent: 'deck cover with a full-bleed photograph, a solid brand panel anchored bottom-left carrying the title',
    texts: { kicker: 'Investor presentation', title: 'The terminal that fits in a trader’s apron', who: 'SokoPay · Nairobi · 2026' },
    images: { 'hero.url': 'photo:#f2b950,#c96f2d,#2a5d46' },
    html: `<div class="relative h-full w-full"><img src="{{hero.url}}" alt="" class="absolute inset-0 h-full w-full object-cover"><div class="absolute bottom-0 left-0 flex w-[62%] flex-col gap-[14px] bg-brand-primary p-[48px] text-on-brand"><p class="text-[13px] font-bold uppercase tracking-[0.2em]">{{kicker}}</p><h1 class="font-display text-[54px] font-bold leading-[1.02]">{{title}}</h1><p class="text-[14px]">{{who}}</p></div><idem-logo variant="onDark" class="absolute right-[48px] top-[44px] h-[40px]"></idem-logo></div>`,
  },
  {
    id: 'cv05', doc: 'cover', format: 'page-a4', role: 'cover', brand: 5, style: 'pop-art',
    intent: 'business plan cover on paper: a heavy vertical brand bar on the left, the title stacked in uppercase beside it',
    texts: { kicker: 'Business plan', title: 'Brazza Mode', sub: 'Couture sur mesure, de Brazzaville au monde', year: '2026' },
    html: `<div class="flex h-full w-full bg-ground"><div class="flex w-[190px] flex-col justify-between bg-brand-primary p-[36px] text-on-brand"><idem-logo variant="onDark" class="h-[56px] self-start"></idem-logo><p class="font-display text-[56px] font-black tabular-nums leading-none">{{year}}</p></div><div class="flex flex-1 flex-col justify-between p-[56px]"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><div><h1 class="font-display text-[96px] font-black uppercase leading-[0.9] tracking-[-0.01em] text-ink">{{title}}</h1><p class="mt-[22px] max-w-[85%] font-display text-[24px] leading-[1.25] text-muted">{{sub}}</p></div><div class="h-[8px] w-[120px] bg-brand-accent"></div></div></div>`,
  },
  {
    id: 'cv06', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 7,
    intent: 'deck cover on a deep ground with a flowing line texture, the title large and the logo small, calm and technical',
    texts: { kicker: 'Seed · Freetown · 2026', title: 'Savings groups, now on every phone', sub: 'Osusu Digital' },
    html: `<div class="relative flex h-full w-full flex-col justify-between overflow-hidden bg-deep p-[56px] text-on-deep"><idem-pattern kind="flow" density="0.6" class="absolute inset-0 opacity-100"></idem-pattern><div class="relative flex items-center justify-between"><idem-logo variant="onDark" class="h-[36px]"></idem-logo><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-accent">{{kicker}}</p></div><div class="relative"><h1 class="max-w-[820px] font-display text-[80px] font-bold leading-[0.98] tracking-[-0.02em]">{{title}}</h1><p class="mt-[18px] text-[20px] opacity-85">{{sub}}</p></div></div>`,
  },
  {
    id: 'cv07', doc: 'cover', format: 'page-a4', role: 'cover', brand: 8, style: 'swiss',
    intent: 'report cover built on a grid: title in the upper-left block, a block of brand colour and a block of accent beneath it',
    texts: { kicker: 'Rapport d’impact', title: 'Code Thiès, deux ans après', sub: 'Ce que 840 élèves ont appris, trouvé et créé', year: '2024–2026' },
    html: `<div class="grid h-full w-full grid-cols-6 grid-rows-6 gap-[6px] bg-ground p-[40px]"><div class="col-span-6 row-span-3 flex flex-col justify-between p-[16px]"><div class="flex items-center justify-between"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><idem-logo variant="primary" class="h-[34px]"></idem-logo></div><h1 class="font-display text-[84px] font-bold leading-[0.98] tracking-[-0.02em] text-ink">{{title}}</h1></div><div class="col-span-4 row-span-3 flex flex-col justify-end bg-brand-primary p-[28px] text-on-brand"><p class="font-display text-[26px] font-medium leading-[1.2]">{{sub}}</p></div><div class="col-span-2 row-span-3 flex flex-col justify-end bg-brand-accent p-[22px] text-on-accent"><p class="font-display text-[34px] font-black tabular-nums leading-none">{{year}}</p></div></div>`,
  },
  {
    id: 'cv08', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 1, style: 'editorial',
    intent: 'deck cover, typographic: a very large serif sentence as the title, a thin rule, the presenter at the foot',
    texts: { kicker: 'Series A', title: 'Farmers should know their soil before they plant.', who: 'SoilSense Musanze', date: 'October 2026' },
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[56px]"><div class="flex items-center justify-between"><idem-logo variant="primary" class="h-[36px]"></idem-logo><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p></div><h1 class="max-w-[900px] font-display text-[76px] font-bold leading-[1.02] tracking-[-0.015em] text-ink">{{title}}</h1><div class="flex items-center justify-between border-t-[3px] border-brand-primary pt-[14px] text-[14px] text-ink"><span class="font-bold">{{who}}</span><span class="tabular-nums text-muted">{{date}}</span></div></div>`,
  },
  {
    id: 'cv09', doc: 'cover', format: 'page-a4', role: 'cover', brand: 11, style: 'pop-art',
    intent: 'business plan cover with a procedural circle pattern on the top half as a graphic field, a framed white title block overlapping its edge',
    texts: { kicker: 'Plano de negócios', title: 'Capulana Viva', sub: 'Moda em capulana, feita em Maputo', date: '2026–2029' },
    html: `<div class="relative h-full w-full bg-ground"><div class="absolute inset-x-0 top-0 h-[56%] bg-brand-primary"><idem-pattern kind="hand-circles" density="0.8" class="absolute inset-0"></idem-pattern></div><idem-logo variant="onDark" class="absolute left-[56px] top-[48px] h-[52px]"></idem-logo><div class="absolute inset-x-[56px] bottom-[110px] bg-ground p-[40px] shadow-[0_0_0_2px_var(--color-ink)]"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><h1 class="mt-[12px] font-display text-[80px] font-black leading-[0.95] text-ink">{{title}}</h1><p class="mt-[14px] text-[18px] text-muted">{{sub}}</p></div><p class="absolute bottom-[56px] left-[56px] text-[13px] font-bold tabular-nums text-ink">{{date}}</p></div>`,
  },
  {
    id: 'cv10', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 9,
    intent: 'deck cover: split screen, a photograph on the right half, the title and exporter name on the left on paper',
    texts: { kicker: 'Offre export 2026', title: 'Du champ à la tasse, en Allemagne', who: 'Café des Grassfields, Bafoussam' },
    images: { 'hero.url': 'photo:#d9a441,#5b3a29,#2f6b4f' },
    html: `<div class="grid h-full w-full grid-cols-2 bg-ground"><div class="flex flex-col justify-between p-[56px]"><idem-logo variant="primary" class="h-[40px] self-start"></idem-logo><div><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><h1 class="mt-[14px] font-display text-[56px] font-bold leading-[1.02] text-ink">{{title}}</h1></div><p class="text-[14px] text-muted">{{who}}</p></div><img src="{{hero.url}}" alt="" class="h-full w-full object-cover"></div>`,
  },
  {
    id: 'cv11', doc: 'cover', format: 'page-a4', role: 'cover', brand: 2,
    intent: 'brand book cover with a photograph filling the whole page and a brand strip along the bottom edge holding the title',
    texts: { kicker: 'Guide de la marque', title: 'Lopé Écolodge', sub: 'Tourisme de nature, au rythme de la forêt' },
    images: { 'hero.url': 'photo:#9fd3a8,#355e3b,#1b2e20' },
    html: `<div class="relative h-full w-full"><img src="{{hero.url}}" alt="" class="absolute inset-0 h-full w-full object-cover"><idem-logo variant="onDark" class="absolute left-[56px] top-[52px] h-[60px]"></idem-logo><div class="absolute inset-x-0 bottom-0 bg-brand-primary p-[48px] text-on-brand"><p class="text-[13px] font-bold uppercase tracking-[0.2em]">{{kicker}}</p><h1 class="mt-[10px] font-display text-[64px] font-bold leading-[1]">{{title}}</h1><p class="mt-[10px] text-[17px]">{{sub}}</p></div></div>`,
  },
  {
    id: 'cv12', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 4,
    intent: 'deck cover with two colour fields side by side, the title crossing from the light field into the dark one',
    texts: { kicker: 'Wholesale catalogue', title: 'Bark & Co. 2027', sub: 'Hand-made bark cloth goods from Kampala' },
    html: `<div class="relative flex h-full w-full"><div class="w-[55%] bg-ground"></div><div class="w-[45%] bg-brand-primary"></div><div class="absolute inset-0 flex flex-col justify-between p-[56px]"><div class="flex items-center justify-between"><idem-logo variant="primary" class="h-[38px]"></idem-logo><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-on-brand">{{kicker}}</p></div><div><h1 class="font-display text-[112px] font-black leading-[0.9] tracking-[-0.03em] text-ink">{{title}}</h1><p class="mt-[18px] max-w-[520px] text-[20px] leading-[1.3] text-ink">{{sub}}</p></div></div></div>`,
  },
  {
    id: 'cv13', doc: 'cover', format: 'page-a4', role: 'cover', brand: 6,
    intent: 'report cover: a bold brand-colour band across the middle with the title on it, white above and below holding small meta lines',
    texts: { kicker: 'Annual report', title: 'Delivered on time, 41,000 times', date: 'Financial year 2026', by: 'LastMile Zambia Ltd, Lusaka' },
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground py-[56px]"><div class="flex items-center justify-between px-[56px]"><idem-logo variant="primary" class="h-[44px]"></idem-logo><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p></div><div class="bg-brand-primary px-[56px] py-[64px] text-on-brand"><h1 class="max-w-[600px] font-display text-[78px] font-black leading-[0.98] tracking-[-0.02em]">{{title}}</h1></div><div class="flex items-center justify-between px-[56px] text-[13px] text-ink"><span class="font-bold">{{by}}</span><span class="tabular-nums">{{date}}</span></div></div>`,
  },
  {
    id: 'cv14', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 0, style: 'collage-art',
    intent: 'deck cover where the logo is the graphic: a very large logo bleeding off the right edge, the title on the left',
    texts: { kicker: 'Dossier de financement', title: 'Noix d’Or Korhogo', sub: 'Décortiquer le cajou là où il pousse', date: '2026' },
    html: `<div class="relative h-full w-full overflow-hidden bg-brand-soft"><idem-logo variant="primary" class="absolute -right-[120px] top-1/2 h-[560px] -translate-y-1/2"></idem-logo><div class="absolute inset-y-0 left-0 flex w-[60%] flex-col justify-between p-[56px]"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><div><h1 class="font-display text-[72px] font-bold leading-[0.98] text-ink">{{title}}</h1><p class="mt-[16px] text-[20px] text-muted">{{sub}}</p></div><p class="text-[14px] font-bold tabular-nums text-ink">{{date}}</p></div></div>`,
  },
  {
    id: 'cv15', doc: 'cover', format: 'page-a4', role: 'cover', brand: 10, style: 'minimalism',
    intent: 'minimal brand book cover: a lot of white, a short title bottom-left, one thin brand rule and the logo bottom-right',
    texts: { kicker: 'Brand guidelines', title: 'Wild Lens', version: '2026' },
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[64px]"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-muted">{{kicker}}</p><div class="flex items-end justify-between"><div><div class="mb-[18px] h-[6px] w-[90px] bg-brand-primary"></div><h1 class="font-display text-[120px] font-bold leading-[0.9] tracking-[-0.03em] text-ink">{{title}}</h1></div><div class="text-right"><idem-logo variant="icon" class="h-[64px]"></idem-logo><p class="mt-[10px] text-[13px] tabular-nums text-muted">{{version}}</p></div></div></div>`,
  },
  {
    id: 'cv16', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 11,
    intent: 'deck cover with a bright accent colour fill, the title in dark ink at huge scale, partner line in the corner',
    texts: { kicker: 'Pitch · Maputo', title: 'Vestir Moçambique', sub: 'Capulana Viva · ronda de investimento 2026' },
    html: `<div class="flex h-full w-full flex-col justify-between bg-brand-accent p-[56px] text-on-accent"><div class="flex items-center justify-between"><p class="text-[13px] font-bold uppercase tracking-[0.2em]">{{kicker}}</p><idem-logo variant="primary" class="h-[40px]"></idem-logo></div><h1 class="font-display text-[132px] font-black leading-[0.88] tracking-[-0.03em]">{{title}}</h1><p class="text-[18px] font-semibold">{{sub}}</p></div>`,
  },
  {
    id: 'cv17', doc: 'cover', format: 'page-a4-landscape', role: 'cover', brand: 8,
    intent: 'landscape brand book cover: logo on a brand-colour left column, the title and subtitle on paper to the right with a rule',
    texts: { kicker: 'Charte graphique', title: 'Code Thiès', sub: 'Apprendre un métier du numérique, près de chez soi', version: 'v1 · 2026' },
    html: `<div class="grid h-full w-full grid-cols-[34%_1fr]"><div class="flex flex-col justify-between bg-brand-primary p-[44px] text-on-brand"><idem-logo variant="onDark" class="h-[70px] self-start"></idem-logo><p class="text-[13px] tabular-nums">{{version}}</p></div><div class="flex flex-col justify-between bg-ground p-[56px]"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><div><h1 class="font-display text-[104px] font-black leading-[0.92] tracking-[-0.02em] text-ink">{{title}}</h1><div class="my-[20px] h-[5px] w-[110px] bg-brand-accent"></div><p class="max-w-[420px] text-[20px] leading-[1.3] text-muted">{{sub}}</p></div></div></div>`,
  },
  {
    id: 'cv18', doc: 'cover', format: 'page-a4', role: 'cover', brand: 7,
    intent: 'business plan cover on a deep ground with a flow texture at the bottom third, the title large and an accent rule',
    texts: { kicker: 'Business plan 2026–2029', title: 'Osusu Digital', sub: 'Digitising savings groups across Sierra Leone', date: 'Freetown · March 2026' },
    html: `<div class="relative flex h-full w-full flex-col justify-between overflow-hidden bg-deep p-[56px] text-on-deep"><idem-pattern kind="flow" density="0.7" class="absolute inset-x-0 bottom-0 h-[42%] opacity-100"></idem-pattern><idem-logo variant="onDark" class="relative h-[52px] self-start"></idem-logo><div class="relative"><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-accent">{{kicker}}</p><h1 class="mt-[16px] font-display text-[96px] font-bold leading-[0.95] tracking-[-0.02em]">{{title}}</h1><div class="my-[20px] h-[5px] w-[110px] bg-brand-accent"></div><p class="max-w-[430px] text-[20px] leading-[1.3]">{{sub}}</p></div><p class="relative text-[13px] tabular-nums opacity-80">{{date}}</p></div>`,
  },
  {
    id: 'cv19', doc: 'cover', format: 'slide-16x9', role: 'cover', brand: 3,
    intent: 'deck cover with a three-band horizontal split of brand colours, the title on the central band',
    texts: { kicker: 'Présentation investisseurs', title: 'Le panier du marché, livré le jeudi', who: 'Cotonou Saveurs · 2026' },
    html: `<div class="flex h-full w-full flex-col"><div class="flex flex-[1] items-center justify-between bg-brand-accent px-[56px] text-on-accent"><p class="text-[13px] font-bold uppercase tracking-[0.2em]">{{kicker}}</p><idem-logo variant="primary" class="h-[36px]"></idem-logo></div><div class="flex flex-[3] items-center bg-brand-primary px-[56px] text-on-brand"><h1 class="max-w-[860px] font-display text-[74px] font-bold leading-[1] tracking-[-0.015em]">{{title}}</h1></div><div class="flex flex-[1] items-center bg-deep px-[56px] text-[14px] text-on-deep">{{who}}</div></div>`,
  },
  {
    id: 'cv20', doc: 'cover', format: 'page-a4', role: 'cover', brand: 9,
    intent: 'brand book cover: a photograph in a tall panel on the right, title and meta aligned on the left, a hairline between',
    texts: { kicker: 'Charte graphique', title: 'Café des Grassfields', sub: 'Arabica de l’Ouest, du champ à la tasse', version: 'Version 2026' },
    images: { 'hero.url': 'photo:#d9a441,#5b3a29,#2f6b4f' },
    html: `<div class="grid h-full w-full grid-cols-[1fr_300px] bg-ground"><div class="flex flex-col justify-between p-[56px]"><idem-logo variant="primary" class="h-[48px] self-start"></idem-logo><div><p class="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><h1 class="mt-[14px] font-display text-[76px] font-bold leading-[0.98] text-ink">{{title}}</h1><p class="mt-[16px] max-w-[300px] text-[17px] leading-[1.35] text-muted">{{sub}}</p></div><p class="border-t border-rule pt-[10px] text-[13px] tabular-nums text-muted">{{version}}</p></div><img src="{{hero.url}}" alt="" class="h-full w-full object-cover"></div>`,
  },
];
