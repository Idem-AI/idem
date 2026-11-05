import type { CorpusPage } from './types';
import { folio, slide } from './kit';

const F = (n: number) => folio('Pitch', n);

/** Pitch deck — diapositives 16:9 (11 à 20). */
export const PAGES: CorpusPage[] = [
  {
    id: 'pd11', doc: 'pitch-deck', format: 'slide-16x9', role: 'showcase', brand: 0, style: 'editorial',
    intent: 'a customer testimonial: a very large quote with the name and the result of the customer beneath',
    texts: { folio: F(11), quote: 'Avant, je vendais mes noix à un intermédiaire. Aujourd’hui, je connais le prix avant la récolte.', who: 'Salimata Coulibaly', role: 'Productrice, 6 hectares, Korhogo', 'res.v': '+ 34 %', 'res.l': 'de revenu par hectare en deux campagnes' },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]"><div class="col-span-9 flex flex-col justify-center"><p class="font-display text-[46px] font-medium italic leading-[1.12] text-ink">{{quote}}</p><div class="mt-[28px] border-l-[4px] border-brand-primary pl-[14px]"><p class="text-[18px] font-bold text-ink">{{who}}</p><p class="text-[14px] text-muted">{{role}}</p></div></div>
<div class="col-span-3 flex flex-col justify-end border-l border-rule pl-[26px]"><p class="whitespace-nowrap font-display text-[52px] font-bold leading-none tabular-nums text-brand-primary">{{res.v}}</p><p class="mt-[10px] text-[14px] leading-[1.45] text-muted">{{res.l}}</p></div></div>`),
  },
  {
    id: 'pd12', doc: 'pitch-deck', format: 'slide-16x9', role: 'process', brand: 9,
    intent: 'sales funnel: four horizontal bars narrowing from the top, each holding a count and a stage name',
    texts: { folio: F(12), title: 'De 4 000 visites à 120 acheteurs par an', 'f0.v': '4 000', 'f0.l': 'visites sur le site et les salons', 'f1.v': '900', 'f1.l': 'demandes d’échantillons', 'f2.v': '310', 'f2.l': 'commandes d’essai', 'f3.v': '120', 'f3.l': 'acheteurs réguliers' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="font-display text-[36px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[28px] flex flex-1 flex-col items-center gap-[10px]">
<div class="flex w-full flex-1 items-center justify-between bg-brand-soft px-[28px]"><p class="font-display text-[40px] font-bold tabular-nums text-ink">{{f0.v}}</p><p class="text-[17px] text-ink">{{f0.l}}</p></div>
<div class="flex w-[78%] flex-1 items-center justify-between bg-brand-secondary px-[28px] text-on-brand"><p class="font-display text-[40px] font-bold tabular-nums">{{f1.v}}</p><p class="text-[17px]">{{f1.l}}</p></div>
<div class="flex w-[56%] flex-1 items-center justify-between bg-brand-primary px-[28px] text-on-brand"><p class="font-display text-[40px] font-bold tabular-nums">{{f2.v}}</p><p class="text-[17px]">{{f2.l}}</p></div>
<div class="flex w-[34%] flex-1 items-center justify-between gap-[12px] bg-deep px-[22px] text-on-deep"><p class="font-display text-[40px] font-bold tabular-nums">{{f3.v}}</p><p class="text-[15px] leading-[1.2]">{{f3.l}}</p></div></div></div>`),
  },
  {
    id: 'pd13', doc: 'pitch-deck', format: 'slide-16x9', role: 'data', brand: 1,
    intent: 'revenue forecast: a bar chart with the last year highlighted and three KPIs in a column at the right',
    texts: { folio: F(13), title: 'Revenue reaches 24.8 million within three years', 'c1.title': 'Revenue, million RWF', 'c1.readingKey': 'x', 'k0.v': '41 %', 'k0.l': 'gross margin in 2028', 'k1.v': '1,350', 'k1.l': 'cooperatives served', 'k2.v': 'M19', 'k2.l': 'break-even month' },
    charts: { c1: { chartType: 'bar', title: 'x', labels: ['2026', '2027', '2028'], series: [{ name: 'Revenue', data: [4.2, 11.6, 24.8] }], readingKey: 'x' } },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[48px]"><h2 class="max-w-[85%] font-display text-[34px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[18px] grid flex-1 grid-cols-12 gap-[34px]"><div class="col-span-8 flex flex-col justify-center"><p class="mb-[6px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-highlight="2028" data-aspect="16/8" class="w-full text-ink"></idem-chart></div>
<div class="col-span-4 flex flex-col justify-center border-l border-rule pl-[30px]"><div class="border-b border-rule pb-[20px]"><p class="font-display text-[54px] font-bold leading-none tabular-nums text-brand-primary">{{k0.v}}</p><p class="mt-[6px] text-[14px] text-muted">{{k0.l}}</p></div><div class="border-b border-rule py-[20px]"><p class="font-display text-[54px] font-bold leading-none tabular-nums text-ink">{{k1.v}}</p><p class="mt-[6px] text-[14px] text-muted">{{k1.l}}</p></div><div class="pt-[20px]"><p class="font-display text-[54px] font-bold leading-none tabular-nums text-ink">{{k2.v}}</p><p class="mt-[6px] text-[14px] text-muted">{{k2.l}}</p></div></div></div></div>`),
  },
  {
    id: 'pd14', doc: 'pitch-deck', format: 'slide-16x9', role: 'comparison', brand: 6,
    intent: 'before and after: two halves, a muted ground for the old way and the brand colour for the new way, each with three lines',
    texts: { folio: F(14), 'b.t': 'Before', 'b.0': 'Customers phone the pharmacy to ask where the order is', 'b.1': 'Riders wait 40 minutes for a handover', 'b.2': 'Payment in cash, counted at night', 'a.t': 'With LastMile', 'a.0': 'Live tracking on the customer’s phone', 'a.1': 'Rider notified when the order is ready', 'a.2': 'Mobile money, settled the same day' },
    html: `<div class="grid h-full w-full grid-cols-2"><div class="flex flex-col justify-center bg-sunken px-[56px] pb-[50px]"><p class="text-[14px] font-bold uppercase tracking-[0.16em] text-muted">{{b.t}}</p><ul class="mt-[28px] flex flex-col gap-[26px] font-display text-[26px] leading-[1.2] text-ink"><li class="border-t border-rule pt-[14px]">{{b.0}}</li><li class="border-t border-rule pt-[14px]">{{b.1}}</li><li class="border-t border-rule pt-[14px]">{{b.2}}</li></ul></div>
<div class="relative flex flex-col justify-center bg-brand-primary px-[56px] pb-[50px] text-on-brand"><p class="text-[14px] font-bold uppercase tracking-[0.16em]">{{a.t}}</p><ul class="mt-[28px] flex flex-col gap-[26px] font-display text-[26px] font-bold leading-[1.2]"><li class="border-t border-on-brand/40 pt-[14px]">{{a.0}}</li><li class="border-t border-on-brand/40 pt-[14px]">{{a.1}}</li><li class="border-t border-on-brand/40 pt-[14px]">{{a.2}}</li></ul><div class="absolute bottom-[22px] left-[56px] right-[56px] flex items-center justify-between text-[11px]"><idem-logo variant="onDark" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></div></div></div>`,
  },
  {
    id: 'pd15', doc: 'pitch-deck', format: 'slide-16x9', role: 'opening', brand: 7,
    intent: 'why now: three converging trends, each with an oversized figure and a short label, on a ruled row',
    texts: { folio: F(15), title: 'Why now', 't0.v': '78 %', 't0.l': 'of adults in Sierra Leone own a mobile phone', 't1.v': '3×', 't1.l': 'growth of mobile-money users since 2021', 't2.v': '2026', 't2.l': 'the central bank opens agent banking licences to fintechs' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="font-display text-[60px] font-bold leading-none tracking-[-0.02em] text-ink">{{title}}</h2>
<div class="mt-auto grid grid-cols-3 border-t-[3px] border-ink"><div class="border-r border-rule pb-[10px] pr-[26px] pt-[24px]"><p class="font-display text-[84px] font-bold leading-none tabular-nums text-brand-primary">{{t0.v}}</p><p class="mt-[12px] text-[17px] leading-[1.4] text-ink">{{t0.l}}</p></div><div class="border-r border-rule px-[26px] pb-[10px] pt-[24px]"><p class="font-display text-[84px] font-bold leading-none tabular-nums text-brand-primary">{{t1.v}}</p><p class="mt-[12px] text-[17px] leading-[1.4] text-ink">{{t1.l}}</p></div><div class="pb-[10px] pl-[26px] pt-[24px]"><p class="font-display text-[84px] font-bold leading-none tabular-nums text-brand-primary">{{t2.v}}</p><p class="mt-[12px] text-[17px] leading-[1.4] text-ink">{{t2.l}}</p></div></div></div>`),
  },
  {
    id: 'pd16', doc: 'pitch-deck', format: 'slide-16x9', role: 'data', brand: 2,
    intent: 'impact metrics on a deep ground: a two-by-two grid of large figures with thin rules',
    texts: { folio: F(16), kicker: 'Impact', title: 'Un tourisme qui reste dans les villages', 'a.v': '23', 'a.l': 'emplois locaux', 'b.v': '8 %', 'b.l': 'des recettes reversés au fonds villageois', 'c.v': '90 %', 'c.l': 'd’énergie solaire', 'd.v': '0', 'd.l': 'bouteille plastique à usage unique' },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]"><div class="col-span-4 flex flex-col justify-between"><p class="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-accent">{{kicker}}</p><h2 class="font-display text-[40px] font-bold leading-[1.06]">{{title}}</h2></div>
<div class="col-span-8 grid grid-cols-2 grid-rows-2 gap-x-[40px]"><div class="flex flex-col justify-center border-t border-on-deep/30"><p class="font-display text-[80px] font-bold leading-none tabular-nums text-brand-accent">{{a.v}}</p><p class="mt-[8px] text-[16px]">{{a.l}}</p></div><div class="flex flex-col justify-center border-t border-on-deep/30"><p class="font-display text-[80px] font-bold leading-none tabular-nums text-brand-accent">{{b.v}}</p><p class="mt-[8px] text-[16px]">{{b.l}}</p></div><div class="flex flex-col justify-center border-t border-on-deep/30"><p class="font-display text-[80px] font-bold leading-none tabular-nums text-brand-accent">{{c.v}}</p><p class="mt-[8px] text-[16px]">{{c.l}}</p></div><div class="flex flex-col justify-center border-t border-on-deep/30"><p class="font-display text-[80px] font-bold leading-none tabular-nums text-brand-accent">{{d.v}}</p><p class="mt-[8px] text-[16px]">{{d.l}}</p></div></div></div>`, 'deep'),
  },
  {
    id: 'pd17', doc: 'pitch-deck', format: 'slide-16x9', role: 'comparison', brand: 4,
    intent: 'pricing: three plan columns of equal height, the middle one filled with the brand colour as the recommended plan',
    texts: { folio: F(17), title: 'Three ways to work with us', 'p0.n': 'Maker', 'p0.v': 'Free', 'p0.b': 'List up to 10 products and sell through our shop.', 'p1.n': 'Studio', 'p1.v': 'UGX 90,000', 'p1.u': 'per month', 'p1.b': 'Unlimited products, photography credits and a corporate catalogue.', 'p2.n': 'Workshop', 'p2.v': 'On quote', 'p2.b': 'Custom batches, branding and export paperwork handled for you.' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[48px]"><h2 class="font-display text-[34px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[24px] grid flex-1 grid-cols-3 gap-[16px]"><div class="flex flex-col justify-between border-[2px] border-rule p-[26px]"><div><p class="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">{{p0.n}}</p><p class="mt-[12px] font-display text-[36px] font-bold text-ink">{{p0.v}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p0.b}}</p></div>
<div class="flex flex-col justify-between bg-brand-primary p-[26px] text-on-brand"><div><p class="text-[13px] font-bold uppercase tracking-[0.14em]">{{p1.n}}</p><p class="mt-[12px] whitespace-nowrap font-display text-[36px] font-bold tabular-nums">{{p1.v}}</p><p class="text-[14px]">{{p1.u}}</p></div><p class="text-[15px] leading-[1.5]">{{p1.b}}</p></div>
<div class="flex flex-col justify-between border-[2px] border-rule p-[26px]"><div><p class="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">{{p2.n}}</p><p class="mt-[12px] font-display text-[36px] font-bold text-ink">{{p2.v}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p2.b}}</p></div></div></div>`),
  },
  {
    id: 'pd18', doc: 'pitch-deck', format: 'slide-16x9', role: 'showcase', brand: 3,
    intent: 'partners and clients: names set as a typographic wall in two sizes, no logos, with one line of context',
    texts: { folio: F(18), title: 'Ils nous font déjà confiance', lede: 'Restaurants, hôtels et traiteurs livrés chaque matin à Cotonou.', n0: 'Hôtel du Lac', n1: 'Chez Mama Ayi', n2: 'Le Jardin Fon', n3: 'Maquis Sènami', n4: 'Traiteur Ahouansou', n5: 'La Table du Port', n6: 'Résidence Atlantique', n7: 'Café Dantokpa' },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]"><div class="col-span-4 flex flex-col justify-between"><h2 class="font-display text-[42px] font-bold leading-[1.05] text-ink">{{title}}</h2><p class="text-[16px] leading-[1.5] text-muted">{{lede}}</p></div>
