import type { CorpusPage } from './types';

/** Business plan — pages A4 (20 au total, 1 à 10 ici). Textes de démonstration dans la langue de la marque. */
export const PAGES: CorpusPage[] = [
  {
    id: 'bp01', doc: 'business-plan', format: 'a4-portrait', role: 'opening', brand: 0, style: 'editorial',
    intent: 'executive summary: a lede, four key figures in a ruled row, then two columns of prose',
    texts: { folio: 'Business plan 2026 · 01',
      kicker: 'Synthèse', closing: 'Chaque tonne décortiquée à Korhogo laisse 40 % de valeur en plus dans la région.', title: 'Un atelier qui transforme le cajou là où il pousse', lede: 'Noix d’Or achète la récolte de 420 producteurs de Korhogo et la vend décortiquée, calibrée et tracée à des acheteurs européens.',
      'm0.value': '420', 'm0.label': 'producteurs partenaires', 'm1.value': '1 850 t', 'm1.label': 'noix brutes traitées en 2027', 'm2.value': '31 %', 'm2.label': 'marge brute visée', 'm3.value': '36 mois', 'm3.label': 'retour sur investissement',
      'p0': 'La Côte d’Ivoire exporte l’essentiel de son cajou à l’état brut. La valeur se crée ailleurs : décorticage, calibrage, conditionnement. Notre atelier garde cette valeur à Korhogo.',
      'p1': 'Le financement demandé couvre la ligne de décorticage, le séchoir solaire et le fonds de roulement de la première campagne. Les comptes sont tenus selon le SYSCOHADA.',
      'p2': 'Trois contrats-cadres sont déjà signés avec des importateurs de Hambourg et de Rotterdam, pour 62 % de la production prévue la première année.',
    },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[12px]">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
  <h2 class="mt-[8px] max-w-[88%] font-display text-[34px] font-bold leading-[1.08] text-ink">{{title}}</h2>
</header>
<p class="mt-[18px] max-w-[88%] font-display text-[18px] leading-[1.5] text-ink">{{lede}}</p>
<section class="mt-[28px] grid grid-cols-4 border-y border-rule">
  <div class="border-r border-rule py-[26px] pr-[12px]"><p class="font-display whitespace-nowrap text-[34px] font-bold leading-none tabular-nums text-brand-primary">{{m0.value}}</p><p class="mt-[8px] text-[11px] leading-[1.35] text-muted">{{m0.label}}</p></div>
  <div class="border-r border-rule px-[14px] py-[26px]"><p class="font-display whitespace-nowrap text-[34px] font-bold leading-none tabular-nums text-brand-primary">{{m1.value}}</p><p class="mt-[8px] text-[11px] leading-[1.35] text-muted">{{m1.label}}</p></div>
  <div class="border-r border-rule px-[14px] py-[26px]"><p class="font-display whitespace-nowrap text-[34px] font-bold leading-none tabular-nums text-brand-primary">{{m2.value}}</p><p class="mt-[8px] text-[11px] leading-[1.35] text-muted">{{m2.label}}</p></div>
  <div class="py-[26px] pl-[14px]"><p class="font-display whitespace-nowrap text-[34px] font-bold leading-none tabular-nums text-brand-primary">{{m3.value}}</p><p class="mt-[8px] text-[11px] leading-[1.35] text-muted">{{m3.label}}</p></div>
</section>
<section class="mt-[44px] grid grid-cols-2 gap-x-[32px] gap-y-[18px] border-b border-rule pb-[40px] text-[15px] leading-[1.75] text-ink">
  <p>{{p0}}</p><p>{{p1}}</p>
  <p class="col-span-2 max-w-[75%]">{{p2}}</p>
</section>
<p class="mt-auto max-w-[70%] pb-[30px] font-display text-[26px] font-bold leading-[1.2] text-brand-primary">{{closing}}</p>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp02', doc: 'business-plan', format: 'a4-portrait', role: 'visual', brand: 1,
    intent: 'the problem: one strong statement, then three numbered pieces of evidence on a ruled list',
    texts: { folio: 'Business plan 2026 · 02',
      kicker: 'The problem', title: 'Farmers fertilise blind, and the soil pays for it', lede: 'Without a reading of their soil, smallholders in Musanze apply the same fertiliser every season.',
      'e0.value': '40 %', 'e0.title': 'of fertiliser is wasted', 'e0.body': 'Nutrients leach away when the dose does not match the plot. A cooperative of 300 members loses about 18 million RWF a year.',
      'e1.value': '1 in 3', 'e1.title': 'plots is over-acidified', 'e1.body': 'Acid soil locks phosphorus. Yields on tested plots in Musanze fall 25 % below their potential.',
      'e2.value': '9 weeks', 'e2.title': 'to get a lab result', 'e2.body': 'A sample sent to Kigali returns after the planting window has closed. The advice arrives too late to use.',
    },
    html: `<div class="flex min-h-[273mm] flex-col">
<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[10px] max-w-[92%] font-display text-[44px] font-bold leading-[1.04] text-ink">{{title}}</h2>
<p class="mt-[14px] max-w-[75%] text-[15px] leading-[1.55] text-muted">{{lede}}</p>
<ol class="mt-[34px] flex flex-1 flex-col border-t-[3px] border-ink">
  <li class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[22px] border-b border-rule"><p class="font-display text-[52px] tabular-nums font-bold leading-none text-brand-primary">{{e0.value}}</p><div><p class="text-[16px] font-semibold text-ink">{{e0.title}}</p><p class="mt-[6px] text-[14.5px] leading-[1.65] text-muted">{{e0.body}}</p></div></li>
  <li class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[22px] border-b border-rule"><p class="font-display text-[52px] tabular-nums font-bold leading-none text-brand-primary">{{e1.value}}</p><div><p class="text-[16px] font-semibold text-ink">{{e1.title}}</p><p class="mt-[6px] text-[14.5px] leading-[1.65] text-muted">{{e1.body}}</p></div></li>
  <li class="grid flex-1 grid-cols-[190px_1fr] items-center gap-[22px] border-b border-rule"><p class="font-display text-[52px] tabular-nums font-bold leading-none text-brand-primary">{{e2.value}}</p><div><p class="text-[16px] font-semibold text-ink">{{e2.title}}</p><p class="mt-[6px] text-[14.5px] leading-[1.65] text-muted">{{e2.body}}</p></div></li>
</ol>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp03', doc: 'business-plan', format: 'a4-portrait', role: 'data', brand: 2,
    intent: 'market size: a large bar chart with its reading key in a side column',
    texts: { folio: 'Business plan 2026 · 03',
      kicker: 'Marché', title: 'Le tourisme de nature croît de 11 % par an au Gabon', lede: 'Les arrivées dans les parcs nationaux ont doublé en cinq ans.',
      'c1.title': 'Visiteurs des parcs nationaux (milliers)', 'c1.readingKey': 'La Lopé reçoit un visiteur sur cinq et reste sous-équipée en hébergement.',
      'n0.title': 'Notre part', 'n0.body': 'Avec 14 chambres, l’écolodge vise 9 % des nuitées de la Lopé dès la troisième année.',
      'n1.title': 'La source', 'n1.body': 'Agence nationale des parcs nationaux, rapports annuels 2019 à 2024.',
    },
    charts: { c1: { chartType: 'bar', title: 'Visiteurs', labels: ['2020', '2021', '2022', '2023', '2024'], series: [{ name: 'Visiteurs', data: [38, 52, 61, 74, 86] }], readingKey: 'x' } },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[10px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2></header>
<p class="mt-[14px] text-[14px] text-muted">{{lede}}</p>
<section class="mt-[22px] grid grid-cols-[1fr_190px] gap-[26px]" data-keep-together>
  <div><p class="mb-[8px] text-[12px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-aspect="1/1" class="w-full text-ink"></idem-chart></div>
  <aside class="flex flex-col justify-end gap-[18px] border-l border-rule pl-[16px]">
    <div><p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-primary">{{n0.title}}</p><p class="mt-[4px] text-[13px] leading-[1.6] text-ink">{{n0.body}}</p></div>
    <div><p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{{n1.title}}</p><p class="mt-[4px] text-[11px] leading-[1.5] text-muted">{{n1.body}}</p></div>
  </aside>
</section>
<p class="mt-[18px] border-l-[4px] border-brand-primary pl-[14px] font-display text-[17px] leading-[1.4] text-ink">{{c1.readingKey}}</p>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp04', doc: 'business-plan', format: 'a4-portrait', role: 'comparison', brand: 3,
    intent: 'competition: a comparison table that must read clearly, with one takeaway line above it',
    texts: { folio: 'Business plan 2026 · 04',
      kicker: 'Concurrence', title: 'Nous sommes les seuls à livrer frais et à prix de gros', lede: 'Trois acteurs servent aujourd’hui les restaurants de Cotonou. Aucun ne combine ces trois atouts.',
      take: 'Notre avantage tient à la logistique : une tournée par jour, directement depuis les producteurs.',
    },
    tables: { t1: { headers: ['Critère', 'Cotonou Saveurs', 'Grossistes du marché', 'Importateurs'], rows: [['Produits locaux frais', 'Oui', 'Oui', 'Non'], ['Prix de gros', 'Oui', 'Variable', 'Oui'], ['Livraison quotidienne', 'Oui', 'Non', 'Non'], ['Traçabilité du producteur', 'Oui', 'Non', 'Partielle'], ['Délai de commande', '12 h', '48 h', '7 jours']] } },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[10px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2></header>
<p class="mt-[14px] max-w-[85%] text-[14px] leading-[1.6] text-muted">{{lede}}</p>
<idem-table data-block="t1" class="mt-[24px] w-full text-[15px] [&_th]:bg-brand-primary [&_th]:text-on-brand [&_th]:text-left [&_th]:p-[16px] [&_td]:p-[18px] [&_td]:border-b [&_td]:border-rule [&_td:nth-child(2)]:font-semibold [&_td:nth-child(2)]:text-brand-primary" data-keep-together></idem-table>
<p class="mt-auto max-w-[80%] pb-[34px] font-display text-[26px] leading-[1.35] text-ink">{{take}}</p>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp05', doc: 'business-plan', format: 'a4-portrait', role: 'visual', brand: 4, style: 'swiss',
    intent: 'business model: three revenue streams as columns, each with its share of income',
    texts: { folio: 'Business plan 2026 · 05',
      kicker: 'Business model', title: 'Three streams, one workshop', lede: 'Revenue comes from products, commissions and training. Each stream uses the same craftspeople.',
      's0.value': '62 %', 's0.title': 'Own collection', 's0.body': 'Bark-cloth bags and belts sold online and in two boutiques in Kampala.',
      's1.value': '25 %', 's1.title': 'Corporate orders', 's1.body': 'Branded gifts for hotels, banks and NGOs, made to order in batches of 50 to 500.',
      's2.value': '13 %', 's2.title': 'Training', 's2.body': 'Paid workshops for young makers, with a placement in the workshop after three months.',
      note: 'Shares of 2027 forecast revenue: UGX 412 million.',
    },
    html: `<div class="flex min-h-[273mm] flex-col">
<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[8px] max-w-[80%] font-display text-[40px] font-bold leading-[1.05] text-ink">{{title}}</h2>
<p class="mt-[12px] max-w-[70%] text-[14px] leading-[1.6] text-muted">{{lede}}</p>
<section class="mt-[56px] grid grid-cols-3 gap-[20px]" data-keep-together>
  <div class="border-t-[6px] border-brand-primary pt-[14px]"><p class="font-display text-[64px] tabular-nums font-bold leading-none text-brand-primary">{{s0.value}}</p><p class="mt-[14px] text-[15px] font-semibold text-ink">{{s0.title}}</p><p class="mt-[6px] text-[14px] leading-[1.65] text-muted">{{s0.body}}</p></div>
  <div class="border-t-[6px] border-brand-secondary pt-[14px]"><p class="font-display text-[64px] tabular-nums font-bold leading-none text-ink">{{s1.value}}</p><p class="mt-[14px] text-[15px] font-semibold text-ink">{{s1.title}}</p><p class="mt-[6px] text-[14px] leading-[1.65] text-muted">{{s1.body}}</p></div>
  <div class="border-t-[6px] border-brand-accent pt-[14px]"><p class="font-display text-[64px] tabular-nums font-bold leading-none text-ink">{{s2.value}}</p><p class="mt-[14px] text-[15px] font-semibold text-ink">{{s2.title}}</p><p class="mt-[6px] text-[14px] leading-[1.65] text-muted">{{s2.body}}</p></div>
</section>
<p class="mt-[30px] border-t border-rule pt-[10px] text-[11px] text-muted">{{note}}</p>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp06', doc: 'business-plan', format: 'a4-portrait', role: 'showcase', brand: 5,
    intent: 'team: four people in a two-by-two grid with role and short background, text only',
    texts: { folio: 'Business plan 2026 · 06',
      kicker: 'Équipe', title: 'Quatre métiers, une même maison', lede: 'Les fondateurs travaillent ensemble depuis sept ans.',
      'q0.name': 'Mireille Okemba', 'q0.role': 'Directrice générale', 'q0.body': 'Quinze ans dans la couture de luxe à Brazzaville et Paris. Elle dirige la création et les clients.',
      'q1.name': 'Davy Ngoma', 'q1.role': 'Maître tailleur', 'q1.body': 'Forme les apprentis. A habillé plus de 2 000 clients sur mesure depuis 2012.',
      'q2.name': 'Prisca Mabiala', 'q2.role': 'Finances et gestion', 'q2.body': 'Experte-comptable, ancienne d’une banque de la place. Tient les comptes selon le SYSCOHADA.',
      'q3.name': 'Éric Samba', 'q3.role': 'Commercial et réseaux', 'q3.body': 'Développe les ventes aux entreprises et anime la boutique en ligne.',
    },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[10px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[32px] font-bold leading-[1.08] text-ink">{{title}}</h2></header>
<p class="mt-[14px] text-[14px] text-muted">{{lede}}</p>
<section class="mt-[44px] grid flex-1 grid-cols-2 content-start gap-x-[34px] gap-y-[70px]" data-keep-together>
  <div class="border-l-[4px] border-brand-primary pl-[16px]"><p class="font-display text-[22px] font-bold text-ink">{{q0.name}}</p><p class="mt-[2px] text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{q0.role}}</p><p class="mt-[8px] text-[15px] leading-[1.65] text-ink">{{q0.body}}</p></div>
  <div class="border-l-[4px] border-brand-primary pl-[16px]"><p class="font-display text-[22px] font-bold text-ink">{{q1.name}}</p><p class="mt-[2px] text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{q1.role}}</p><p class="mt-[8px] text-[15px] leading-[1.65] text-ink">{{q1.body}}</p></div>
  <div class="border-l-[4px] border-brand-primary pl-[16px]"><p class="font-display text-[22px] font-bold text-ink">{{q2.name}}</p><p class="mt-[2px] text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{q2.role}}</p><p class="mt-[8px] text-[15px] leading-[1.65] text-ink">{{q2.body}}</p></div>
  <div class="border-l-[4px] border-brand-primary pl-[16px]"><p class="font-display text-[22px] font-bold text-ink">{{q3.name}}</p><p class="mt-[2px] text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{q3.role}}</p><p class="mt-[8px] text-[15px] leading-[1.65] text-ink">{{q3.body}}</p></div>
</section>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp07', doc: 'business-plan', format: 'a4-portrait', role: 'data', brand: 6,
    intent: 'financial plan: a three-year table of indicators, one highlighted result line, a short reading',
    texts: { folio: 'Business plan 2026 · 07', kicker: 'Financial plan', title: 'Profitable from the second year', lede: 'Figures in million ZMW. The model reaches break-even in month 19.', read: 'Gross margin rises as the motorbike fleet fills: fixed costs are spread over more deliveries.' },
    tables: { t1: { headers: ['Indicator', '2026', '2027', '2028'], rows: [['Revenue', '14.2', '33.8', '61.5'], ['Delivery costs', '9.6', '19.9', '33.2'], ['Gross margin', '4.6', '13.9', '28.3'], ['Staff and overheads', '7.1', '10.4', '15.0'], ['Net result', '-2.5', '3.5', '13.3']] } },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="flex items-end justify-between border-b-[2px] border-brand-primary pb-[10px]"><div><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2></div></header>
<p class="mt-[14px] text-[13px] text-muted">{{lede}}</p>
<idem-table data-block="t1" class="mt-[22px] w-full text-[16px] tabular-nums [&_th]:border-b-[2px] [&_th]:border-ink [&_th]:p-[10px] [&_th]:text-right [&_th:first-child]:text-left [&_td]:border-b [&_td]:border-rule [&_td]:p-[20px] [&_td]:text-right [&_td:first-child]:text-left [&_tr:last-child]:bg-brand-soft [&_tr:last-child]:font-bold [&_tr:last-child_td]:text-brand-primary" data-keep-together></idem-table>
<p class="mt-auto max-w-[78%] border-l-[4px] border-brand-primary pb-[4px] pl-[16px] text-[17px] leading-[1.6] text-ink">{{read}}</p>
<div class="h-[30px]"></div>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp08', doc: 'business-plan', format: 'a4-portrait', role: 'data', brand: 7,
    intent: 'revenue against costs: a grouped bar chart across the page width, key message in a band beneath',
    texts: { folio: 'Business plan 2026 · 08', kicker: 'Forecast', title: 'Revenue overtakes costs in year two', 'c1.title': 'Revenue and costs, million SLE', 'c1.readingKey': 'From 2027 each new savings group adds more revenue than cost: USSD sessions have almost no marginal cost.', src: 'Basis: 1 800 groups in 2026, 4 200 in 2027, 7 500 in 2028; average fee of 6 SLE per member per month.' },
    charts: { c1: { chartType: 'groupedBar', title: 'x', labels: ['2026', '2027', '2028'], series: [{ name: 'Revenue', data: [4.2, 11.6, 24.8] }, { name: 'Costs', data: [6.1, 9.4, 14.9] }], readingKey: 'x', unit: 'M' } },
    html: `<div class="flex min-h-[273mm] flex-col">
<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p>
<h2 class="mt-[8px] font-display text-[34px] font-bold leading-[1.08] text-ink">{{title}}</h2>
<div class="mt-[26px]" data-keep-together><p class="mb-[8px] text-[12px] font-semibold text-ink">{{c1.title}}</p><idem-chart data-block="c1" data-aspect="4/3" class="w-full text-ink"></idem-chart></div>
<div class="mt-[24px] bg-brand-primary px-[22px] py-[18px] text-on-brand"><p class="font-display text-[19px] leading-[1.4]">{{c1.readingKey}}</p></div>
<p class="mt-[14px] text-[11px] leading-[1.5] text-muted">{{src}}</p>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp09', doc: 'business-plan', format: 'a4-portrait', role: 'process', brand: 8,
    intent: 'roadmap: a vertical timeline of five milestones with dates in a left column',
    texts: { folio: 'Business plan 2026 · 09',
      kicker: 'Feuille de route', title: 'Cinq jalons jusqu’à 5 000 élèves',
      'k0.date': 'T1 2026', 'k0.title': 'Ouverture du campus de Thiès', 'k0.body': 'Trente places, deux formateurs, première promotion en octobre.',
      'k1.date': 'T3 2026', 'k1.title': 'Premiers stages en entreprise', 'k1.body': 'Accord avec huit entreprises de Dakar et de Thiès.',
      'k2.date': 'T1 2027', 'k2.title': 'Plateforme en ligne', 'k2.body': 'Cours en wolof et en français, accessibles sur téléphone.',
      'k3.date': 'T4 2027', 'k3.title': 'Campus de Saint-Louis', 'k3.body': 'Même programme, dirigé par un ancien élève.',
      'k4.date': '2028', 'k4.title': '5 000 élèves formés', 'k4.body': 'Dont 40 % de jeunes femmes, objectif inscrit dans nos statuts.',
    },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[10px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[32px] font-bold leading-[1.08] text-ink">{{title}}</h2></header>
<ol class="mt-[28px] flex flex-1 flex-col justify-between border-l-[2px] border-rule pb-[30px]">
  <li class="relative grid grid-cols-[120px_1fr] gap-[18px] pb-[46px] pl-[24px]"><span class="absolute -left-[7px] top-[4px] size-[12px] rounded-full bg-brand-primary"></span><p class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-primary">{{k0.date}}</p><div><p class="text-[18px] font-semibold text-ink">{{k0.title}}</p><p class="mt-[4px] text-[14.5px] leading-[1.6] text-muted">{{k0.body}}</p></div></li>
  <li class="relative grid grid-cols-[120px_1fr] gap-[18px] pb-[46px] pl-[24px]"><span class="absolute -left-[7px] top-[4px] size-[12px] rounded-full bg-brand-primary"></span><p class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-primary">{{k1.date}}</p><div><p class="text-[18px] font-semibold text-ink">{{k1.title}}</p><p class="mt-[4px] text-[14.5px] leading-[1.6] text-muted">{{k1.body}}</p></div></li>
  <li class="relative grid grid-cols-[120px_1fr] gap-[18px] pb-[46px] pl-[24px]"><span class="absolute -left-[7px] top-[4px] size-[12px] rounded-full bg-brand-primary"></span><p class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-primary">{{k2.date}}</p><div><p class="text-[18px] font-semibold text-ink">{{k2.title}}</p><p class="mt-[4px] text-[14.5px] leading-[1.6] text-muted">{{k2.body}}</p></div></li>
  <li class="relative grid grid-cols-[120px_1fr] gap-[18px] pb-[46px] pl-[24px]"><span class="absolute -left-[7px] top-[4px] size-[12px] rounded-full bg-brand-primary"></span><p class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-primary">{{k3.date}}</p><div><p class="text-[18px] font-semibold text-ink">{{k3.title}}</p><p class="mt-[4px] text-[14.5px] leading-[1.6] text-muted">{{k3.body}}</p></div></li>
  <li class="relative grid grid-cols-[120px_1fr] gap-[18px] pl-[24px]"><span class="absolute -left-[9px] top-[2px] size-[16px] rounded-full bg-brand-accent"></span><p class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-primary">{{k4.date}}</p><div><p class="font-display text-[20px] font-bold text-ink">{{k4.title}}</p><p class="mt-[4px] text-[14.5px] leading-[1.6] text-muted">{{k4.body}}</p></div></li>
</ol>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
  {
    id: 'bp10', doc: 'business-plan', format: 'a4-portrait', role: 'comparison', brand: 9,
    intent: 'risks: a table of risk, likelihood and mitigation with a short framing sentence',
    texts: { folio: 'Business plan 2026 · 10', kicker: 'Risques', title: 'Les risques identifiés et nos réponses', lede: 'Quatre risques pèsent sur la coopérative. Chacun a un responsable et une mesure.' },
    tables: { t1: { headers: ['Risque', 'Probabilité', 'Réponse'], rows: [['Baisse du cours du café arabica', 'Moyenne', 'Contrats à prix plancher avec deux torréfacteurs'], ['Récolte réduite par la sécheresse', 'Faible', 'Irrigation goutte à goutte sur 12 hectares'], ['Retard de transport vers Douala', 'Élevée', 'Stock tampon de trois semaines à Bafoussam'], ['Départ d’un cadre clé', 'Faible', 'Binômes sur chaque fonction, primes sur trois ans']] } },
    html: `<div class="flex min-h-[273mm] flex-col">
<header class="border-b-[2px] border-brand-primary pb-[10px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2></header>
<p class="mt-[14px] max-w-[80%] text-[14px] leading-[1.6] text-muted">{{lede}}</p>
<idem-table data-block="t1" class="mt-[24px] w-full text-[15px] [&_th]:border-b-[2px] [&_th]:border-brand-primary [&_th]:p-[14px] [&_th]:text-left [&_th]:text-brand-primary [&_td]:border-b [&_td]:border-rule [&_td]:p-[22px] [&_td]:align-top [&_td:first-child]:font-semibold" data-keep-together></idem-table>
<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>
</div>`,
  },
];
