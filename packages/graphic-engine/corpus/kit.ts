/** Les ossatures répétitives des pages du corpus (le pied de page, la page A4 qui s'étire). Le reste est écrit page par page. */
export const FOOT = `<footer class="mt-auto flex items-center justify-between border-t border-rule pt-[10px] text-[10px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></footer>`;

/** Une page A4 de document : un corps qui s'étire, le pied de page ancré en bas. */
export const flow = (body: string): string => `<div class="flex min-h-[273mm] flex-col">\n${body}\n${FOOT}\n</div>`;

/** L'en-tête de page de document : sur-titre, filet de marque, titre. */
export const flowHead = (rule = 'border-brand-primary', titleSize = 32): string =>
  `<header class="border-b-[2px] ${rule} pb-[12px]"><p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">{{kicker}}</p><h2 class="mt-[6px] font-display text-[${titleSize}px] font-bold leading-[1.08] text-ink">{{title}}</h2></header>`;

export const folio = (label: string, n: number): string => `${label} · ${String(n).padStart(2, '0')}`;

/** Une diapositive : fond, ossature `relative`, pied (logo + folio) ancré en bas. `deep` : fond profond de la marque. */
export const slide = (body: string, tone: 'light' | 'deep' = 'light'): string =>
  tone === 'deep'
    ? `<div class="relative h-full w-full overflow-hidden bg-deep text-on-deep">\n${body}\n<div class="absolute bottom-[22px] left-[56px] right-[56px] flex items-center justify-between text-[11px] text-on-deep/70"><idem-logo variant="onDark" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></div>\n</div>`
    : `<div class="relative h-full w-full overflow-hidden bg-ground">\n${body}\n<div class="absolute bottom-[22px] left-[56px] right-[56px] flex items-center justify-between text-[11px] text-muted"><idem-logo variant="primary" class="h-[22px]"></idem-logo><span class="tabular-nums">{{folio}}</span></div>\n</div>`;

/** Une page de charte (A4 fixe) : en-tête (rubrique, folio), corps qui s'étire, pied avec le logo. */
export const charter = (body: string, tone: 'light' | 'deep' = 'light'): string =>
  tone === 'deep'
    ? `<div class="flex h-full w-full flex-col bg-deep px-[56px] py-[48px] text-on-deep"><header class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>\n${body}\n</div>`
    : `<div class="flex h-full w-full flex-col bg-ground px-[56px] py-[48px]"><header class="flex items-center justify-between border-b border-rule pb-[10px] text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>\n${body}\n<footer class="flex items-center justify-between border-t border-rule pt-[10px]"><idem-logo variant="primary" class="h-[20px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></footer></div>`;

/** Une page de charte PAYSAGE (A4 à l'italienne, fixe) : même ossature que `charter`, marges adaptées à la largeur. */
export const charterL = (body: string, tone: 'light' | 'deep' = 'light'): string =>
  tone === 'deep'
    ? `<div class="flex h-full w-full flex-col bg-deep px-[52px] py-[36px] text-on-deep"><header class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>\n${body}\n</div>`
    : `<div class="flex h-full w-full flex-col bg-ground px-[52px] py-[36px]"><header class="flex items-center justify-between border-b border-rule pb-[8px] text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><span>{{kicker}}</span><span class="tabular-nums">{{folio}}</span></header>\n${body}\n<footer class="flex items-center justify-between border-t border-rule pt-[8px]"><idem-logo variant="primary" class="h-[18px]"></idem-logo><span class="text-[10px] text-muted">{{brandline}}</span></footer></div>`;
