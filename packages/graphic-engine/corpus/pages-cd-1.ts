import type { CorpusPage } from './types';

/** Cartes de visite — 85×55 mm paysage et 55×85 mm portrait (20 faces). Texte jamais sous 8,5 px (6,4 pt imprimés). */
const c = (name: string, title: string, extra: Record<string, string> = {}): Record<string, string> => ({
  fullName: name, jobTitle: title, phone: '+229 01 97 00 00 00', mobile: '+229 01 96 00 00 00', email: 'prenom@marque.example', website: 'marque.example', address: 'Rue 214, Haie Vive, Cotonou', tagline: 'Le goût d’ici, livré chez vous', ...extra,
});

export const PAGES: CorpusPage[] = [
  {
    id: 'cd01', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 9, style: 'editorial',
    intent: 'card back: a thick brand stripe on the left edge, the holder’s name large, contacts stacked at the bottom',
    texts: c('Ngwa Tabi', 'Directeur général'),
    html: `<div class="flex h-full w-full bg-ground"><div class="w-[9px] bg-brand-primary"></div><div class="flex flex-1 flex-col justify-between px-[18px] py-[18px]"><div><p class="font-display text-[19px] font-bold leading-[1.05] text-ink">{{fullName}}</p><p class="mt-[4px] text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-primary">{{jobTitle}}</p></div><div class="text-[9px] leading-[1.55] text-ink"><p class="tabular-nums">{{mobile}}</p><p>{{email}}</p><p>{{website}}</p></div></div></div>`,
  },
  {
    id: 'cd02', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 10,
    intent: 'card front: full brand-colour ground with the logo bottom-left and the tagline set at the top',
    texts: c('Njeri Mwangi', 'Wildlife photographer', { tagline: 'Wildlife, seen slowly' }),
    html: `<div class="relative flex h-full w-full flex-col justify-between bg-brand-primary p-[18px] text-on-brand"><p class="max-w-[70%] font-display text-[20px] font-bold leading-[1.1]" data-field="tagline">{{tagline}}</p><idem-logo variant="onDark" class="h-[28px] self-start"></idem-logo></div>`,
  },
  {
    id: 'cd03', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 11,
    intent: 'card back in two columns: name and title on the left, the contact list on the right, a heavy rule on top',
    texts: c('Aurora Machava', 'Advogada', { phone: '+258 84 000 0000', email: 'aurora@machava.example', website: 'machava.example', address: 'Av. Eduardo Mondlane 120, Beira' }),
    html: `<div class="flex h-full w-full flex-col bg-ground px-[18px] pb-[16px] pt-[0px]"><div class="h-[6px] w-full bg-ink"></div><div class="mt-[18px] grid flex-1 grid-cols-[1fr_1.15fr] gap-[14px]"><div class="flex flex-col justify-between"><div><p class="font-display text-[17px] font-bold leading-[1.1] text-ink">{{fullName}}</p><p class="mt-[4px] text-[9px] uppercase tracking-[0.12em] text-muted">{{jobTitle}}</p></div><idem-logo variant="primary" class="h-[22px] self-start"></idem-logo></div><div class="flex flex-col justify-end gap-[3px] border-l border-rule pl-[12px] text-[8.5px] leading-[1.5] text-ink"><p class="tabular-nums">{{phone}}</p><p>{{email}}</p><p>{{website}}</p><p class="text-muted">{{address}}</p></div></div></div>`,
  },
  {
    id: 'cd04', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 4,
    intent: 'card front: the logo centred and large on a clean ground, a coloured band along the bottom carrying the tagline',
    texts: c('Wanjiru Kato', 'Founder', { tagline: 'Made by hand in Kampala' }),
    html: `<div class="flex h-full w-full flex-col bg-ground"><div class="flex flex-1 items-center justify-center"><idem-logo variant="primary" class="h-[74px]"></idem-logo></div><div class="bg-brand-primary px-[18px] py-[9px] text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-on-brand">{{tagline}}</div></div>`,
  },
  {
    id: 'cd05', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 7,
    intent: 'card back on a deep ground: white name, accent job title, contacts with a thin accent rule above them',
    texts: c('Fatmata Kamara', 'Chief executive', { phone: '+232 76 000 000', email: 'fatmata@osusu.example', website: 'osusu.example', address: 'Siaka Stevens St, Freetown' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-deep p-[18px] text-on-deep"><div class="flex items-start justify-between"><div><p class="font-display text-[18px] font-bold leading-[1.05]">{{fullName}}</p><p class="mt-[4px] text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-accent">{{jobTitle}}</p></div><idem-logo variant="onDark" class="h-[22px]"></idem-logo></div><div class="border-t border-brand-accent pt-[8px] text-[9px] leading-[1.55]"><p class="tabular-nums">{{phone}}</p><p>{{email}}</p><p class="opacity-80">{{address}}</p></div></div>`,
  },
  {
    id: 'cd06', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 0,
    intent: 'card front split in two: a brand-colour panel holding the logo icon on the left, the tagline on paper on the right',
    texts: c('Awa Koné', 'Directrice', { tagline: 'La valeur reste là où le cajou pousse' }),
    html: `<div class="grid h-full w-full grid-cols-[38%_1fr]"><div class="flex items-center justify-center bg-brand-soft"><idem-logo variant="icon" class="h-[64px]"></idem-logo></div><div class="flex items-center bg-ground p-[18px]"><p class="font-display text-[17px] font-bold leading-[1.2] text-ink">{{tagline}}</p></div></div>`,
  },
  {
    id: 'cd07', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 2,
    intent: 'classic centred card back: name, title, a short rule, then contacts, symmetrical and quiet',
    texts: c('Mireille Okemba', 'Directrice de l’écolodge', { phone: '+241 06 00 00 00', email: 'mireille@lope.example', website: 'lope.example', address: 'Lopé, Ogooué-Ivindo, Gabon' }),
    html: `<div class="flex h-full w-full flex-col items-center justify-center bg-ground px-[18px] text-center"><p class="font-display text-[17px] font-bold text-ink">{{fullName}}</p><p class="mt-[3px] text-[9px] uppercase tracking-[0.16em] text-brand-primary">{{jobTitle}}</p><div class="my-[10px] h-[2px] w-[34px] bg-brand-accent"></div><div class="text-[9px] leading-[1.6] text-ink"><p class="tabular-nums">{{phone}}</p><p>{{email}}</p><p class="text-muted">{{address}}</p></div></div>`,
  },
  {
    id: 'cd08', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 11, style: 'pop-art',
    intent: 'card front with a procedural line pattern filling the right third, logo and tagline on the left',
    texts: c('Aurora Machava', 'Fundadora', { tagline: 'Moda em capulana, feita em Maputo' }),
    html: `<div class="relative flex h-full w-full bg-ground"><div class="flex w-[64%] flex-col justify-between p-[18px]"><idem-logo variant="primary" class="h-[30px] self-start"></idem-logo><p class="font-display text-[16px] font-bold leading-[1.15] text-ink">{{tagline}}</p></div><div class="relative w-[36%] bg-brand-primary"><idem-pattern kind="hand-lines" density="0.7" class="absolute inset-0 opacity-100"></idem-pattern></div></div>`,
  },
  {
    id: 'cd09', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 8,
    intent: 'card back with contacts in a two-by-two grid, each with a small caption label above its value',
    texts: c('Cheikh Diop', 'Responsable pédagogique', { 'l.phone': 'Téléphone', 'l.email': 'Email', 'l.web': 'Site', 'l.addr': 'Campus', phone: '+221 77 000 00 00', email: 'cheikh@codethies.example', website: 'codethies.example', address: 'Route de Dakar, Thiès' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[18px]"><div class="flex items-start justify-between"><div><p class="font-display text-[17px] font-bold leading-[1.05] text-ink">{{fullName}}</p><p class="mt-[3px] text-[9px] text-muted">{{jobTitle}}</p></div><idem-logo variant="primary" class="h-[20px]"></idem-logo></div><div class="grid grid-cols-2 gap-x-[12px] gap-y-[8px] border-t-[2px] border-brand-primary pt-[10px] text-[9px] leading-[1.35] text-ink"><div><p class="text-[8.5px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{l.phone}}</p><p class="tabular-nums">{{phone}}</p></div><div><p class="text-[8.5px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{l.email}}</p><p>{{email}}</p></div><div><p class="text-[8.5px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{l.web}}</p><p>{{website}}</p></div><div><p class="text-[8.5px] font-bold uppercase tracking-[0.1em] text-brand-primary">{{l.addr}}</p><p>{{address}}</p></div></div></div>`,
  },
  {
    id: 'cd10', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 3, style: 'maximalism',
    intent: 'typographic card front: the tagline set huge on an accent ground, the logo tiny in a corner',
    texts: c('Hervé Gbaguidi', 'Gérant', { tagline: 'Frais. Local. Livré.' }),
    html: `<div class="relative flex h-full w-full items-center bg-brand-accent p-[18px]"><p class="font-display text-[44px] font-black leading-[0.95] tracking-[-0.02em] text-on-accent">{{tagline}}</p><idem-logo variant="primary" class="absolute bottom-[14px] right-[16px] h-[20px]"></idem-logo></div>`,
  },
  {
    id: 'cd11', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 10,
    intent: 'card back: logo icon top-right, name large at the bottom-left, contacts right-aligned at the bottom-right',
    texts: c('Njeri Mwangi', 'Photographer', { mobile: '+254 700 000 000', email: 'njeri@wildlens.example', website: 'wildlens.example' }),
    html: `<div class="relative flex h-full w-full flex-col justify-between bg-ground p-[18px]"><idem-logo variant="icon" class="h-[28px] self-end"></idem-logo><div class="flex items-end justify-between gap-[10px]"><div><p class="font-display text-[22px] font-bold leading-[1] text-ink">{{fullName}}</p><p class="mt-[4px] text-[9px] uppercase tracking-[0.14em] text-brand-primary">{{jobTitle}}</p></div><div class="text-right text-[8.5px] leading-[1.55] text-ink"><p class="tabular-nums">{{mobile}}</p><p>{{email}}</p><p>{{website}}</p></div></div></div>`,
  },
  {
    id: 'cd12', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 5,
    intent: 'card front on a deep ground: the white logo centred, an accent rule beneath it and the tagline below',
    texts: c('Mireille Okemba', 'Directrice', { tagline: 'Couture sur mesure, Brazzaville' }),
    html: `<div class="flex h-full w-full flex-col items-center justify-center bg-deep text-on-deep"><idem-logo variant="onDark" class="h-[60px]"></idem-logo><div class="my-[11px] h-[2px] w-[40px] bg-brand-accent"></div><p class="text-[9px] uppercase tracking-[0.2em]">{{tagline}}</p></div>`,
  },
  {
    id: 'cd13', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 4,
    intent: 'portrait front: the upper half in the brand colour holding the logo, the tagline on paper beneath',
    texts: c('Wanjiru Kato', 'Founder', { tagline: 'Bark cloth, cut and sewn in Kampala' }),
    html: `<div class="flex h-full w-full flex-col"><div class="flex flex-[11] items-center justify-center bg-brand-primary"><idem-logo variant="onDark" class="h-[44px]"></idem-logo></div><div class="flex flex-[9] items-center bg-ground p-[16px]"><p class="font-display text-[16px] font-bold leading-[1.2] text-ink">{{tagline}}</p></div></div>`,
  },
  {
    id: 'cd14', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 1,
    intent: 'portrait back: name at the top, contacts as ruled rows beneath, the logo at the foot',
    texts: c('Eric Habimana', 'Soil scientist', { mobile: '+250 788 000 000', email: 'eric@soilsense.example', website: 'soilsense.example', address: 'Musanze, Rwanda' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[16px]"><div><p class="font-display text-[19px] font-bold leading-[1.05] text-ink">{{fullName}}</p><p class="mt-[4px] text-[9px] font-semibold uppercase tracking-[0.12em] text-brand-primary">{{jobTitle}}</p></div><div class="flex flex-col text-[9px] leading-[1.3] text-ink"><p class="border-t border-rule py-[6px] tabular-nums">{{mobile}}</p><p class="border-t border-rule py-[6px]">{{email}}</p><p class="border-t border-rule py-[6px]">{{website}}</p><p class="border-t border-rule py-[6px] text-muted">{{address}}</p></div><idem-logo variant="primary" class="h-[20px] self-start"></idem-logo></div>`,
  },
  {
    id: 'cd15', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 6,
    intent: 'portrait front, typographic: a very large tagline stacked in three lines, the logo anchored at the bottom',
    texts: c('Chanda Mwila', 'Operations', { tagline: 'Every pharmacy, on time.' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[16px]"><p class="font-display text-[34px] font-black leading-[0.95] tracking-[-0.02em] text-brand-primary">{{tagline}}</p><div class="border-t-[3px] border-ink pt-[10px]"><idem-logo variant="primary" class="h-[24px]"></idem-logo></div></div>`,
  },
  {
    id: 'cd16', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 7,
    intent: 'portrait back on a deep ground: name and title at the top, accent-ruled contacts at the bottom',
    texts: c('Fatmata Kamara', 'Chief executive', { phone: '+232 76 000 000', email: 'fatmata@osusu.example', website: 'osusu.example', address: 'Freetown' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-deep p-[16px] text-on-deep"><idem-logo variant="onDark" class="h-[22px] self-start"></idem-logo><div><p class="font-display text-[20px] font-bold leading-[1.05]">{{fullName}}</p><p class="mt-[4px] text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-accent">{{jobTitle}}</p><div class="mt-[12px] border-t border-brand-accent pt-[8px] text-[9px] leading-[1.6]"><p class="tabular-nums">{{phone}}</p><p>{{email}}</p><p>{{website}}</p></div></div></div>`,
  },
  {
    id: 'cd17', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 11, style: 'pop-art',
    intent: 'portrait front with a hand-drawn circle pattern over the upper two thirds and the logo beneath on paper',
    texts: c('Aurora Machava', 'Fundadora', { tagline: 'Capulana Viva' }),
    html: `<div class="flex h-full w-full flex-col"><div class="relative flex-[2] bg-brand-primary"><idem-pattern kind="hand-circles" density="0.7" class="absolute inset-0"></idem-pattern></div><div class="flex flex-1 flex-col items-center justify-center gap-[6px] bg-ground"><idem-logo variant="primary" class="h-[34px]"></idem-logo><p class="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-ink">{{tagline}}</p></div></div>`,
  },
  {
    id: 'cd18', doc: 'business-card', format: 'card-portrait', role: 'card-face', brand: 2,
    intent: 'portrait back, centred stack with a vertical accent rule on the left edge and generous spacing',
    texts: c('Mireille Okemba', 'Directrice', { mobile: '+241 06 00 00 00', email: 'mireille@lope.example', website: 'lope.example', address: 'La Lopé, Gabon' }),
    html: `<div class="flex h-full w-full bg-ground"><div class="w-[5px] bg-brand-accent"></div><div class="flex flex-1 flex-col justify-center gap-[12px] px-[16px]"><div><p class="font-display text-[18px] font-bold leading-[1.1] text-ink">{{fullName}}</p><p class="mt-[3px] text-[9px] uppercase tracking-[0.12em] text-brand-primary">{{jobTitle}}</p></div><div class="text-[9px] leading-[1.6] text-ink"><p class="tabular-nums">{{mobile}}</p><p>{{email}}</p><p>{{website}}</p><p class="text-muted">{{address}}</p></div><idem-logo variant="primary" class="h-[22px] self-start"></idem-logo></div></div>`,
  },
  {
    id: 'cd19', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 10, style: 'swiss',
    intent: 'card back for a studio: the address is the hero line, name and phone set small beneath on a strict grid',
    texts: c('Njeri Mwangi', 'Photographer', { address: 'Studio 4, Nanyuki Show Ground', mobile: '+254 700 000 000', email: 'njeri@wildlens.example' }),
    html: `<div class="grid h-full w-full grid-rows-[1fr_auto] bg-ground p-[18px]"><p class="max-w-[85%] font-display text-[21px] font-bold leading-[1.1] text-ink">{{address}}</p><div class="grid grid-cols-3 gap-[10px] border-t-[2px] border-ink pt-[8px] text-[8.5px] leading-[1.45] text-ink"><div><p class="font-bold">{{fullName}}</p><p class="text-muted">{{jobTitle}}</p></div><p class="tabular-nums">{{mobile}}</p><p>{{email}}</p></div></div>`,
  },
  {
    id: 'cd20', doc: 'business-card', format: 'card-landscape', role: 'card-face', brand: 11,
    intent: 'sober legal card back: serif name, two rows of contacts split by a hairline, no ornament but the logo',
    texts: c('Aurora Machava', 'Advogada · Associada', { phone: '+258 84 000 0000', email: 'aurora@machava.example', website: 'machava.example', address: 'Av. Eduardo Mondlane 120, Beira' }),
    html: `<div class="flex h-full w-full flex-col justify-between bg-ground p-[18px]"><div class="flex items-start justify-between"><div><p class="font-display text-[18px] font-bold leading-[1.05] text-ink">{{fullName}}</p><p class="mt-[3px] text-[9px] italic text-muted">{{jobTitle}}</p></div><idem-logo variant="icon" class="h-[26px]"></idem-logo></div><div class="text-[8.5px] leading-[1.5] text-ink"><div class="flex justify-between border-b border-rule pb-[5px]"><p class="tabular-nums">{{phone}}</p><p>{{email}}</p></div><div class="flex justify-between pt-[5px]"><p>{{address}}</p><p>{{website}}</p></div></div></div>`,
  },
];
