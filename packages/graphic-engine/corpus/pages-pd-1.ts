import type { CorpusPage } from './types';
import { folio, slide } from './kit';

const F = (n: number) => folio('Pitch', n);

/** Pitch deck — diapositives 16:9 (1 à 10). */
export const PAGES: CorpusPage[] = [
  {
    id: 'pd01', doc: 'pitch-deck', format: 'slide-16x9', role: 'opening', brand: 6,
    intent: 'the problem stated as one sentence set very large, with a single supporting figure at the right',
    texts: { folio: F(1), kicker: 'The problem', title: 'Pharmacies lose one in four customers to a late delivery', 'fig.v': '26 %', 'fig.l': 'of prescriptions in Lusaka are collected from a second pharmacy because the first could not deliver on time' },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]">
  <div class="col-span-7 flex flex-col justify-center"><p class="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[16px] font-display text-[56px] font-bold leading-[1.02] tracking-[-0.01em] text-ink">{{title}}</h2></div>
  <div class="col-span-5 flex flex-col justify-end border-l-[3px] border-brand-primary pl-[32px]"><p class="font-display text-[110px] font-bold leading-none tabular-nums text-brand-primary">{{fig.v}}</p><p class="mt-[14px] text-[16px] leading-[1.45] text-muted">{{fig.l}}</p></div>
</div>`),
  },
  {
    id: 'pd02', doc: 'pitch-deck', format: 'slide-16x9', role: 'process', brand: 8,
    intent: 'how the product works in three steps, each a card with a number, a verb and a sentence',
    texts: { folio: F(2), title: 'Du téléphone au premier cours en trois gestes', 's0.n': '1', 's0.t': 'S’inscrire', 's0.b': 'Un message WhatsApp suffit. Le test de niveau dure dix minutes.', 's1.n': '2', 's1.t': 'Choisir un parcours', 's1.b': 'Web, données ou design. Chaque parcours mène à un stage.', 's2.n': '3', 's2.t': 'Apprendre le soir', 's2.b': 'Deux heures par jour au campus, ou en ligne si la route est trop longue.' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="max-w-[80%] font-display text-[40px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[34px] grid flex-1 grid-cols-3 gap-[20px]">
  <div class="flex flex-col justify-between bg-brand-soft p-[26px]"><p class="font-display text-[64px] font-black leading-none text-brand-primary">{{s0.n}}</p><div><p class="font-display text-[26px] font-bold text-ink">{{s0.t}}</p><p class="mt-[8px] text-[16px] leading-[1.45] text-ink">{{s0.b}}</p></div></div>
  <div class="flex flex-col justify-between bg-brand-soft p-[26px]"><p class="font-display text-[64px] font-black leading-none text-brand-primary">{{s1.n}}</p><div><p class="font-display text-[26px] font-bold text-ink">{{s1.t}}</p><p class="mt-[8px] text-[16px] leading-[1.45] text-ink">{{s1.b}}</p></div></div>
  <div class="flex flex-col justify-between bg-brand-primary p-[26px] text-on-brand"><p class="font-display text-[64px] font-black leading-none">{{s2.n}}</p><div><p class="font-display text-[26px] font-bold">{{s2.t}}</p><p class="mt-[8px] text-[16px] leading-[1.45]">{{s2.b}}</p></div></div>
</div></div>`),
  },
  {
    id: 'pd03', doc: 'pitch-deck', format: 'slide-16x9', role: 'data', brand: 10,
    intent: 'traction: one big figure on the left with the growth chart that proves it on the right',
    texts: { folio: F(3), kicker: 'Traction', 'big.v': '12,400', 'big.l': 'traders paid through SokoPay in nine months', 'c1.title': 'Active traders per month', 'c1.readingKey': 'Growth came from word of mouth: no paid acquisition.', note: 'Source: SokoPay platform data, September 2026.' },
    charts: { c1: { chartType: 'area', title: 'x', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], series: [{ name: 'Traders', data: [310, 760, 1400, 2300, 3700, 5200, 7600, 9900, 12400] }], readingKey: 'x' } },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[36px] px-[56px] pb-[64px] pt-[56px]">
  <div class="col-span-5 flex flex-col justify-between"><p class="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><div><p class="font-display text-[96px] font-bold leading-none tabular-nums text-ink">{{big.v}}</p><p class="mt-[14px] max-w-[90%] text-[19px] leading-[1.4] text-ink">{{big.l}}</p></div><p class="text-[12px] text-muted">{{note}}</p></div>
  <div class="col-span-7 flex flex-col justify-center"><p class="mb-[8px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-aspect="16/10" class="w-full text-ink"></idem-chart><p class="mt-[12px] border-l-[4px] border-brand-primary pl-[12px] text-[15px] text-ink">{{c1.readingKey}}</p></div>
