import type { CorpusPage } from './types';

/** Couvertures de profil (Facebook 1640×624, LinkedIn 1128×191, X 1500×500, YouTube 2560×1440) — le sens vit dans la zone sûre (20). */
const FB = 'absolute left-[22%] right-[14%] top-[16%] bottom-[20%]';
const LI = 'absolute left-[30%] right-[6%] top-[16%] bottom-[16%]';
const XX = 'absolute left-[32%] right-[6%] top-[16%] bottom-[16%]';
const YT = 'absolute left-[24%] right-[24%] top-[14%] bottom-[14%]';

export const PAGES: CorpusPage[] = [
  {
    id: 'pc01', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 3,
    intent: 'Facebook cover: brand-colour ground, one bold line and a delivery promise in the safe area, logo at the right',
    texts: { title: 'Le marché du Bénin, livré chez vous', sub: 'Commandez avant 18 h, recevez le lendemain matin' },
    html: `<div class="relative h-full w-full bg-brand-primary text-on-brand"><div class="${FB} flex items-center justify-between gap-[40px]"><div><p class="font-display text-[84px] font-bold leading-[1.02]">{{title}}</p><p class="mt-[16px] text-[30px]">{{sub}}</p></div><idem-logo variant="onDark" class="h-[110px] shrink-0"></idem-logo></div></div>`,
  },
  {
    id: 'pc02', doc: 'profile-cover', format: 'cover-linkedin', role: 'visual', brand: 7,
    intent: 'LinkedIn banner: a thin deep band, the company statement on one line and the website at the right, safe area only',
    texts: { title: 'Digital savings groups for West Africa', url: 'osusu.example' },
    html: `<div class="relative h-full w-full bg-deep text-on-deep"><div class="${LI} flex items-center justify-between gap-[24px]"><p class="font-display text-[34px] font-bold leading-[1.05]">{{title}}</p><p class="shrink-0 text-[22px] font-bold text-brand-accent">{{url}}</p></div></div>`,
  },
  {
    id: 'pc03', doc: 'profile-cover', format: 'cover-x', role: 'visual', brand: 10,
    intent: 'X header: a photograph full width, a small caption block with the studio name in the safe area',
    texts: { title: 'Wild Lens', sub: 'Wildlife photography · Nanyuki, Kenya' },
    images: { 'hero.url': 'photo:#ffd166,#e07a3f,#1d3a2a' },
    html: `<div class="relative h-full w-full"><img src="{{hero.url}}" alt="" class="absolute inset-0 h-full w-full object-cover"><div class="${XX} flex items-end"><div class="bg-ground/95 px-[34px] py-[22px]"><p class="font-display text-[56px] font-bold leading-[1] text-ink">{{title}}</p><p class="mt-[6px] text-[22px] text-muted">{{sub}}</p></div></div></div>`,
  },
  {
    id: 'pc04', doc: 'profile-cover', format: 'cover-youtube', role: 'visual', brand: 8,
    intent: 'YouTube channel art: the channel name huge and centred in the all-device safe area, a one-line schedule beneath',
    texts: { title: 'Code Thiès TV', sub: 'Un cours de code, chaque mardi et jeudi à 19 h' },
    html: `<div class="relative h-full w-full bg-brand-primary text-on-brand"><div class="${YT} flex flex-col items-center justify-center text-center"><idem-logo variant="onDark" class="mb-[50px] h-[170px]"></idem-logo><p class="font-display text-[210px] font-black leading-[0.95] tracking-[-0.03em]">{{title}}</p><p class="mt-[40px] text-[64px] font-semibold">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc05', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 11, style: 'pop-art',
    intent: 'Facebook cover with a hand-drawn circle pattern across the left (clear of text) and the shop name on paper at the right',
    texts: { title: 'Capulana Viva', sub: 'Moda em capulana · Maputo · entregas em todo o país' },
    html: `<div class="relative h-full w-full bg-ground"><div class="absolute inset-y-0 left-0 w-[22%] bg-brand-primary"><idem-pattern kind="hand-circles" density="0.8" class="absolute inset-0"></idem-pattern></div><div class="absolute inset-y-0 right-0 w-[14%] bg-brand-accent"></div><div class="${FB} flex flex-col justify-center"><p class="font-display text-[110px] font-black leading-[0.92] text-ink">{{title}}</p><p class="mt-[18px] text-[32px] text-muted">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc06', doc: 'profile-cover', format: 'cover-linkedin', role: 'visual', brand: 6,
    intent: 'LinkedIn banner on the brand colour: a three-word value line separated by thin rules, nothing else',
    texts: { a: 'Faster', b: 'Traceable', c: 'Paid on delivery' },
    html: `<div class="relative h-full w-full bg-brand-primary text-on-brand"><div class="${LI} flex items-center justify-between gap-[20px] font-display text-[34px] font-bold"><span>{{a}}</span><span class="h-[40px] w-px bg-on-brand/50"></span><span>{{b}}</span><span class="h-[40px] w-px bg-on-brand/50"></span><span>{{c}}</span></div></div>`,
  },
  {
    id: 'pc07', doc: 'profile-cover', format: 'cover-x', role: 'visual', brand: 0,
    intent: 'X header: a split of paper and brand colour with the headline sentence on the paper side and the number on the colour side',
    texts: { title: 'Cashew, shelled where it grows', fig: '420', lbl: 'partner farmers' },
    html: `<div class="relative h-full w-full bg-ground"><div class="absolute inset-y-0 right-0 w-[26%] bg-brand-primary"></div><div class="${XX} flex items-center"><p class="max-w-[620px] font-display text-[62px] font-bold leading-[1.02] text-ink">{{title}}</p></div><div class="absolute inset-y-0 right-[2%] flex w-[22%] flex-col items-center justify-center text-on-brand"><p class="font-display text-[110px] font-black leading-none tabular-nums">{{fig}}</p><p class="text-[22px] font-semibold">{{lbl}}</p></div></div>`,
  },
  {
    id: 'pc08', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 2,
    intent: 'Facebook cover with a forest photograph full bleed and a translucent panel carrying the lodge name and booking line in the safe area',
    texts: { title: 'Lopé Écolodge', sub: 'Réservez votre séjour : 14 chambres au bord de l’Ogooué' },
    images: { 'hero.url': 'photo:#9fd3a8,#355e3b,#1b2e20' },
    html: `<div class="relative h-full w-full"><img src="{{hero.url}}" alt="" class="absolute inset-0 h-full w-full object-cover"><div class="${FB} flex items-center"><div class="bg-ground/92 px-[44px] py-[30px]"><p class="font-display text-[84px] font-bold leading-[1] text-brand-primary">{{title}}</p><p class="mt-[12px] text-[30px] text-ink">{{sub}}</p></div></div></div>`,
  },
  {
    id: 'pc09', doc: 'profile-cover', format: 'cover-youtube', role: 'visual', brand: 10,
    intent: 'YouTube banner with a dark ground and a flow texture, the channel name and a three-item topic list in the central safe area',
    texts: { title: 'Wild Lens Films', 't0': 'Safaris', 't1': 'Behind the shot', 't2': 'Conservation' },
    html: `<div class="relative h-full w-full overflow-hidden bg-deep text-on-deep"><idem-pattern kind="flow" density="0.7" class="absolute inset-0 opacity-100"></idem-pattern><div class="${YT} flex flex-col items-center justify-center text-center"><p class="font-display text-[220px] font-black leading-[0.95] tracking-[-0.03em]">{{title}}</p><div class="mt-[60px] flex gap-[60px] text-[64px] font-bold text-brand-accent"><span>{{t0}}</span><span>{{t1}}</span><span>{{t2}}</span></div></div></div>`,
  },
  {
    id: 'pc10', doc: 'profile-cover', format: 'cover-linkedin', role: 'visual', brand: 4,
    intent: 'LinkedIn banner on paper with a fine brand rule under a single large line of wordmark-style type',
    texts: { title: 'Bark & Co. — made by hand in Kampala' },
    html: `<div class="relative h-full w-full bg-ground"><div class="${LI} flex flex-col justify-center"><p class="font-display text-[40px] font-bold leading-[1.05] text-ink">{{title}}</p><div class="mt-[8px] h-[4px] w-[90px] bg-brand-primary"></div></div></div>`,
  },
  {
    id: 'pc11', doc: 'profile-cover', format: 'cover-x', role: 'visual', brand: 6,
    intent: 'X header: bright accent ground, the product claim huge in ink, three tiny facts in a row beneath it',
    texts: { title: 'Pharmacy delivery that keeps its word', 'f0': '40 minutes', 'f1': '12 districts', 'f2': 'Live tracking' },
    html: `<div class="relative h-full w-full bg-brand-accent text-on-accent"><div class="${XX} flex flex-col justify-center"><p class="font-display text-[70px] font-black leading-[0.98] tracking-[-0.02em]">{{title}}</p><div class="mt-[22px] flex gap-[34px] text-[26px] font-bold"><span>{{f0}}</span><span>{{f1}}</span><span>{{f2}}</span></div></div></div>`,
  },
  {
    id: 'pc12', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 9,
    intent: 'Facebook cover with a photograph on the right third and the harvest announcement in the safe area on the brand colour',
    texts: { title: 'Récolte 2026 : arabica lavé, lots de 60 kg', sub: 'Échantillons gratuits sur demande' },
    images: { 'hero.url': 'photo:#d9a441,#5b3a29,#2f6b4f' },
    html: `<div class="relative h-full w-full bg-brand-primary text-on-brand"><img src="{{hero.url}}" alt="" class="absolute inset-y-0 right-0 h-full w-[30%] object-cover"><div class="${FB} flex flex-col justify-center" style="right:34%"><p class="font-display text-[76px] font-bold leading-[1.02]">{{title}}</p><p class="mt-[16px] text-[30px] font-semibold text-brand-accent">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc13', doc: 'profile-cover', format: 'cover-youtube', role: 'visual', brand: 5, style: 'maximalism',
    intent: 'YouTube channel art: a bold accent field with the channel name in huge condensed capitals and the upload rhythm beneath',
    texts: { title: 'BRAZZA MODE', sub: 'Tutoriels de couture · nouvelle vidéo chaque samedi' },
    html: `<div class="relative h-full w-full bg-brand-accent text-on-accent"><div class="${YT} flex flex-col items-center justify-center text-center"><p class="font-display text-[300px] font-black uppercase leading-[0.9] tracking-[-0.02em]">{{title}}</p><p class="mt-[50px] text-[64px] font-bold">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc14', doc: 'profile-cover', format: 'cover-linkedin', role: 'visual', brand: 1,
    intent: 'LinkedIn banner on a deep ground: a short mission line left of centre and a single accent word, minimal',
    texts: { title: 'Soil data for every smallholder farm', url: 'soilsense.example' },
    html: `<div class="relative h-full w-full bg-deep text-on-deep"><div class="${LI} flex items-center justify-between gap-[20px]"><p class="font-display text-[34px] font-bold leading-[1.05]">{{title}}</p><p class="shrink-0 text-[20px] font-bold text-brand-accent">{{url}}</p></div></div>`,
  },
  {
    id: 'pc15', doc: 'profile-cover', format: 'cover-x', role: 'visual', brand: 11,
    intent: 'X header with a hand-drawn line pattern as a full-width texture on the brand colour and the shop line in the safe area',
    texts: { title: 'Capulana, cortada em Maputo', sub: 'Encomendas por WhatsApp' },
    html: `<div class="relative h-full w-full overflow-hidden bg-brand-primary text-on-brand"><idem-pattern kind="hand-lines" density="0.6" class="absolute inset-0"></idem-pattern><div class="${XX} flex flex-col justify-center"><p class="font-display text-[68px] font-black leading-[0.98]">{{title}}</p><p class="mt-[14px] text-[28px] font-semibold">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc16', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 8,
    intent: 'Facebook cover with three stacked numbers in the safe area on paper (campus, students, placements) and a brand bar at the left edge',
    texts: { 'n0.v': '3', 'n0.l': 'campus', 'n1.v': '840', 'n1.l': 'élèves formés', 'n2.v': '92 %', 'n2.l': 'en stage ou en emploi' },
    html: `<div class="relative h-full w-full bg-ground"><div class="absolute inset-y-0 left-0 w-[8%] bg-brand-primary"></div><div class="${FB} flex items-center justify-between gap-[30px]"><div><p class="whitespace-nowrap font-display text-[120px] font-black leading-none tabular-nums text-brand-primary">{{n0.v}}</p><p class="text-[30px] font-bold text-ink">{{n0.l}}</p></div><div><p class="whitespace-nowrap font-display text-[120px] font-black leading-none tabular-nums text-brand-primary">{{n1.v}}</p><p class="text-[30px] font-bold text-ink">{{n1.l}}</p></div><div><p class="whitespace-nowrap font-display text-[120px] font-black leading-none tabular-nums text-brand-primary">{{n2.v}}</p><p class="text-[30px] font-bold text-ink">{{n2.l}}</p></div></div></div>`,
  },
  {
    id: 'pc17', doc: 'profile-cover', format: 'cover-youtube', role: 'visual', brand: 7,
    intent: 'YouTube banner on paper: channel name in the centre of the safe area, a thick brand bar crossing the lower edge outside it',
    texts: { title: 'Osusu Explains', sub: 'Money, saving and mobile payments in plain words' },
    html: `<div class="relative h-full w-full bg-ground"><div class="absolute inset-x-0 bottom-0 h-[10%] bg-brand-primary"></div><div class="${YT} flex flex-col items-center justify-center text-center"><idem-logo variant="primary" class="mb-[50px] h-[150px]"></idem-logo><p class="font-display text-[200px] font-black leading-[0.95] tracking-[-0.03em] text-ink">{{title}}</p><p class="mt-[40px] text-[62px] text-muted">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc18', doc: 'profile-cover', format: 'cover-linkedin', role: 'visual', brand: 10,
    intent: 'LinkedIn banner with a photograph strip across the full width and the studio name on a solid label in the safe area',
    texts: { title: 'Wild Lens — wildlife photography' },
    images: { 'hero.url': 'photo:#ffd166,#e07a3f,#1d3a2a' },
    html: `<div class="relative h-full w-full"><img src="{{hero.url}}" alt="" class="absolute inset-0 h-full w-full object-cover"><div class="${LI} flex items-center"><p class="bg-ground/95 px-[22px] py-[10px] font-display text-[32px] font-bold text-ink">{{title}}</p></div></div>`,
  },
  {
    id: 'pc19', doc: 'profile-cover', format: 'cover-x', role: 'visual', brand: 3,
    intent: 'X header: deep ground with a left-aligned headline and an accent rule, opening hours in small type under it',
    texts: { title: 'Frais. Local. Livré.', sub: 'Du lundi au samedi, 7 h – 19 h · Cotonou' },
    html: `<div class="relative h-full w-full bg-deep text-on-deep"><div class="${XX} flex flex-col justify-center"><p class="font-display text-[96px] font-black leading-[0.95]">{{title}}</p><div class="my-[18px] h-[5px] w-[110px] bg-brand-accent"></div><p class="text-[28px]">{{sub}}</p></div></div>`,
  },
  {
    id: 'pc20', doc: 'profile-cover', format: 'cover-facebook', role: 'visual', brand: 4, style: 'collage-art',
    intent: 'Facebook cover with a photograph of the product at the right and the shop promise on a brand-colour block in the safe area',
    texts: { title: 'Bark cloth, cut and sewn in Kampala', sub: 'Free delivery over UGX 150,000' },
    images: { 'hero.url': 'photo:#d4a373,#9c4a1a,#2b2d42' },
    html: `<div class="relative h-full w-full bg-ground"><img src="{{hero.url}}" alt="" class="absolute inset-y-0 right-0 h-full w-[32%] object-cover"><div class="${FB} flex items-center" style="right:36%"><div class="bg-brand-primary p-[36px] text-on-brand"><p class="font-display text-[68px] font-bold leading-[1.02]">{{title}}</p><p class="mt-[12px] text-[28px] font-semibold">{{sub}}</p></div></div></div>`,
  },
];
