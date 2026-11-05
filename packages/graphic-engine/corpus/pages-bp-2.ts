import type { CorpusPage } from './types';
import { flow, flowHead, folio } from './kit';

const F = (n: number) => folio('Business plan 2026', n);

/** Business plan — pages A4 (11 à 20). */
export const PAGES: CorpusPage[] = [
  {
    id: 'bp11', doc: 'business-plan', format: 'a4-portrait', role: 'visual', brand: 10, style: 'editorial',
    intent: 'SWOT: four quadrants of equal weight, each with a heading and three short points',
    texts: {
      folio: F(11), kicker: 'Strategy', title: 'Where we stand: strengths, weaknesses, openings, threats',
      's.t': 'Strengths', 's.0': 'Ten years of field access in Laikipia and Mara', 's.1': 'Print partners in London and Berlin', 's.2': 'A library of 90,000 curated images',
      'w.t': 'Weaknesses', 'w.0': 'Revenue depends on three seasonal months', 'w.1': 'One senior photographer', 'w.2': 'Archive not yet indexed for search',
      'o.t': 'Opportunities', 'o.0': 'Lodges want licensed imagery for their sites', 'o.1': 'Conservancies fund visual reporting', 'o.2': 'Limited-edition prints sell online',
      'r.t': 'Threats', 'r.0': 'Free stock images lower prices', 'r.1': 'Currency swings affect print exports', 'r.2': 'Access rules in parks may tighten',
    },
    html: flow(`${flowHead('border-brand-primary', 32)}
<section class="mt-[30px] grid flex-1 grid-cols-2 grid-rows-2 gap-[2px] bg-rule pb-[2px]">
  <div class="bg-brand-soft p-[26px]"><p class="font-display text-[24px] font-bold text-brand-primary">{{s.t}}</p><ul class="mt-[16px] flex flex-col gap-[12px] text-[15px] leading-[1.45] text-ink"><li class="border-t border-rule pt-[10px]">{{s.0}}</li><li class="border-t border-rule pt-[10px]">{{s.1}}</li><li class="border-t border-rule pt-[10px]">{{s.2}}</li></ul></div>
  <div class="bg-ground p-[26px]"><p class="font-display text-[24px] font-bold text-ink">{{w.t}}</p><ul class="mt-[16px] flex flex-col gap-[12px] text-[15px] leading-[1.45] text-ink"><li class="border-t border-rule pt-[10px]">{{w.0}}</li><li class="border-t border-rule pt-[10px]">{{w.1}}</li><li class="border-t border-rule pt-[10px]">{{w.2}}</li></ul></div>
  <div class="bg-ground p-[26px]"><p class="font-display text-[24px] font-bold text-ink">{{o.t}}</p><ul class="mt-[16px] flex flex-col gap-[12px] text-[15px] leading-[1.45] text-ink"><li class="border-t border-rule pt-[10px]">{{o.0}}</li><li class="border-t border-rule pt-[10px]">{{o.1}}</li><li class="border-t border-rule pt-[10px]">{{o.2}}</li></ul></div>
  <div class="bg-brand-soft p-[26px]"><p class="font-display text-[24px] font-bold text-brand-primary">{{r.t}}</p><ul class="mt-[16px] flex flex-col gap-[12px] text-[15px] leading-[1.45] text-ink"><li class="border-t border-rule pt-[10px]">{{r.0}}</li><li class="border-t border-rule pt-[10px]">{{r.1}}</li><li class="border-t border-rule pt-[10px]">{{r.2}}</li></ul></div>
</section>
<div class="h-[24px]"></div>`),
  },
  {
    id: 'bp12', doc: 'business-plan', format: 'a4-portrait', role: 'closing', brand: 11,
    intent: 'funding ask: one huge amount, and a doughnut chart of the use of funds with its legend',
    texts: {
      folio: F(12), kicker: 'Financiamento', title: 'O que pedimos e para que serve', 'ask.value': '18 milhões MZN', 'ask.label': 'em dois anos, para abrir três pontos de venda em Maputo, Matola e Beira',
      'c1.title': 'Utilização dos fundos', 'c1.readingKey': 'Dois terços vão para o que gera receita: stock e lojas.',
      'n0': 'Retorno previsto ao fim do terceiro ano: 1,8 vez o capital investido.', 'n1': 'Garantia: stock de tecido e equipamento de corte avaliados em 6,4 milhões MZN.',
    },
    charts: { c1: { chartType: 'doughnut', title: 'x', labels: ['Stock de capulana', 'Três lojas', 'Equipa e formação', 'Marketing digital'], series: [{ name: 'Fundos', data: [40, 27, 20, 13] }], readingKey: 'x', unit: '%' } },
    html: flow(`${flowHead('border-brand-primary', 32)}
<section class="mt-[34px] border-b-[3px] border-brand-primary pb-[30px]"><p class="whitespace-nowrap font-display text-[68px] font-black leading-none tracking-[-0.02em] text-brand-primary">{{ask.value}}</p><p class="mt-[12px] max-w-[80%] text-[17px] leading-[1.45] text-ink">{{ask.label}}</p></section>
<section class="mt-[30px] flex-1" data-keep-together><p class="mb-[8px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-aspect="16/9" class="mx-auto w-[88%] text-ink"></idem-chart></section>
<div class="grid grid-cols-2 gap-[28px] border-t border-rule py-[20px]"><p class="font-display text-[19px] leading-[1.35] text-ink">{{c1.readingKey}}</p><div class="flex flex-col gap-[10px] text-[12.5px] leading-[1.55] text-muted"><p>{{n0}}</p><p>{{n1}}</p></div></div>`),
  },
  {
    id: 'bp13', doc: 'business-plan', format: 'a4-portrait', role: 'opening', brand: 0, style: 'editorial',
    intent: 'vision: a pull quote set very large over prose in two columns, text-heavy page with a clear entry point',
    texts: {
      folio: F(13), kicker: 'Vision', title: 'Pourquoi Korhogo', quote: 'Un arbre de cajou donne deux fois : le fruit au producteur, la valeur à celui qui le transforme. Nous voulons que ce soit le même village.',
      'attr': 'Fondateur, atelier Noix d’Or',
      p0: 'Korhogo concentre plus d’un quart des plantations d’anacardiers du nord ivoirien. Les camions partent pourtant chaque année vers les ports avec des sacs de noix brutes, à un prix fixé ailleurs.',
      p1: 'L’atelier réunit trois métiers : l’achat groupé, la transformation et la vente directe. Chaque étape est mesurée, de la pesée au champ jusqu’au sac exporté, pour que le producteur connaisse sa part.',
      p2: 'En trois ans, nous voulons créer 85 emplois permanents, dont 60 % pour des femmes du quartier, et payer les producteurs 12 % au-dessus du prix de marché.',
      p3: 'Ce plan détaille le marché, l’organisation, les chiffres et les risques. Il a été relu par notre conseil agricole et par deux anciens cadres de banque.',
    },
    html: flow(`<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[6px] font-display text-[22px] font-bold text-ink">{{title}}</h2>
<blockquote class="mt-[40px] border-l-[6px] border-brand-primary pl-[28px]"><p class="font-display text-[40px] font-medium italic leading-[1.14] text-ink">{{quote}}</p><footer class="mt-[18px] text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-primary">{{attr}}</footer></blockquote>
<section class="mt-[48px] grid grid-cols-2 gap-x-[34px] gap-y-[18px] border-t border-rule pt-[28px] text-[14.5px] leading-[1.75] text-ink"><p>{{p0}}</p><p>{{p1}}</p><p>{{p2}}</p><p>{{p3}}</p></section>
<div class="h-[30px]"></div>`),
  },
  {
    id: 'bp14', doc: 'business-plan', format: 'a4-portrait', role: 'process', brand: 3,
    intent: 'operations: four steps of the supply chain on a horizontal band, each with a duration, details beneath',
    texts: {
      folio: F(14), kicker: 'Opérations', title: 'De la ferme à la cuisine en douze heures',
      's0.n': '04 h', 's0.t': 'Collecte', 's0.b': 'Trois véhicules passent chez 38 producteurs entre Allada et Abomey. Chaque lot est pesé et étiqueté.',
      's1.n': '07 h', 's1.t': 'Tri et contrôle', 's1.b': 'À l’entrepôt de Cotonou, les produits sont triés, contrôlés et mis en chambre fraîche à 6 °C.',
      's2.n': '09 h', 's2.t': 'Préparation', 's2.b': 'Les commandes de la veille sont composées par restaurant. Un bon de livraison suit chaque caisse.',
      's3.n': '12 h', 's3.t': 'Livraison', 's3.b': 'Quatre tournées desservent 120 restaurants. Le paiement se fait par mobile money à la livraison.',
      foot: 'Capacité actuelle : 2,4 tonnes par jour, extensible à 5 tonnes avec le deuxième entrepôt prévu en 2027.',
    },
    html: flow(`${flowHead('border-brand-primary', 32)}
<section class="mt-[44px] grid grid-cols-4 gap-[2px]">
  <div class="bg-brand-primary p-[18px] text-on-brand"><p class="font-display text-[34px] font-bold leading-none tabular-nums">{{s0.n}}</p><p class="mt-[10px] text-[14px] font-semibold uppercase tracking-[0.08em]">{{s0.t}}</p></div>
  <div class="bg-brand-primary p-[18px] text-on-brand"><p class="font-display text-[34px] font-bold leading-none tabular-nums">{{s1.n}}</p><p class="mt-[10px] text-[14px] font-semibold uppercase tracking-[0.08em]">{{s1.t}}</p></div>
  <div class="bg-brand-primary p-[18px] text-on-brand"><p class="font-display text-[34px] font-bold leading-none tabular-nums">{{s2.n}}</p><p class="mt-[10px] text-[14px] font-semibold uppercase tracking-[0.08em]">{{s2.t}}</p></div>
  <div class="bg-brand-secondary p-[18px] text-on-brand"><p class="font-display text-[34px] font-bold leading-none tabular-nums">{{s3.n}}</p><p class="mt-[10px] text-[14px] font-semibold uppercase tracking-[0.08em]">{{s3.t}}</p></div>
</section>
<section class="mt-[22px] grid grid-cols-4 gap-[18px] text-[13px] leading-[1.65] text-ink"><p>{{s0.b}}</p><p>{{s1.b}}</p><p>{{s2.b}}</p><p>{{s3.b}}</p></section>
<p class="mt-auto max-w-[75%] border-t-[3px] border-ink pt-[16px] pb-[36px] font-display text-[22px] leading-[1.35] text-ink">{{foot}}</p>`),
  },
  {
    id: 'bp15', doc: 'business-plan', format: 'a4-portrait', role: 'data', brand: 4,
    intent: 'marketing channels: a horizontal bar chart ranking channels, with one channel highlighted and three notes',
    texts: {
      folio: F(15), kicker: 'Go to market', title: 'Where our customers come from', 'c1.title': 'Share of orders by channel, first year (%)', 'c1.readingKey': 'Corporate gifting brings in a quarter of orders from just 12 clients.',
      'n0.t': 'Instagram', 'n0.b': 'Product photos by the makers themselves. Cost per order: UGX 4 200.',
      'n1.t': 'Boutiques', 'n1.b': 'Two shops in Kampala, one in Entebbe airport from March.',
      'n2.t': 'Corporate gifting', 'n2.b': 'Yearly contracts with hotels and banks, invoiced by batch.',
    },
    charts: { c1: { chartType: 'horizontalBar', title: 'x', labels: ['Instagram', 'Boutiques', 'Corporate gifting', 'Markets and fairs', 'Referrals'], series: [{ name: 'Orders', data: [34, 28, 24, 9, 5] }], readingKey: 'x', unit: '%' } },
    html: flow(`${flowHead('border-brand-primary', 32)}
<section class="mt-[30px]" data-keep-together><p class="mb-[8px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-type="horizontalBar" data-highlight="Corporate gifting" data-aspect="4/3" class="w-full text-ink"></idem-chart></section>
<p class="mt-[22px] max-w-[85%] border-l-[5px] border-brand-primary pl-[16px] font-display text-[22px] leading-[1.3] text-ink">{{c1.readingKey}}</p>
<section class="mt-auto grid grid-cols-3 gap-[22px] border-t border-rule pb-[34px] pt-[18px]"><div><p class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{n0.t}}</p><p class="mt-[6px] text-[13px] leading-[1.55] text-ink">{{n0.b}}</p></div><div><p class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{n1.t}}</p><p class="mt-[6px] text-[13px] leading-[1.55] text-ink">{{n1.b}}</p></div><div><p class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{n2.t}}</p><p class="mt-[6px] text-[13px] leading-[1.55] text-ink">{{n2.b}}</p></div></section>`),
  },
  {
    id: 'bp16', doc: 'business-plan', format: 'a4-portrait', role: 'visual', brand: 2, style: 'swiss',
    intent: 'impact: three oversized figures stacked with a rule between them, a short paragraph on each',
    texts: {
      folio: F(16), kicker: 'Impact', title: 'Ce que la Lopé gagne avec l’écolodge',
      'i0.v': '23', 'i0.t': 'emplois locaux', 'i0.b': 'Guides, cuisiniers, piroguiers et personnel d’accueil, tous recrutés dans les villages voisins.',
      'i1.v': '8 %', 'i1.t': 'des recettes reversés', 'i1.b': 'Un fonds villageois reçoit 8 % du chiffre d’affaires pour l’école et le dispensaire.',
      'i2.v': '0', 'i2.t': 'bouteille plastique', 'i2.b': 'Eau filtrée sur place, énergie solaire pour 90 % de la consommation.',
    },
    html: flow(`<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[8px] max-w-[85%] font-display text-[36px] font-bold leading-[1.06] text-ink">{{title}}</h2>
<div class="mt-[30px] flex flex-1 flex-col border-t-[3px] border-ink">
  <section class="grid flex-1 grid-cols-[250px_1fr] items-center gap-[24px] border-b border-rule"><p class="font-display text-[110px] font-bold leading-none tabular-nums text-brand-primary">{{i0.v}}</p><div><p class="text-[19px] font-bold text-ink">{{i0.t}}</p><p class="mt-[6px] text-[14px] leading-[1.6] text-muted">{{i0.b}}</p></div></section>
  <section class="grid flex-1 grid-cols-[250px_1fr] items-center gap-[24px] border-b border-rule"><p class="font-display text-[110px] font-bold leading-none tabular-nums text-brand-primary">{{i1.v}}</p><div><p class="text-[19px] font-bold text-ink">{{i1.t}}</p><p class="mt-[6px] text-[14px] leading-[1.6] text-muted">{{i1.b}}</p></div></section>
  <section class="grid flex-1 grid-cols-[250px_1fr] items-center gap-[24px] border-b border-rule"><p class="font-display text-[110px] font-bold leading-none tabular-nums text-brand-primary">{{i2.v}}</p><div><p class="text-[19px] font-bold text-ink">{{i2.t}}</p><p class="mt-[6px] text-[14px] leading-[1.6] text-muted">{{i2.b}}</p></div></section>
</div>
<div class="h-[26px]"></div>`),
  },
  {
    id: 'bp17', doc: 'business-plan', format: 'a4-portrait', role: 'data', brand: 6,
    intent: 'break-even: a full-width line chart, with the break-even month called out in a band under it',
    texts: {
      folio: F(17), kicker: 'Break-even', title: 'Cumulative cash turns positive in month 19', 'c1.title': 'Cumulative cash position, million ZMW', 'c1.readingKey': 'The lowest point is −4.1 million in month 9. The funding covers it with a margin of 1.4 million.',
      'k.v': 'Month 19', 'k.l': 'cumulative break-even', 'k2.v': '−4.1 M', 'k2.l': 'lowest cash position', 'k3.v': '1.4 M', 'k3.l': 'safety margin',
    },
    charts: { c1: { chartType: 'line', title: 'x', labels: ['M1', 'M3', 'M6', 'M9', 'M12', 'M15', 'M18', 'M21', 'M24'], series: [{ name: 'Cash', data: [-0.6, -1.9, -3.4, -4.1, -3.6, -2.4, -0.7, 0.9, 2.6] }], readingKey: 'x', unit: 'M' } },
    html: flow(`${flowHead('border-brand-primary', 32)}
<section class="mt-[28px]" data-keep-together><p class="mb-[8px] text-[13px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-aspect="16/10" class="w-full text-ink"></idem-chart></section>
<section class="mt-auto grid grid-cols-3 border-y border-rule"><div class="border-r border-rule py-[22px] pr-[16px]"><p class="whitespace-nowrap font-display text-[34px] font-bold leading-none tabular-nums text-brand-primary">{{k.v}}</p><p class="mt-[8px] text-[12px] text-muted">{{k.l}}</p></div><div class="border-r border-rule px-[18px] py-[22px]"><p class="whitespace-nowrap font-display text-[34px] font-bold leading-none tabular-nums text-ink">{{k2.v}}</p><p class="mt-[8px] text-[12px] text-muted">{{k2.l}}</p></div><div class="py-[22px] pl-[18px]"><p class="whitespace-nowrap font-display text-[34px] font-bold leading-none tabular-nums text-ink">{{k3.v}}</p><p class="mt-[8px] text-[12px] text-muted">{{k3.l}}</p></div></section>
<p class="mb-[34px] mt-[22px] max-w-[85%] text-[16px] leading-[1.6] text-ink">{{c1.readingKey}}</p>`),
  },
  {
    id: 'bp18', doc: 'business-plan', format: 'a4-portrait', role: 'showcase', brand: 8,
    intent: 'target customer: a persona profile as a two-column definition list, with a large name and a one-line need',
    texts: {
      folio: F(18), kicker: 'Clients', title: 'Notre élève type', name: 'Awa, 19 ans', need: 'Apprendre un métier du numérique sans quitter Thiès ni payer un cursus de Dakar.',
      'd0.k': 'Situation', 'd0.v': 'Bachelière, vit chez ses parents, travaille deux jours par semaine à la boutique familiale.',
      'd1.k': 'Équipement', 'd1.v': 'Un smartphone Android partagé, une connexion par forfait de données.',
      'd2.k': 'Frein principal', 'd2.v': 'Le prix des formations privées : 45 000 F CFA par mois en moyenne.',
      'd3.k': 'Ce qu’elle attend', 'd3.v': 'Un diplôme reconnu, un stage garanti, des cours le soir.',
      'd4.k': 'Comment elle nous trouve', 'd4.v': 'WhatsApp, une grande sœur passée par le campus, la radio locale.',
      'd5.k': 'Ce qu’elle paie', 'd5.v': '15 000 F CFA par mois, payables par mobile money.',
    },
    html: flow(`<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[6px] font-display text-[20px] font-bold text-ink">{{title}}</h2>
<div class="mt-[30px] bg-brand-primary p-[36px] text-on-brand"><p class="font-display text-[54px] font-bold leading-none">{{name}}</p><p class="mt-[16px] max-w-[80%] text-[20px] leading-[1.4]">{{need}}</p></div>
<dl class="mt-[26px] flex flex-1 flex-col text-[14px] leading-[1.6]">
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d0.k}}</dt><dd class="text-ink">{{d0.v}}</dd></div>
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d1.k}}</dt><dd class="text-ink">{{d1.v}}</dd></div>
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d2.k}}</dt><dd class="text-ink">{{d2.v}}</dd></div>
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d3.k}}</dt><dd class="text-ink">{{d3.v}}</dd></div>
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d4.k}}</dt><dd class="text-ink">{{d4.v}}</dd></div>
  <div class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[20px] border-b border-rule"><dt class="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{d5.k}}</dt><dd class="text-ink">{{d5.v}}</dd></div>
</dl>
<div class="h-[22px]"></div>`),
  },
  {
    id: 'bp19', doc: 'business-plan', format: 'a4-portrait', role: 'appendix', brand: 1,
    intent: 'assumptions and sources: a dense but orderly page of numbered notes in two columns, small type kept readable',
    texts: {
      folio: F(19), kicker: 'Appendix', title: 'Assumptions and sources', lede: 'Every figure in this plan rests on one of the notes below.',
      'a0.n': '01', 'a0.t': 'Adoption', 'a0.b': 'Cooperatives adopt one sensor per 15 members after a one-season trial. Observed in 3 pilot cooperatives, 2025.',
      'a1.n': '02', 'a1.t': 'Price', 'a1.b': 'Sensor kit at 85,000 RWF, or a seasonal subscription of 12,000 RWF per member.',
      'a2.n': '03', 'a2.t': 'Yield gain', 'a2.b': 'A 14 % average yield gain on maize and beans, measured against untested neighbour plots.',
      'a3.n': '04', 'a3.t': 'Churn', 'a3.b': 'Seven per cent of subscribers leave each year. Source: pilot data, 38 months.',
      'a4.n': '05', 'a4.t': 'Exchange rate', 'a4.b': 'Budget at 1,400 RWF per USD with a yearly 4 % depreciation.',
      'a5.n': '06', 'a5.t': 'Staffing', 'a5.b': 'One field technician per 400 cooperative members, paid 310,000 RWF per month.',
      'a6.n': '07', 'a6.t': 'Sources', 'a6.b': 'RAB Rwanda Agriculture Board 2024; FAO soil bulletin 2023; NISR household survey 2023.',
      'a7.n': '08', 'a7.t': 'Review', 'a7.b': 'Figures reviewed by an independent accountant in January 2026.',
    },
    html: flow(`${flowHead('border-brand-primary', 30)}
<p class="mt-[14px] text-[14px] text-muted">{{lede}}</p>
<ol class="mt-[26px] grid flex-1 grid-cols-2 content-start gap-x-[38px] text-[12.5px] leading-[1.6] text-ink">
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a0.n}}</span><div><p class="font-semibold">{{a0.t}}</p><p class="mt-[3px] text-muted">{{a0.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a4.n}}</span><div><p class="font-semibold">{{a4.t}}</p><p class="mt-[3px] text-muted">{{a4.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a1.n}}</span><div><p class="font-semibold">{{a1.t}}</p><p class="mt-[3px] text-muted">{{a1.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a5.n}}</span><div><p class="font-semibold">{{a5.t}}</p><p class="mt-[3px] text-muted">{{a5.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a2.n}}</span><div><p class="font-semibold">{{a2.t}}</p><p class="mt-[3px] text-muted">{{a2.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a6.n}}</span><div><p class="font-semibold">{{a6.t}}</p><p class="mt-[3px] text-muted">{{a6.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a3.n}}</span><div><p class="font-semibold">{{a3.t}}</p><p class="mt-[3px] text-muted">{{a3.b}}</p></div></li>
  <li class="grid grid-cols-[34px_1fr] gap-[10px] border-t border-rule py-[18px]"><span class="font-display text-[18px] font-bold tabular-nums text-brand-primary">{{a7.n}}</span><div><p class="font-semibold">{{a7.t}}</p><p class="mt-[3px] text-muted">{{a7.b}}</p></div></li>
</ol>
<div class="h-[20px]"></div>`),
  },
  {
    id: 'bp20', doc: 'business-plan', format: 'a4-portrait', role: 'opening', brand: 5, style: 'editorial',
    intent: 'table of contents: large numbered parts with page numbers right-aligned on dotted leaders',
    texts: {
      folio: F(20), kicker: 'Sommaire', title: 'Brazza Mode — plan d’affaires',
      'p0.n': '1', 'p0.t': 'Synthèse', 'p0.p': '03', 'p1.n': '2', 'p1.t': 'Le marché de la couture sur mesure', 'p1.p': '05', 'p2.n': '3', 'p2.t': 'Notre offre et notre atelier', 'p2.p': '08',
      'p3.n': '4', 'p3.t': 'Équipe et organisation', 'p3.p': '11', 'p4.n': '5', 'p4.t': 'Plan commercial', 'p4.p': '13', 'p5.n': '6', 'p5.t': 'Plan financier', 'p5.p': '16', 'p6.n': '7', 'p6.t': 'Risques et annexes', 'p6.p': '21',
    },
    html: flow(`<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[12px] font-display text-[52px] font-bold uppercase leading-[0.98] text-ink">{{title}}</h2>
<ol class="mt-[44px] flex flex-1 flex-col border-t-[3px] border-brand-primary">
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p0.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p0.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p0.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p1.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p1.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p1.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p2.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p2.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p2.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p3.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p3.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p3.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p4.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p4.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p4.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p5.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p5.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p5.p}}</span></li>
  <li class="flex flex-1 items-center gap-[20px] border-b border-rule"><span class="w-[40px] font-display text-[30px] font-bold tabular-nums text-brand-primary">{{p6.n}}</span><span class="flex-1 font-display text-[24px] text-ink">{{p6.t}}</span><span class="font-display text-[22px] tabular-nums text-muted">{{p6.p}}</span></li>
</ol>
<div class="h-[26px]"></div>`),
  },
];