</div>`),
  },
  {
    id: 'pd04', doc: 'pitch-deck', format: 'slide-16x9', role: 'data', brand: 7,
    intent: 'market size: three nested bars of decreasing width, each holding its amount and its name',
    texts: { folio: F(4), title: 'Un marché de 480 millions de dollars en Afrique de l’Ouest anglophone', 't.v': '$480 M', 't.l': 'Total market: savings groups in West Africa', 's.v': '$96 M', 's.l': 'Serviceable: groups with mobile access, Sierra Leone, Liberia and Gambia', 'o.v': '$14 M', 'o.l': 'Obtainable by 2029: 7,500 groups' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="max-w-[88%] font-display text-[34px] font-bold leading-[1.1] text-ink">{{title}}</h2>
<div class="mt-[30px] flex flex-1 flex-col gap-[12px]">
  <div class="flex w-full flex-1 items-center gap-[28px] bg-brand-soft px-[28px]"><p class="w-[190px] font-display text-[48px] font-bold tabular-nums text-ink">{{t.v}}</p><p class="text-[17px] text-ink">{{t.l}}</p></div>
  <div class="flex w-[72%] flex-1 items-center gap-[28px] bg-brand-secondary px-[28px] text-on-brand"><p class="w-[190px] whitespace-nowrap font-display text-[48px] font-bold tabular-nums">{{s.v}}</p><p class="text-[17px]">{{s.l}}</p></div>
  <div class="flex w-[52%] flex-1 items-center gap-[24px] bg-brand-primary px-[28px] text-on-brand"><p class="w-[150px] whitespace-nowrap font-display text-[48px] font-bold tabular-nums">{{o.v}}</p><p class="text-[17px]">{{o.l}}</p></div>
</div></div>`),
  },
  {
    id: 'pd05', doc: 'pitch-deck', format: 'slide-16x9', role: 'comparison', brand: 6, style: 'swiss',
    intent: 'unit economics: a clear table of per-delivery revenue, cost and margin, with the margin highlighted',
    texts: { folio: F(5), title: 'Each delivery earns a margin from the first month', lede: 'Average pharmacy delivery in Lusaka, in kwacha.' },
    tables: { t1: { headers: ['Per delivery', 'Today', 'At scale'], rows: [['Fee charged', '38', '38'], ['Rider cost', '24', '17'], ['Fuel and maintenance', '6', '5'], ['Contribution margin', '8', '16']] } },
    html: slide(`<div class="grid h-full grid-cols-12 gap-[40px] px-[56px] pb-[64px] pt-[56px]"><div class="col-span-4 flex flex-col justify-center"><h2 class="font-display text-[38px] font-bold leading-[1.08] text-ink">{{title}}</h2><p class="mt-[14px] text-[15px] leading-[1.5] text-muted">{{lede}}</p></div>
<div class="col-span-8 flex items-center"><idem-table data-block="t1" class="w-full text-[20px] tabular-nums [&_th]:border-b-[3px] [&_th]:border-ink [&_th]:py-[14px] [&_th]:text-right [&_th:first-child]:text-left [&_td]:border-b [&_td]:border-rule [&_td]:py-[18px] [&_td]:text-right [&_td:first-child]:text-left [&_tr:last-child]:bg-brand-primary [&_tr:last-child]:font-bold [&_tr:last-child]:text-on-brand [&_tr:last-child_td]:px-[12px] [&_th]:px-[12px] [&_td]:px-[12px]"></idem-table></div></div>`),
  },
  {
    id: 'pd06', doc: 'pitch-deck', format: 'slide-16x9', role: 'showcase', brand: 9,
    intent: 'team: four columns separated by rules, each with a large name, role and one proof point',
    texts: { folio: F(6), title: 'Une équipe qui a déjà vendu du café à l’étranger', 'p0.n': 'Ngwa Tabi', 'p0.r': 'Directeur', 'p0.b': '18 ans d’export de café, ancien acheteur chez un torréfacteur de Hambourg.', 'p1.n': 'Fonyuy Lum', 'p1.r': 'Agronome', 'p1.b': 'Accompagne 210 planteurs sur la qualité et le séchage.', 'p2.n': 'Clarisse Ebang', 'p2.r': 'Finances', 'p2.b': 'Experte-comptable, a levé 400 millions F CFA pour deux coopératives.', 'p3.n': 'Jean Kamga', 'p3.r': 'Logistique', 'p3.b': '12 ans au port de Douala. Gère le transit de 3 conteneurs par mois.' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="max-w-[85%] font-display text-[36px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[34px] grid flex-1 grid-cols-4 border-t-[3px] border-brand-primary">
  <div class="flex flex-col justify-between border-r border-rule py-[22px] pr-[18px]"><div><p class="font-display text-[26px] font-bold leading-[1.1] text-ink">{{p0.n}}</p><p class="mt-[6px] text-[12px] font-bold uppercase tracking-[0.12em] text-brand-primary">{{p0.r}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p0.b}}</p></div>
  <div class="flex flex-col justify-between border-r border-rule px-[18px] py-[22px]"><div><p class="font-display text-[26px] font-bold leading-[1.1] text-ink">{{p1.n}}</p><p class="mt-[6px] text-[12px] font-bold uppercase tracking-[0.12em] text-brand-primary">{{p1.r}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p1.b}}</p></div>
  <div class="flex flex-col justify-between border-r border-rule px-[18px] py-[22px]"><div><p class="font-display text-[26px] font-bold leading-[1.1] text-ink">{{p2.n}}</p><p class="mt-[6px] text-[12px] font-bold uppercase tracking-[0.12em] text-brand-primary">{{p2.r}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p2.b}}</p></div>
  <div class="flex flex-col justify-between py-[22px] pl-[18px]"><div><p class="font-display text-[26px] font-bold leading-[1.1] text-ink">{{p3.n}}</p><p class="mt-[6px] text-[12px] font-bold uppercase tracking-[0.12em] text-brand-primary">{{p3.r}}</p></div><p class="text-[15px] leading-[1.5] text-ink">{{p3.b}}</p></div>
