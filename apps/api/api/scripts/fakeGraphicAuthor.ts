/**
 * Un AUTEUR SIMULÉ pour les contrôles qui rendent de vraies pages sans appeler de modèle : il lit le contenu
 * donné à l'auteur (les clés `{{…}}` et les primitives) et écrit une page Tailwind simple, aux couleurs de la
 * marque — une colonne pour les pages qui s'allongent (A4), une toile pleine pour les autres. Déterministe.
 */
import { AgentCall, configureGraphicEngine } from '@idem/graphic-engine';

export function fakePage(user: string): string {
  const keys = [...user.matchAll(/^\{\{([\w.:-]+)\}\} = /gm)].map((m) => m[1]).filter((k) => !['kicker', 'title', 'lede'].includes(k));
  const prims = [...user.matchAll(/<idem-(chart|table) data-block="([^"]+)">/g)].map((m) => `<section class="mt-[18px]"><idem-${m[1]} data-block="${m[2]}" data-aspect="16/9" class="w-full text-[12px] text-ink [&_th]:bg-brand-primary [&_th]:text-on-brand"></idem-${m[1]}></section>`);
  const texts = keys.map((k) => (k.endsWith('.url') || k.endsWith('Url') ? `<img src="{{${k}}}" alt="" class="mt-[12px] h-[120px] w-auto object-contain">` : `<p class="mt-[10px] text-[14px] leading-[1.55] text-ink">{{${k}}}</p>`));
  const header = `<header class="border-b-[3px] border-brand-primary pb-[12px]"><p class="text-[11px] uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p><h2 class="font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2></header><p class="mt-[14px] text-[16px] text-muted">{{lede}}</p>`;
  const footer = `<footer data-keep-together class="mt-[24px] flex items-center justify-between border-t border-rule pt-[8px]"><idem-logo class="h-[16px]"></idem-logo><span class="text-[10px] text-muted">{{title}}</span></footer>`;
  if (/A4 page that GROWS/.test(user)) return `\`\`\`html\n${header}\n${texts.map((t) => `<div>${t}</div>`).join('\n')}\n${prims.join('\n')}\n${footer}\n\`\`\``;
  return `\`\`\`html\n<div class="relative flex h-full w-full flex-col gap-[8px] overflow-hidden bg-ground p-[5%]"><div class="relative">${header}${texts.join('')}${prims.join('')}</div><idem-logo class="mt-auto h-[28px]"></idem-logo></div>\n\`\`\``;
}

export const fakeAuthorCall: AgentCall = async ({ role, user }) =>
  role === 'graphic.director'
    ? /PAGES:/.test(user)
      ? `IDEA: Calm editorial grid, figures first.\n${[...user.matchAll(/^(\d+)\. /gm)].map((m) => `PAGE ${m[1]}: title band, then the content in reading order`).join('\n')}`
      : 'LANGUAGE:\n- A brand-primary rule under every title, ink text on the ground, generous margins, logo bottom-left.'
    : fakePage(user);

/** Branche l'auteur simulé sur le moteur graphique (à appeler avant toute page). */
export function useFakeGraphicAuthor(): void {
  configureGraphicEngine({ agentCall: () => fakeAuthorCall });
}
