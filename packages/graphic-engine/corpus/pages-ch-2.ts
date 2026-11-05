import type { CorpusPage } from './types';
import { charter, folio } from './kit';

const F = (n: number) => folio('Brand book', n);

/** Charte graphique — pages A4 fixes (11 à 20). */
export const PAGES: CorpusPage[] = [
  {
    id: 'ch11', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 0,
    intent: 'logo clear space and minimum size: the logo inside a dashed exclusion frame, and the smallest allowed size shown beneath',
    texts: { folio: F(11), kicker: 'Logo', brandline: 'Charte graphique', title: 'Zone de protection', body: 'Laissez autour du logo un espace égal à la hauteur de sa lettre capitale. Aucun texte, aucune image ne s’y pose.', 'min.t': 'Taille minimale', 'min.b': '24 px à l’écran, 12 mm à l’impression.' },
    html: charter(`<h2 class="mt-[26px] font-display text-[34px] font-bold text-ink">{{title}}</h2><p class="mt-[10px] max-w-[80%] text-[14px] leading-[1.6] text-muted">{{body}}</p>
<div class="my-[26px] flex flex-1 items-center justify-center bg-sunken"><div class="border-[2px] border-dashed border-brand-primary p-[60px]"><idem-logo variant="primary" class="h-[120px]"></idem-logo></div></div>
<div class="mb-[24px] flex items-center gap-[26px] border-t-[2px] border-ink pt-[16px]"><idem-logo variant="primary" class="h-[24px]"></idem-logo><div><p class="text-[14px] font-bold text-ink">{{min.t}}</p><p class="text-[13px] text-muted">{{min.b}}</p></div></div>`),
  },
  {
    id: 'ch12', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 1,
    intent: 'logo versions: the full logo and the icon alone in two large panels with when-to-use captions',
    texts: { folio: F(12), kicker: 'Logo', brandline: 'Brand guidelines', title: 'Two versions, two uses', 'a.t': 'Full logo', 'a.b': 'Documents, website header, presentations and signage.', 'b.t': 'Icon', 'b.b': 'Social profile pictures, app icon, stamps and small spaces.' },
    html: charter(`<h2 class="mt-[26px] font-display text-[34px] font-bold text-ink">{{title}}</h2>
<div class="my-[24px] grid flex-1 grid-rows-2 gap-[14px]"><div class="grid grid-cols-[1fr_230px] border border-rule"><div class="flex items-center justify-center"><idem-logo variant="primary" class="h-[110px]"></idem-logo></div><div class="flex flex-col justify-end border-l border-rule p-[18px]"><p class="text-[16px] font-bold text-ink">{{a.t}}</p><p class="mt-[6px] text-[13px] leading-[1.5] text-muted">{{a.b}}</p></div></div>
<div class="grid grid-cols-[1fr_230px] bg-brand-soft"><div class="flex items-center justify-center"><idem-logo variant="icon" class="h-[130px]"></idem-logo></div><div class="flex flex-col justify-end border-l border-rule p-[18px] text-ink"><p class="text-[16px] font-bold">{{b.t}}</p><p class="mt-[6px] text-[13px] leading-[1.5]">{{b.b}}</p></div></div></div>`),
  },
  {
    id: 'ch13', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 6,
    intent: 'accessible colour pairs: four rows, each a text sample on its ground with the contrast ratio and a pass label',
    texts: { folio: F(13), kicker: 'Colours', brandline: 'Brand guidelines', title: 'Colour pairs that stay readable', lede: 'Every pair below passes WCAG AA for body text.', 'p0.s': 'Ink on paper', 'p0.r': '15.2 : 1', 'p1.s': 'Paper on primary', 'p1.r': '6.1 : 1', 'p2.s': 'Ink on accent', 'p2.r': '8.4 : 1', 'p3.s': 'Paper on deep', 'p3.r': '14.7 : 1' },
    html: charter(`<h2 class="mt-[26px] font-display text-[34px] font-bold leading-[1.05] text-ink">{{title}}</h2><p class="mt-[10px] text-[14px] text-muted">{{lede}}</p>
<div class="my-[26px] flex flex-1 flex-col gap-[8px]">
<div class="flex flex-1 items-center justify-between border border-rule bg-ground px-[28px]"><p class="font-display text-[36px] font-bold text-ink">{{p0.s}}</p><p class="font-display text-[26px] font-bold tabular-nums text-ink">{{p0.r}}</p></div>
<div class="flex flex-1 items-center justify-between bg-brand-primary px-[28px] text-on-brand"><p class="font-display text-[36px] font-bold">{{p1.s}}</p><p class="font-display text-[26px] font-bold tabular-nums">{{p1.r}}</p></div>
<div class="flex flex-1 items-center justify-between bg-brand-accent px-[28px] text-on-accent"><p class="font-display text-[36px] font-bold">{{p2.s}}</p><p class="font-display text-[26px] font-bold tabular-nums">{{p2.r}}</p></div>
<div class="flex flex-1 items-center justify-between bg-deep px-[28px] text-on-deep"><p class="font-display text-[36px] font-bold">{{p3.s}}</p><p class="font-display text-[26px] font-bold tabular-nums">{{p3.r}}</p></div></div>`),
  },
  {
    id: 'ch14', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 8, style: 'swiss',
    intent: 'layout grid: three large figures for columns, gutter and margin, with a sentence on how pages are composed',
    texts: { folio: F(14), kicker: 'Mise en page', brandline: 'Charte graphique', title: 'Une grille, trois nombres', 'g0.v': '12', 'g0.l': 'colonnes', 'g0.b': 'Toutes les pages se découpent en 12 colonnes. Un titre en occupe 8, un texte courant 6.', 'g1.v': '24', 'g1.l': 'px de gouttière', 'g1.b': 'L’espace entre deux colonnes ne change jamais, quel que soit le support.', 'g2.v': '48', 'g2.l': 'px de marge', 'g2.b': 'Aucun texte ni logo ne s’approche du bord de la page à moins de 48 px.' },
    html: charter(`<h2 class="mt-[26px] max-w-[85%] font-display text-[40px] font-bold leading-[1.05] text-ink">{{title}}</h2>
<div class="my-[28px] flex flex-1 flex-col border-t-[3px] border-ink">
<div class="grid flex-1 grid-cols-[230px_1fr] items-center gap-[24px] border-b border-rule"><div><p class="font-display text-[120px] font-bold leading-none tabular-nums text-brand-primary">{{g0.v}}</p><p class="text-[13px] font-bold uppercase tracking-[0.12em] text-ink">{{g0.l}}</p></div><p class="text-[15px] leading-[1.6] text-ink">{{g0.b}}</p></div>
<div class="grid flex-1 grid-cols-[230px_1fr] items-center gap-[24px] border-b border-rule"><div><p class="font-display text-[120px] font-bold leading-none tabular-nums text-brand-primary">{{g1.v}}</p><p class="text-[13px] font-bold uppercase tracking-[0.12em] text-ink">{{g1.l}}</p></div><p class="text-[15px] leading-[1.6] text-ink">{{g1.b}}</p></div>
<div class="grid flex-1 grid-cols-[230px_1fr] items-center gap-[24px] border-b border-rule"><div><p class="font-display text-[120px] font-bold leading-none tabular-nums text-brand-primary">{{g2.v}}</p><p class="text-[13px] font-bold uppercase tracking-[0.12em] text-ink">{{g2.l}}</p></div><p class="text-[15px] leading-[1.6] text-ink">{{g2.b}}</p></div></div>`),
  },
  {
    id: 'ch15', doc: 'brand-charter', format: 'page-a4', role: 'showcase', brand: 5, style: 'maximalism',
    intent: 'pattern in use: one wide band of pattern across the top, three application notes in columns under it',
    texts: { folio: F(15), kicker: 'Motif', brandline: 'Charte graphique', title: 'Le motif au travail', 'a0.t': 'Couvertures', 'a0.b': 'En bande sur un tiers de la page, jamais en fond complet.', 'a1.t': 'Emballages', 'a1.b': 'Sur le papier de soie et les étiquettes, à l’échelle 1.', 'a2.t': 'Réseaux sociaux', 'a2.b': 'En coin d’un visuel, à 15 % d’opacité maximum.' },
    html: charter(`<div class="relative mt-[28px] h-[300px] overflow-hidden bg-brand-primary"><idem-pattern kind="flow" density="0.7" class="absolute inset-0 opacity-60"></idem-pattern></div>
<h2 class="mt-[30px] font-display text-[40px] font-bold leading-[1.05] text-ink">{{title}}</h2>
<div class="mb-[30px] mt-auto grid grid-cols-3 gap-[22px] border-t-[3px] border-ink pt-[14px]"><div><p class="text-[14px] font-bold text-brand-primary">{{a0.t}}</p><p class="mt-[5px] text-[13px] leading-[1.5] text-ink">{{a0.b}}</p></div><div><p class="text-[14px] font-bold text-brand-primary">{{a1.t}}</p><p class="mt-[5px] text-[13px] leading-[1.5] text-ink">{{a1.b}}</p></div><div><p class="text-[14px] font-bold text-brand-primary">{{a2.t}}</p><p class="mt-[5px] text-[13px] leading-[1.5] text-ink">{{a2.b}}</p></div></div>`),
  },
  {
    id: 'ch16', doc: 'brand-charter', format: 'page-a4', role: 'showcase', brand: 4, style: 'collage-art',
    intent: 'brand in use: three finished photo applications side by side at the same height, each with its name',
    texts: { folio: F(16), kicker: 'Applications', brandline: 'Brand guidelines', title: 'The brand at work', 'm0.l': 'Shop bag', 'm1.l': 'Workshop apron', 'm2.l': 'Gift box' },
    images: { 'm0.url': 'photo:#e9c46a,#c96f2d,#6b3a1d', 'm1.url': 'photo:#d4a373,#8d5524,#2b2d42', 'm2.url': 'photo:#f4a261,#b5522b,#1f2937' },
    html: charter(`<h2 class="mt-[26px] font-display text-[36px] font-bold text-ink">{{title}}</h2>
<div class="my-[26px] grid flex-1 grid-cols-3 gap-[12px]"><figure class="flex flex-col"><img src="{{m0.url}}" alt="" class="min-h-0 flex-1 object-cover"><figcaption class="pt-[8px] text-[12px] font-bold uppercase tracking-[0.1em] text-ink">{{m0.l}}</figcaption></figure><figure class="flex flex-col"><img src="{{m1.url}}" alt="" class="min-h-0 flex-1 object-cover"><figcaption class="pt-[8px] text-[12px] font-bold uppercase tracking-[0.1em] text-ink">{{m1.l}}</figcaption></figure><figure class="flex flex-col"><img src="{{m2.url}}" alt="" class="min-h-0 flex-1 object-cover"><figcaption class="pt-[8px] text-[12px] font-bold uppercase tracking-[0.1em] text-ink">{{m2.l}}</figcaption></figure></div>`),
  },
  {
    id: 'ch17', doc: 'brand-charter', format: 'page-a4', role: 'specimen', brand: 3, style: 'editorial',
    intent: 'voice and tone: three pairs of sentences, what we say against what we avoid, in two columns',
    texts: { folio: F(17), kicker: 'Voix', brandline: 'Charte graphique', title: 'Comment nous parlons', 'h.y': 'Nous disons', 'h.n': 'Nous évitons', 'y0': 'Vos tomates arrivent demain matin, cueillies hier soir.', 'n0': 'Une logistique optimisée garantit la fraîcheur de nos produits.', 'y1': 'Cette huile vient de la famille Gbaguidi, à Allada.', 'n1': 'Nos produits sont issus de filières locales certifiées.', 'y2': 'Un souci ? Écrivez-nous sur WhatsApp, on répond en dix minutes.', 'n2': 'Veuillez contacter notre service client via le formulaire.' },
    html: charter(`<h2 class="mt-[26px] font-display text-[40px] font-bold leading-[1.04] text-ink">{{title}}</h2>
<div class="my-[26px] grid flex-1 grid-cols-2 gap-[14px]"><div class="flex flex-col"><p class="border-b-[3px] border-brand-primary pb-[8px] text-[13px] font-bold uppercase tracking-[0.14em] text-brand-primary">{{h.y}}</p><div class="flex flex-1 flex-col justify-around"><p class="font-display text-[22px] font-medium leading-[1.25] text-ink">{{y0}}</p><p class="font-display text-[22px] font-medium leading-[1.25] text-ink">{{y1}}</p><p class="font-display text-[22px] font-medium leading-[1.25] text-ink">{{y2}}</p></div></div>
<div class="flex flex-col bg-sunken px-[18px]"><p class="border-b-[3px] border-muted pb-[8px] pt-[0px] text-[13px] font-bold uppercase tracking-[0.14em] text-muted">{{h.n}}</p><div class="flex flex-1 flex-col justify-around"><p class="font-display text-[22px] leading-[1.25] text-muted">{{n0}}</p><p class="font-display text-[22px] leading-[1.25] text-muted">{{n1}}</p><p class="font-display text-[22px] leading-[1.25] text-muted">{{n2}}</p></div></div></div>`),
  },
  {
    id: 'ch18', doc: 'brand-charter', format: 'page-a4', role: 'showcase', brand: 9,
    intent: 'stationery: a letterhead drawn as a real page with logo, address block and a sample letter, shown at reduced scale',
    texts: { folio: F(18), kicker: 'Papeterie', brandline: 'Charte graphique', title: 'Le papier à en-tête', 'a.n': 'Café des Grassfields', 'a.l1': 'BP 1210, Bafoussam, Cameroun', 'a.l2': '+237 6 00 00 00 00', 'a.l3': 'contact@grassfields.example', 'd': 'Bafoussam, le 12 mars 2026', 'to': 'Monsieur Hans Keller, Hambourg', 'obj': 'Objet : offre de la récolte 2026', 'body': 'Monsieur, nous avons le plaisir de vous proposer trois lots d’arabica lavé, cultivés entre 1 400 et 1 700 mètres. Les échantillons partent cette semaine.', 'sig': 'Ngwa Tabi, directeur', 'note': 'Papier 100 g, impression une couleur sur fond blanc. Marges de 20 mm.' },
    html: charter(`<h2 class="mt-[22px] font-display text-[30px] font-bold text-ink">{{title}}</h2>
<div class="my-[20px] flex min-h-0 flex-1 items-center justify-center bg-sunken"><div class="flex h-[560px] w-[396px] flex-col bg-ground px-[34px] py-[30px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"><div class="flex items-start justify-between border-b-[2px] border-brand-primary pb-[12px]"><idem-logo variant="primary" class="h-[38px]"></idem-logo><div class="text-right text-[8px] leading-[1.5] text-muted"><p class="font-bold text-ink">{{a.n}}</p><p>{{a.l1}}</p><p>{{a.l2}}</p><p>{{a.l3}}</p></div></div><p class="mt-[22px] text-right text-[8px] text-muted">{{d}}</p><p class="mt-[14px] text-[9px] font-semibold text-ink">{{to}}</p><p class="mt-[14px] text-[9px] font-bold text-brand-primary">{{obj}}</p><p class="mt-[8px] text-[8.5px] leading-[1.6] text-ink">{{body}}</p><p class="mt-[14px] text-[8.5px] font-semibold text-ink">{{sig}}</p></div></div>
<p class="mb-[22px] text-[12px] text-muted">{{note}}</p>`),
  },
  {
    id: 'ch19', doc: 'brand-charter', format: 'page-a4', role: 'comparison', brand: 7,
    intent: 'do and do not: two columns of five short rules, each marked with a check or a cross icon in a rule list',
    texts: { folio: F(19), kicker: 'Rules', brandline: 'Brand guidelines', title: 'Do and do not', 'd.t': 'Do', 'n.t': 'Do not', 'd0': 'Keep the logo on a plain ground', 'd1': 'Use one accent colour per page', 'd2': 'Set headlines in the display face', 'd3': 'Leave space around every element', 'd4': 'Write the way people speak', 'n0': 'Stretch or recolour the logo', 'n1': 'Put text over a busy pattern', 'n2': 'Mix more than two typefaces', 'n3': 'Add shadows, glows or outlines', 'n4': 'Use jargon or long sentences', 'ok.icon': 'check', 'no.icon': 'x' },
    html: charter(`<h2 class="mt-[26px] font-display text-[40px] font-bold text-ink">{{title}}</h2>
<div class="my-[26px] grid flex-1 grid-cols-2 gap-[18px]"><div class="flex flex-col"><p class="bg-brand-primary px-[14px] py-[10px] text-[15px] font-bold uppercase tracking-[0.12em] text-on-brand">{{d.t}}</p><ul class="flex flex-1 flex-col justify-around text-[15px] font-medium leading-[1.3] text-ink"><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{ok.icon}}" class="size-[22px] shrink-0 text-brand-primary"></idem-icon>{{d0}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{ok.icon}}" class="size-[22px] shrink-0 text-brand-primary"></idem-icon>{{d1}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{ok.icon}}" class="size-[22px] shrink-0 text-brand-primary"></idem-icon>{{d2}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{ok.icon}}" class="size-[22px] shrink-0 text-brand-primary"></idem-icon>{{d3}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{ok.icon}}" class="size-[22px] shrink-0 text-brand-primary"></idem-icon>{{d4}}</li></ul></div>
<div class="flex flex-col"><p class="bg-ink px-[14px] py-[10px] text-[15px] font-bold uppercase tracking-[0.12em] text-ground">{{n.t}}</p><ul class="flex flex-1 flex-col justify-around text-[15px] font-medium leading-[1.3] text-muted"><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{no.icon}}" class="size-[22px] shrink-0 text-ink"></idem-icon>{{n0}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{no.icon}}" class="size-[22px] shrink-0 text-ink"></idem-icon>{{n1}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{no.icon}}" class="size-[22px] shrink-0 text-ink"></idem-icon>{{n2}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{no.icon}}" class="size-[22px] shrink-0 text-ink"></idem-icon>{{n3}}</li><li class="flex items-center gap-[12px] border-b border-rule py-[10px]"><idem-icon name="{{no.icon}}" class="size-[22px] shrink-0 text-ink"></idem-icon>{{n4}}</li></ul></div></div>`),
  },
  {
    id: 'ch20', doc: 'brand-charter', format: 'page-a4', role: 'closing', brand: 11,
    intent: 'closing page on a deep ground: the logo large, a thank-you line and the contact for brand questions',
    texts: { folio: F(20), kicker: 'Contacto', brandline: 'Guia da marca', title: 'Dúvidas sobre a marca?', 'c0.k': 'Responsável', 'c0.v': 'Aurora Machava', 'c1.k': 'Email', 'c1.v': 'marca@capulana.example', 'c2.k': 'Ficheiros', 'c2.v': 'Logótipos, cores e fontes na pasta partilhada da equipa.' },
    html: charter(`<div class="flex flex-1 flex-col justify-between py-[40px]"><idem-logo variant="onDark" class="h-[110px] self-start"></idem-logo><div><h2 class="font-display text-[64px] font-black leading-[0.98] tracking-[-0.015em]">{{title}}</h2><div class="mt-[40px] grid grid-cols-3 gap-[24px] border-t border-on-deep/40 pt-[16px] text-[14px]"><div><p class="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{{c0.k}}</p><p class="mt-[4px] font-semibold">{{c0.v}}</p></div><div><p class="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{{c1.k}}</p><p class="mt-[4px] font-semibold">{{c1.v}}</p></div><div><p class="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{{c2.k}}</p><p class="mt-[4px] leading-[1.5]">{{c2.v}}</p></div></div></div></div>`, 'deep'),
  },
];