</div></div>`),
  },
  {
    id: 'pd07', doc: 'pitch-deck', format: 'slide-16x9', role: 'comparison', brand: 8,
    intent: 'competition: a two-axis positioning grid with the four players placed as labels, ours in the empty top-right',
    texts: { folio: F(7), title: 'Seuls à la fois abordables et reconnus', 'ax.x': 'Prix mensuel →', 'ax.y': 'Diplôme reconnu ↑', 'c0': 'Écoles privées de Dakar', 'c1': 'Cours en ligne', 'c2': 'Centres de quartier', 'us': 'Code Thiès' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="font-display text-[36px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="relative mt-[26px] flex-1 border-b-[2px] border-l-[2px] border-ink">
  <p class="absolute -top-[4px] left-[14px] text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{{ax.y}}</p>
  <p class="absolute bottom-[10px] right-[14px] text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{{ax.x}}</p>
  <div class="absolute left-0 top-1/2 h-px w-full bg-rule"></div><div class="absolute left-1/2 top-0 h-full w-px bg-rule"></div>
  <p class="absolute left-[8%] top-[18%] bg-ground px-[8px] py-[4px] text-[17px] font-semibold text-muted">{{c0}}</p>
  <p class="absolute bottom-[22%] left-[14%] bg-ground px-[8px] py-[4px] text-[17px] font-semibold text-muted">{{c1}}</p>
  <p class="absolute bottom-[34%] left-[56%] bg-ground px-[8px] py-[4px] text-[17px] font-semibold text-muted">{{c2}}</p>
  <p class="absolute right-[10%] top-[10%] bg-brand-primary px-[22px] py-[12px] font-display text-[28px] font-bold text-on-brand">{{us}}</p>
</div></div>`),
  },
  {
    id: 'pd08', doc: 'pitch-deck', format: 'slide-16x9', role: 'process', brand: 11,
    intent: 'roadmap: a horizontal line with four dated milestones above and below alternately',
    texts: { folio: F(8), title: 'Do primeiro ponto de venda às três cidades', 'm0.d': '2026', 'm0.t': 'Maputo', 'm0.b': 'Loja piloto no Mercado Central', 'm1.d': '2027', 'm1.t': 'Matola', 'm1.b': 'Segunda loja e site de vendas', 'm2.d': '2028', 'm2.t': 'Beira', 'm2.b': 'Terceira loja e atelier de corte', 'm3.d': '2029', 'm3.t': 'Exportação', 'm3.b': 'Primeiros pedidos para Lisboa e Joanesburgo' },
    html: slide(`<div class="flex h-full flex-col px-[56px] pb-[64px] pt-[52px]"><h2 class="max-w-[80%] font-display text-[36px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="relative mt-[26px] flex flex-1 items-center"><div class="absolute left-0 right-0 top-1/2 h-[3px] bg-ink"></div>
  <div class="grid w-full grid-cols-4 gap-[16px]">
    <div class="relative flex flex-col items-start"><span class="mb-[14px] block size-[18px] rounded-full bg-brand-primary"></span><p class="font-display text-[40px] font-bold tabular-nums text-brand-primary">{{m0.d}}</p><p class="mt-[6px] text-[20px] font-semibold text-ink">{{m0.t}}</p><p class="mt-[4px] text-[14px] leading-[1.4] text-muted">{{m0.b}}</p></div>
    <div class="relative flex flex-col items-start"><span class="mb-[14px] block size-[18px] rounded-full bg-brand-primary"></span><p class="font-display text-[40px] font-bold tabular-nums text-brand-primary">{{m1.d}}</p><p class="mt-[6px] text-[20px] font-semibold text-ink">{{m1.t}}</p><p class="mt-[4px] text-[14px] leading-[1.4] text-muted">{{m1.b}}</p></div>
    <div class="relative flex flex-col items-start"><span class="mb-[14px] block size-[18px] rounded-full bg-brand-primary"></span><p class="font-display text-[40px] font-bold tabular-nums text-brand-primary">{{m2.d}}</p><p class="mt-[6px] text-[20px] font-semibold text-ink">{{m2.t}}</p><p class="mt-[4px] text-[14px] leading-[1.4] text-muted">{{m2.b}}</p></div>
    <div class="relative flex flex-col items-start"><span class="mb-[14px] block size-[18px] rounded-full bg-brand-accent"></span><p class="font-display text-[40px] font-bold tabular-nums text-ink">{{m3.d}}</p><p class="mt-[6px] text-[20px] font-semibold text-ink">{{m3.t}}</p><p class="mt-[4px] text-[14px] leading-[1.4] text-muted">{{m3.b}}</p></div>
  </div></div></div>`),
  },
  {
    id: 'pd09', doc: 'pitch-deck', format: 'slide-16x9', role: 'closing', brand: 7, style: 'swiss',
    intent: 'the ask: the amount in huge type on a brand-colour half, use of funds as a bar chart on the other half',
    texts: { folio: F(9), kicker: 'The ask', 'ask.v': '$1.2 M', 'ask.l': 'seed round, 18 months of runway', 'c1.title': 'Use of funds (%)', 'c1.readingKey': 'Half of the round goes to opening agent networks in two new districts.' },
    charts: { c1: { chartType: 'horizontalBar', title: 'x', labels: ['Agent networks', 'USSD platform', 'Team', 'Compliance and licences'], series: [{ name: 'Share', data: [50, 22, 20, 8] }], readingKey: 'x', unit: '%' } },
    html: `<div class="grid h-full w-full grid-cols-12"><div class="relative col-span-5 flex flex-col justify-between bg-brand-primary p-[56px] text-on-brand"><p class="text-[13px] font-semibold uppercase tracking-[0.16em]">{{kicker}}</p><div><p class="whitespace-nowrap font-display text-[88px] font-black leading-none tracking-[-0.02em] tabular-nums">{{ask.v}}</p><p class="mt-[14px] text-[19px] leading-[1.4]">{{ask.l}}</p></div><idem-logo variant="onDark" class="h-[24px]"></idem-logo></div>
<div class="col-span-7 flex flex-col justify-center bg-ground p-[56px]"><p class="mb-[8px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-type="horizontalBar" data-highlight="Agent networks" data-aspect="16/10" class="w-full text-ink"></idem-chart><p class="mt-[14px] text-[15px] leading-[1.45] text-ink">{{c1.readingKey}}</p><p class="mt-[18px] text-right text-[11px] tabular-nums text-muted">{{folio}}</p></div></div>`,
  },
  {
    id: 'pd10', doc: 'pitch-deck', format: 'slide-16x9', role: 'showcase', brand: 10,
    intent: 'the product: a large photograph on one side, a short feature list with bold leads on the other',
    texts: { folio: F(10), kicker: 'Product', title: 'The terminal that fits in a trader’s apron', 'f0.t': 'Scan to pay', 'f0.b': 'One QR code per stall, printed and laminated.', 'f1.t': 'Works offline', 'f1.b': 'Payments queue and send when the signal returns.', 'f2.t': 'Instant receipt', 'f2.b': 'An SMS confirms every sale in the buyer’s language.' },
    images: { 'hero.url': 'photo:#f2b950,#c96f2d,#2a5d46' },
    html: `<div class="grid h-full w-full grid-cols-12 bg-ground"><div class="col-span-6"><img src="{{hero.url}}" alt="" class="h-full w-full object-cover"></div>
<div class="relative col-span-6 flex flex-col justify-center px-[52px] pb-[60px] pt-[40px]"><p class="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[12px] font-display text-[38px] font-bold leading-[1.06] text-ink">{{title}}</h2>
<ul class="mt-[28px] flex flex-col gap-[18px]"><li class="border-l-[4px] border-brand-primary pl-[16px]"><p class="text-[19px] font-bold text-ink">{{f0.t}}</p><p class="mt-[2px] text-[15px] text-muted">{{f0.b}}</p></li><li class="border-l-[4px] border-brand-primary pl-[16px]"><p class="text-[19px] font-bold text-ink">{{f1.t}}</p><p class="mt-[2px] text-[15px] text-muted">{{f1.b}}</p></li><li class="border-l-[4px] border-brand-primary pl-[16px]"><p class="text-[19px] font-bold text-ink">{{f2.t}}</p><p class="mt-[2px] text-[15px] text-muted">{{f2.b}}</p></li></ul>
<div class="absolute bottom-[22px] left-[52px] right-[52px] flex items-center justify-between text-[11px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></div></div></div>`,
  },
];