<div class="col-span-8 flex flex-wrap content-center gap-x-[30px] gap-y-[14px] border-l-[3px] border-brand-primary pl-[34px] font-display"><span class="text-[44px] font-bold text-ink">{{n0}}</span><span class="text-[30px] text-muted">{{n1}}</span><span class="text-[44px] font-bold text-brand-primary">{{n2}}</span><span class="text-[30px] text-muted">{{n3}}</span><span class="text-[36px] font-bold text-ink">{{n4}}</span><span class="text-[30px] text-muted">{{n5}}</span><span class="text-[44px] font-bold text-ink">{{n6}}</span><span class="text-[30px] text-muted">{{n7}}</span></div></div>`),
  },
  {
    id: 'pd19', doc: 'pitch-deck', format: 'slide-16x9', role: 'closing', brand: 6,
    intent: 'closing: a short call to action very large on the brand colour, with contacts aligned bottom left',
    texts: { folio: F(19), title: 'Let’s put every pharmacy on the map', 'c0.k': 'Email', 'c0.v': 'hello@lastmile.example', 'c1.k': 'Phone', 'c1.v': '+260 97 000 0000', 'c2.k': 'Web', 'c2.v': 'lastmile.example' },
    html: `<div class="relative flex h-full w-full flex-col justify-between bg-brand-primary p-[56px] text-on-brand"><idem-logo variant="onDark" class="h-[34px]"></idem-logo><h2 class="max-w-[80%] font-display text-[78px] font-black leading-[0.98] tracking-[-0.02em]">{{title}}</h2>
