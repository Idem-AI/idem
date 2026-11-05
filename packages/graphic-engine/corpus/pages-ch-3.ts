import type { CorpusPage } from './types';
import { charterL, folio } from './kit';

const F = (n: number) => folio('Brand book', n);

/** Charte graphique — pages A4 PAYSAGE (21 à 30). La largeur sert à poser les éléments côte à côte, jamais à étirer une colonne de lecture. */
export const PAGES: CorpusPage[] = [
  {
    id: 'ch21', doc: 'brand-charter', format: 'page-a4-landscape', role: 'opening', brand: 0, style: 'editorial',
    intent: 'landscape brand story: statement and three values on the left, a deep panel carrying the large logo and a soft pattern on the right',
    texts: { folio: F(1), kicker: 'Notre marque', title: 'La noix de cajou, de Korhogo à votre table', lede: 'Noix d’Or travaille avec 400 familles de producteurs du nord de la Côte d’Ivoire. Notre identité doit se lire comme une récolte bien triée : nette, chaude, sans artifice.', 'v0.t': 'Terroir', 'v0.b': 'Chaque lot porte le nom de son village.', 'v1.t': 'Équité', 'v1.b': 'Le prix est payé avant la récolte.', 'v2.t': 'Qualité', 'v2.b': 'Triée à la main, jamais au hasard.' },
    html: `<div class="flex h-full w-full bg-ground"><div class="flex w-[60%] flex-col justify-between px-[52px] py-[36px]"><header class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>
<div><h2 class="font-display text-[56px] font-bold leading-[1.0] tracking-[-0.015em] text-ink">{{title}}</h2><p class="mt-[20px] max-w-[92%] text-[15px] leading-[1.6] text-ink">{{lede}}</p></div>
<section class="grid grid-cols-3 gap-[20px] border-t-[3px] border-brand-primary pt-[14px]"><div><p class="font-display text-[20px] font-bold text-brand-primary">{{v0.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{v0.b}}</p></div><div><p class="font-display text-[20px] font-bold text-brand-primary">{{v1.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{v1.b}}</p></div><div><p class="font-display text-[20px] font-bold text-brand-primary">{{v2.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-ink">{{v2.b}}</p></div></section></div>
<div class="relative flex flex-1 items-center justify-center overflow-hidden bg-deep"><idem-pattern kind="flow" class="absolute inset-0 opacity-60"></idem-pattern><idem-logo variant="onDark" class="relative h-[120px]"></idem-logo></div></div>`,
  },
  {
    id: 'ch22', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 1,
    intent: 'primary logo large in a framed panel on the left, three numbered usage rules stacked on the right',
    texts: { folio: F(2), kicker: 'Logo', brandline: 'Brand guidelines', title: 'The primary logo', 'r0.t': 'Use it by default', 'r0.b': 'Name and mark travel together on every page, screen and label.', 'r1.t': 'Never redraw it', 'r1.b': 'Proportions, colours and spacing stay exactly as supplied.', 'r2.t': 'Give it room', 'r2.b': 'Keep clear space around it equal to the height of the mark.', 'r0.n': '1', 'r1.n': '2', 'r2.n': '3' },
    html: charterL(`<div class="my-[22px] grid flex-1 grid-cols-[1.6fr_1fr] gap-[32px]"><div class="flex items-center justify-center border border-rule bg-ground"><idem-logo variant="primary" class="h-[170px]"></idem-logo></div>
<div class="flex flex-col"><h2 class="font-display text-[34px] font-bold leading-[1.05] text-ink">{{title}}</h2><ol class="mt-[16px] flex flex-1 flex-col justify-between border-t-[2px] border-ink"><li class="flex gap-[14px] border-b border-rule py-[14px]"><span class="font-display text-[28px] font-bold leading-none tabular-nums text-brand-primary">{{r0.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r0.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r0.b}}</p></div></li><li class="flex gap-[14px] border-b border-rule py-[14px]"><span class="font-display text-[28px] font-bold leading-none tabular-nums text-brand-primary">{{r1.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r1.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r1.b}}</p></div></li><li class="flex gap-[14px] py-[14px]"><span class="font-display text-[28px] font-bold leading-none tabular-nums text-brand-primary">{{r2.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r2.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r2.b}}</p></div></li></ol></div></div>`),
  },
  {
    id: 'ch23', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 2,
    intent: 'logo on three grounds as three equal full-height columns: light, deep and brand colour, each labelled at the bottom',
    texts: { folio: F(3), kicker: 'Logo', brandline: 'Charte graphique', title: 'Trois fonds, un seul logo', 'a.l': 'Fond clair', 'b.l': 'Fond profond', 'c.l': 'Couleur de marque' },
    html: charterL(`<h2 class="mt-[18px] font-display text-[30px] font-bold text-ink">{{title}}</h2>
<div class="my-[18px] grid flex-1 grid-cols-3 gap-[10px]"><div class="relative flex items-center justify-center border border-rule bg-sunken"><idem-logo variant="primary" class="h-[88px]"></idem-logo><p class="absolute bottom-[12px] left-[14px] text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{{a.l}}</p></div>
<div class="relative flex items-center justify-center bg-deep"><idem-logo variant="onDark" class="h-[88px]"></idem-logo><p class="absolute bottom-[12px] left-[14px] text-[11px] font-bold uppercase tracking-[0.12em] text-on-deep/80">{{b.l}}</p></div>
<div class="relative flex items-center justify-center bg-brand-primary"><idem-logo variant="onDark" class="h-[88px]"></idem-logo><p class="absolute bottom-[12px] left-[14px] text-[11px] font-bold uppercase tracking-[0.12em] text-on-brand/90">{{c.l}}</p></div></div>`),
  },
  {
    id: 'ch24', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 3, style: 'editorial',
    intent: 'colour palette as five full-height vertical swatches of decreasing width, the main colour widest, each with name, role and code',
    texts: { folio: F(4), kicker: 'Couleurs', brandline: 'Charte graphique', title: 'La palette de l’étal', 's0.n': 'Terre cuite', 's0.r': 'Couleur principale', 's0.h': '#B5422F', 's1.n': 'Ardoise', 's1.r': 'Profonde', 's1.h': '#2F4858', 's2.n': 'Miel', 's2.r': 'Accent, une fois par page', 's2.h': '#F6AE2D', 's3.n': 'Papier', 's3.r': 'Fond', 's3.h': '#FBF8F3', 's4.n': 'Encre', 's4.r': 'Texte', 's4.h': '#1B1F23' },
    html: charterL(`<h2 class="mt-[18px] font-display text-[30px] font-bold text-ink">{{title}}</h2>
<div class="my-[18px] flex flex-1 gap-[6px]">
<div class="flex flex-[3] flex-col justify-end bg-brand-primary p-[16px] text-on-brand"><p class="font-display text-[26px] font-bold leading-[1.05]">{{s0.n}}</p><p class="mt-[4px] text-[12px] opacity-90">{{s0.r}}</p><p class="mt-[12px] text-[13px] font-semibold tabular-nums">{{s0.h}}</p></div>
<div class="flex flex-[2] flex-col justify-end bg-deep p-[16px] text-on-deep"><p class="font-display text-[20px] font-bold leading-[1.1]">{{s1.n}}</p><p class="mt-[4px] text-[11px] opacity-85">{{s1.r}}</p><p class="mt-[10px] text-[12px] font-semibold tabular-nums">{{s1.h}}</p></div>
<div class="flex flex-[2] flex-col justify-end bg-brand-accent p-[16px] text-on-accent"><p class="font-display text-[20px] font-bold leading-[1.1]">{{s2.n}}</p><p class="mt-[4px] text-[11px] opacity-85">{{s2.r}}</p><p class="mt-[10px] text-[12px] font-semibold tabular-nums">{{s2.h}}</p></div>
<div class="flex flex-1 flex-col justify-end border border-rule bg-ground p-[14px] text-ink"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s3.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s3.r}}</p><p class="mt-[8px] text-[11px] font-semibold tabular-nums">{{s3.h}}</p></div>
<div class="flex flex-1 flex-col justify-end bg-ink p-[14px] text-ground"><p class="font-display text-[16px] font-bold leading-[1.1]">{{s4.n}}</p><p class="mt-[3px] text-[10px] opacity-85">{{s4.r}}</p><p class="mt-[8px] text-[11px] font-semibold tabular-nums">{{s4.h}}</p></div></div>`),
  },
  {
    id: 'ch25', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 4, style: 'swiss',
    intent: 'colour proportions: one wide stacked bar across the page with shares beneath, four usage rules in four columns under it',
    texts: { folio: F(5), kicker: 'Colours', brandline: 'Brand guidelines', title: 'How much of each colour', 'u0.p': '60 %', 'u0.t': 'Ground and ink', 'u0.b': 'Pages, backgrounds and all running text.', 'u1.p': '25 %', 'u1.t': 'Primary', 'u1.b': 'Headings, rules, key figures and buttons.', 'u2.p': '10 %', 'u2.t': 'Deep', 'u2.b': 'Bands and panels that carry white text.', 'u3.p': '5 %', 'u3.t': 'Accent', 'u3.b': 'One highlight per page, never more.' },
    html: charterL(`<h2 class="mt-[20px] font-display text-[34px] font-bold leading-[1.05] text-ink">{{title}}</h2>
<div class="mt-[24px] flex min-h-[190px] w-full flex-1 gap-[3px]"><div class="w-[60%] border border-rule bg-sunken"></div><div class="w-[25%] bg-brand-primary"></div><div class="w-[10%] bg-deep"></div><div class="w-[5%] bg-brand-accent"></div></div>
<div class="mt-[8px] grid grid-cols-[60fr_25fr_10fr_5fr] gap-[3px] text-[12px] font-bold tabular-nums text-muted"><span>{{u0.p}}</span><span>{{u1.p}}</span><span>{{u2.p}}</span><span>{{u3.p}}</span></div>
<div class="my-[22px] grid grid-cols-4 gap-[22px] border-t-[2px] border-ink pt-[14px]"><div><p class="text-[14px] font-bold text-ink">{{u0.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-muted">{{u0.b}}</p></div><div><p class="text-[14px] font-bold text-brand-primary">{{u1.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-muted">{{u1.b}}</p></div><div><p class="text-[14px] font-bold text-ink">{{u2.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-muted">{{u2.b}}</p></div><div><p class="text-[14px] font-bold text-ink">{{u3.t}}</p><p class="mt-[5px] text-[12.5px] leading-[1.5] text-muted">{{u3.b}}</p></div></div>`),
  },
  {
    id: 'ch26', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 5,
    intent: 'typeface specimen: a huge letterform pair on the left, three weights of the alphabet and the figures on the right',
    texts: { folio: F(6), kicker: 'Typographie', brandline: 'Charte graphique', title: 'Police d’affichage', big: 'Aa', 'w0.l': 'Regular', 'w1.l': 'Medium', 'w2.l': 'Bold', abc: 'ABCDEFGHIJKLM NOPQRSTUVWXYZ', num: '0123456789 & ? ! %', body: 'Pour les titres, les chiffres-clés et les accroches. Jamais pour un paragraphe.' },
    html: charterL(`<div class="my-[20px] grid flex-1 grid-cols-[1fr_1.1fr] gap-[36px]"><div class="flex flex-col justify-between"><p class="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-primary">{{title}}</p><p class="font-display text-[290px] font-bold leading-[0.8] tracking-[-0.04em] text-ink">{{big}}</p><p class="max-w-[85%] text-[13px] leading-[1.6] text-muted">{{body}}</p></div>
<div class="flex flex-col justify-between border-l border-rule pl-[28px]"><div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{{w0.l}}</p><p class="mt-[2px] font-display text-[28px] font-normal leading-[1.15] text-ink">{{abc}}</p></div><div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{{w1.l}}</p><p class="mt-[2px] font-display text-[28px] font-medium leading-[1.15] text-ink">{{abc}}</p></div><div><p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{{w2.l}}</p><p class="mt-[2px] font-display text-[28px] font-bold leading-[1.15] text-ink">{{abc}}</p></div><p class="border-t-[3px] border-brand-primary pt-[12px] font-display text-[40px] font-bold tabular-nums leading-[1.1] text-brand-primary">{{num}}</p></div></div>`),
  },
  {
    id: 'ch27', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 6,
    intent: 'type scale in two columns: the three display sizes on the left, body and caption sizes with their usage on the right',
    texts: { folio: F(7), kicker: 'Typography', brandline: 'Brand guidelines', title: 'The type scale', 'r0.l': 'Headline · 48', 'r0.t': 'Every parcel, on time', 'r1.l': 'Title · 30', 'r1.t': 'Eleven depots across Zambia', 'r2.l': 'Subtitle · 20', 'r2.t': 'Same-day delivery in Lusaka', 'r3.l': 'Body · 13', 'r3.t': 'Orders placed before 10:00 leave the depot the same day. Customers follow the parcel by SMS from pickup to door.', 'r3.u': 'Paragraphs, descriptions, forms', 'r4.l': 'Caption · 10', 'r4.t': 'Network as of March 2026, source: dispatch log', 'r4.u': 'Sources, notes, legal lines' },
    html: charterL(`<h2 class="mt-[18px] font-display text-[28px] font-bold text-ink">{{title}}</h2>
<div class="my-[18px] grid flex-1 grid-cols-[1.25fr_1fr] gap-[36px]"><div class="flex flex-col justify-between border-t-[2px] border-ink">
<div class="pt-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r0.l}}</p><p class="mt-[4px] font-display text-[60px] font-bold leading-[1.02] text-ink">{{r0.t}}</p></div>
<div class="border-t border-rule pt-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r1.l}}</p><p class="mt-[4px] font-display text-[36px] font-bold leading-[1.1] text-ink">{{r1.t}}</p></div>
<div class="border-t border-rule pt-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r2.l}}</p><p class="mt-[4px] font-display text-[20px] font-medium leading-[1.2] text-ink">{{r2.t}}</p></div></div>
<div class="flex flex-col justify-between border-t-[2px] border-ink">
<div class="pt-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r3.l}}</p><p class="mt-[6px] text-[16px] leading-[1.6] text-ink">{{r3.t}}</p><p class="mt-[6px] text-[11px] text-muted">{{r3.u}}</p></div>
<div class="border-t border-rule pt-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-primary">{{r4.l}}</p><p class="mt-[6px] text-[10px] leading-[1.5] text-muted">{{r4.t}}</p><p class="mt-[6px] text-[11px] text-muted">{{r4.u}}</p></div></div></div>`),
  },
  {
    id: 'ch28', doc: 'brand-charter', format: 'page-a4-landscape', role: 'showcase', brand: 7, style: 'swiss',
    intent: 'brand pattern as a full-height panel on the left half, its name, rule and three application notes on the right',
    texts: { folio: F(8), kicker: 'Pattern', brandline: 'Brand guidelines', title: 'The ledger pattern', body: 'Fine drawn lines in the brand colour, echoing the pages of a savings book. It frames covers and bands and never sits under small text.', 'a0': 'Covers and section openers', 'a1': 'Bands at the foot of a page', 'a2': 'Packaging and cards, at 10 % strength' },
    html: `<div class="flex h-full w-full bg-ground"><div class="relative w-[48%] overflow-hidden bg-brand-primary"><idem-pattern kind="hand-lines" density="0.6" class="absolute inset-0 opacity-70"></idem-pattern></div>
<div class="flex flex-1 flex-col justify-between px-[44px] py-[36px]"><header class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>
<div><h2 class="font-display text-[44px] font-bold leading-[1.02] text-ink">{{title}}</h2><p class="mt-[14px] text-[14px] leading-[1.6] text-muted">{{body}}</p></div>
<ul class="border-t-[2px] border-ink text-[13px] font-medium text-ink"><li class="border-b border-rule py-[10px]">{{a0}}</li><li class="border-b border-rule py-[10px]">{{a1}}</li><li class="py-[10px]">{{a2}}</li></ul>
<div class="flex items-center justify-between border-t border-rule pt-[8px]"><idem-logo variant="primary" class="h-[18px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></div></div></div>`,
  },
  {
    id: 'ch29', doc: 'brand-charter', format: 'page-a4-landscape', role: 'specimen', brand: 8,
    intent: 'iconography: a short lede on the left and a two-by-five grid of line icons on the right, each with its name',
    texts: { folio: F(9), kicker: 'Iconographie', brandline: 'Charte graphique', title: 'Des icônes au trait fin', lede: 'Un trait de 2 px, des angles arrondis, une seule couleur. Elles illustrent une idée, jamais une décoration.', 'i0.icon': 'book-open', 'i0.n': 'Cours', 'i1.icon': 'users', 'i1.n': 'Classe', 'i2.icon': 'lightbulb', 'i2.n': 'Idée', 'i3.icon': 'calendar', 'i3.n': 'Calendrier', 'i4.icon': 'map-pin', 'i4.n': 'Campus', 'i5.icon': 'laptop', 'i5.n': 'Atelier', 'i6.icon': 'star', 'i6.n': 'Projet', 'i7.icon': 'compass', 'i7.n': 'Parcours', 'i8.icon': 'sun', 'i8.n': 'Éveil', 'i9.icon': 'leaf', 'i9.n': 'Croissance' },
    html: charterL(`<div class="my-[20px] grid flex-1 grid-cols-[0.8fr_2fr] gap-[36px]"><div class="flex flex-col justify-center"><h2 class="font-display text-[38px] font-bold leading-[1.04] text-ink">{{title}}</h2><p class="mt-[14px] text-[14px] leading-[1.6] text-muted">{{lede}}</p></div>
<div class="grid grid-cols-5 grid-rows-2 border-l border-t border-rule">
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i0.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i0.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i1.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i1.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i2.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i2.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i3.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i3.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i4.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i4.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i5.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i5.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i6.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i6.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i7.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i7.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i8.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i8.n}}</p></div>
<div class="flex flex-col items-center justify-center gap-[12px] border-b border-r border-rule"><idem-icon name="{{i9.icon}}" class="size-[52px] text-brand-primary"></idem-icon><p class="text-[12px] font-semibold text-ink">{{i9.n}}</p></div></div></div>`),
  },
  {
    id: 'ch30', doc: 'brand-charter', format: 'page-a4-landscape', role: 'showcase', brand: 9,
    intent: 'imagery: one tall photograph filling the left of the page, a title and three numbered rules for choosing photographs on the right',
    texts: { folio: F(10), kicker: 'Images', brandline: 'Charte graphique', title: 'Photographier le lieu, pas la pose', 'r0.n': '1', 'r0.t': 'Lumière naturelle', 'r0.b': 'Fenêtres ouvertes, jamais de flash ni de filtre.', 'r1.n': '2', 'r1.t': 'Une pièce, un point de vue', 'r1.b': 'Une seule scène remplit le cadre, à hauteur d’yeux.', 'r2.n': '3', 'r2.t': 'Des matières vraies', 'r2.b': 'Bois, lin, pierre : on montre le grain, on ne le retouche pas.' },
    images: { 'hero.url': 'photo:#e9d8c4,#b0764f,#1e3a5f' },
    html: `<div class="flex h-full w-full bg-ground"><div class="relative w-[52%]"><img src="{{hero.url}}" alt="" class="h-full w-full object-cover"></div>
<div class="flex flex-1 flex-col justify-between px-[44px] py-[36px]"><header class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>
<h2 class="font-display text-[38px] font-bold leading-[1.05] text-ink">{{title}}</h2>
<ol class="border-t-[3px] border-brand-primary"><li class="flex gap-[14px] border-b border-rule py-[12px]"><span class="font-display text-[24px] font-bold leading-none tabular-nums text-brand-primary">{{r0.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r0.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r0.b}}</p></div></li><li class="flex gap-[14px] border-b border-rule py-[12px]"><span class="font-display text-[24px] font-bold leading-none tabular-nums text-brand-primary">{{r1.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r1.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r1.b}}</p></div></li><li class="flex gap-[14px] py-[12px]"><span class="font-display text-[24px] font-bold leading-none tabular-nums text-brand-primary">{{r2.n}}</span><div><p class="text-[14px] font-bold text-ink">{{r2.t}}</p><p class="mt-[3px] text-[12.5px] leading-[1.5] text-muted">{{r2.b}}</p></div></li></ol>
<div class="flex items-center justify-between border-t border-rule pt-[8px]"><idem-logo variant="primary" class="h-[18px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></div></div></div>`,
  },
];