<div class="grid grid-cols-3 gap-[30px] border-t border-on-brand/50 pt-[18px] text-[16px]"><div><p class="text-[12px] font-bold uppercase tracking-[0.14em] opacity-80">{{c0.k}}</p><p class="mt-[4px] font-semibold">{{c0.v}}</p></div><div><p class="text-[12px] font-bold uppercase tracking-[0.14em] opacity-80">{{c1.k}}</p><p class="mt-[4px] font-semibold tabular-nums">{{c1.v}}</p></div><div><p class="text-[12px] font-bold uppercase tracking-[0.14em] opacity-80">{{c2.k}}</p><p class="mt-[4px] font-semibold">{{c2.v}}</p></div></div></div>`,
  },
  {
    id: 'pd20', doc: 'pitch-deck', format: 'slide-16x9', role: 'opening', brand: 8,
    intent: 'agenda: five numbered parts as large rows with a rule, the current part not marked, reading as a table of contents',
    texts: { folio: F(20), title: 'Au programme', 'a0.n': '01', 'a0.t': 'Le problème des jeunes de Thiès', 'a1.n': '02', 'a1.t': 'Notre formation', 'a2.n': '03', 'a2.t': 'Ce que disent les chiffres', 'a3.n': '04', 'a3.t': 'L’équipe', 'a4.n': '05', 'a4.t': 'Ce que nous demandons' },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]"><div class="col-span-4"><h2 class="font-display text-[38px] font-bold leading-[1.05] text-ink">{{title}}</h2></div>
<ol class="col-span-8 flex flex-col border-t-[3px] border-brand-primary">
<li class="flex flex-1 items-center gap-[22px] border-b border-rule"><span class="w-[60px] font-display text-[28px] font-bold tabular-nums text-brand-primary">{{a0.n}}</span><span class="font-display text-[28px] font-medium text-ink">{{a0.t}}</span></li>
<li class="flex flex-1 items-center gap-[22px] border-b border-rule"><span class="w-[60px] font-display text-[28px] font-bold tabular-nums text-brand-primary">{{a1.n}}</span><span class="font-display text-[28px] font-medium text-ink">{{a1.t}}</span></li>
<li class="flex flex-1 items-center gap-[22px] border-b border-rule"><span class="w-[60px] font-display text-[28px] font-bold tabular-nums text-brand-primary">{{a2.n}}</span><span class="font-display text-[28px] font-medium text-ink">{{a2.t}}</span></li>
<li class="flex flex-1 items-center gap-[22px] border-b border-rule"><span class="w-[60px] font-display text-[28px] font-bold tabular-nums text-brand-primary">{{a3.n}}</span><span class="font-display text-[28px] font-medium text-ink">{{a3.t}}</span></li>
<li class="flex flex-1 items-center gap-[22px] border-b border-rule"><span class="w-[60px] font-display text-[28px] font-bold tabular-nums text-brand-primary">{{a4.n}}</span><span class="font-display text-[28px] font-medium text-ink">{{a4.t}}</span></li></ol></div>`),
  },
];
