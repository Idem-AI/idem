/**
 * LES PAGES D'ACTIF — une page qui MONTRE un actif de la marque (le logo et sa description, l'icône, une
 * déclinaison, les motifs, des mockups de réseaux) est dessinée par le CODE, sans modèle, à tous les crans :
 *
 *   le titre, puis l'actif en TRÈS GRAND sur toute la place qui reste — rien d'autre.
 *
 * Décision de l'utilisateur (15/10/2026) après plusieurs chartes où l'auteur ajoutait des tuiles inventées, des
 * cadres autour des mockups, des aplats à la place des motifs et des logos minuscules : sur ces pages, l'essentiel
 * est garanti par le code. Les textes et adresses restent des clés (`{{…}}`) : la page se rejoue comme une autre.
 */
import type { Block, SectionContent } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import type { DesignTokens } from '../design-system/tokens';
import { bestContrast } from '../foundation/color';

/** Les blocs qui SONT des actifs à montrer (les spécimens exacts de la palette et de l'échelle typographique compris). */
const ASSET_KINDS = new Set<Block['kind']>(['logoDisplay', 'logoStory', 'mockupShowcase', 'patternGrid', 'swatches', 'typeScale']);

/** Une page d'actif : une toile fixe dont tous les blocs sont des actifs (un seul bloc). */
export function isAssetPage(section: SectionContent, format: FormatDef): boolean {
  return format.kind === 'fixed' && (format.family === 'slide' || format.family === 'document') && section.blocks.length === 1 && ASSET_KINDS.has(section.blocks[0].kind);
}

const GROUND: Record<string, string> = { light: 'bg-raised', dark: 'bg-deep', neutral: 'bg-sunken' };

function header(section: SectionContent, format: FormatDef, compact = false): string {
  const size = Math.round(format.width * (compact ? 0.032 : 0.03));
  return `<header class="flex shrink-0 items-start justify-between gap-[24px]">
  <div class="min-w-0">${section.kicker ? `<p class="mb-[8px] text-[${Math.max(11, Math.round(size * 0.36))}px] font-semibold uppercase tracking-[0.14em] text-brand-primary">{{kicker}}</p>` : ''}<h2 class="font-display text-[${size}px] font-bold leading-[1.05] text-ink">{{title}}</h2>${section.lede ? `<p class="mt-[10px] max-w-[60ch] text-[${Math.max(13, Math.round(size * 0.46))}px] leading-[1.45] text-muted">{{lede}}</p>` : ''}</div>
  <idem-logo variant="primary" class="h-[${Math.max(16, Math.round(format.width * 0.018))}px] shrink-0"></idem-logo>
</header>`;
}

/** Le code de la page d'actif (les mêmes clés et primitives que celui d'un auteur). */
export function assetPageTemplate(section: SectionContent, format: FormatDef, tokens?: DesignTokens): string {
  const block = section.blocks[0];
  const pad = 'p-[5%]';
  const portrait = format.orientation === 'portrait';

  if (block.kind === 'logoStory') {
    // Le logo, très grand, et sa description à côté (ou dessous, en portrait) : courte, en points.
    const points = block.points
      .map((_, i) => `<li><p class="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-primary">{{${block.id}.points.${i}.label}}</p><p class="mt-[4px] text-[15px] leading-[1.5] text-muted">{{${block.id}.points.${i}.text}}</p></li>`)
      .join('');
    const logo = `<div class="flex min-h-0 items-center justify-center ${GROUND[block.background] ?? 'bg-raised'} ${portrait ? 'h-[48%] w-full' : 'h-full w-[58%]'}"><img src="{{${block.id}.url}}" alt="" class="max-h-[58%] max-w-[72%] object-contain"></div>`;
    const text = `<div class="flex min-h-0 w-full flex-col justify-center ${portrait ? 'pt-[6%]' : 'pl-[10%]'}">${header({ ...section }, format, true).replace('<idem-logo variant="primary" class="', '<idem-logo variant="primary" class="hidden ')}<ul class="mt-[28px] flex flex-col gap-[18px]">${points}</ul></div>`;
    return `<div class="flex h-full w-full ${portrait ? 'flex-col' : 'flex-row'} bg-ground">${logo}<div class="flex min-h-0 ${portrait ? 'flex-1 px-[7%] pb-[6%]' : 'flex-1 py-[6%] pr-[5%]'}">${text}</div></div>`;
  }

  let stage = '';
  if (block.kind === 'logoDisplay') {
    // Un logo par panneau, sur le fond pour lequel il est fait ; un seul : il prend toute la scène.
    const one = block.variants.length === 1;
    stage = `<div class="grid h-full w-full gap-[20px] ${portrait && !one ? 'grid-rows-' + block.variants.length : 'grid-cols-' + block.variants.length}">${block.variants
      .map(
        (v, i) =>
          `<figure class="flex min-h-0 flex-col gap-[10px]"><div class="flex min-h-0 flex-1 items-center justify-center ${GROUND[v.background] ?? 'bg-raised'}"><img src="{{${block.id}.variants.${i}.url}}" alt="" class="${one ? 'max-h-[52%] max-w-[58%]' : 'max-h-[46%] max-w-[72%]'} object-contain"></div>${one ? '' : `<figcaption class="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{{${block.id}.variants.${i}.label}}</figcaption>`}</figure>`
      )
      .join('')}</div>`;
  } else if (block.kind === 'patternGrid') {
    // Les motifs eux-mêmes, en grandes tuiles répétées, avec leur nom — rien d'autre.
    const n = block.patterns.length;
    const cols = n <= 3 ? n : portrait ? 2 : n === 4 ? 4 : 3;
    stage = `<div class="grid h-full w-full grid-cols-${cols} gap-[20px]">${block.patterns
      .map((_, i) => `<figure class="flex min-h-0 flex-col gap-[10px]"><idem-pattern-tile data-block="${block.id}" data-index="${i}" class="min-h-0 flex-1"></idem-pattern-tile><figcaption class="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{{${block.id}.patterns.${i}.name}}</figcaption></figure>`)
      .join('')}</div>`;
  } else if (block.kind === 'swatches') {
    // Les couleurs en grands aplats ; leur nom, leur code et leur rôle dessous (à côté, en portrait).
    stage = `<div class="flex h-full w-full ${portrait ? 'flex-col' : 'flex-row'} gap-[16px]">${block.items
      .map((item, i) => {
        const ink = bestContrast(item.hex, ['#FFFFFF', '#111111']);
        return portrait
          ? `<div class="flex min-h-0 flex-1 items-center gap-[24px]"><div class="h-full w-[38%] border border-rule bg-[${item.hex}]"></div><div class="min-w-0"><p class="text-[18px] font-semibold text-ink">{{${block.id}.items.${i}.name}}</p><p class="mt-[4px] text-[14px] uppercase tracking-[0.08em] text-muted">{{${block.id}.items.${i}.hex}}</p>${item.role ? `<p class="mt-[4px] text-[13px] text-muted">{{${block.id}.items.${i}.role}}</p>` : ''}</div></div>`
          : `<div class="flex min-w-0 flex-1 flex-col border border-rule bg-[${item.hex}] p-[18px] text-[${ink}]"><div class="mt-auto"><p class="text-[18px] font-semibold">{{${block.id}.items.${i}.name}}</p><p class="mt-[4px] text-[14px] uppercase tracking-[0.08em]">{{${block.id}.items.${i}.hex}}</p>${item.role ? `<p class="mt-[6px] text-[13px] leading-[1.35]">{{${block.id}.items.${i}.role}}</p>` : ''}</div></div>`;
      })
      .join('')}</div>`;
  } else if (block.kind === 'typeScale') {
    // L'échelle à ses tailles RÉELLES (celles des autres pages du document), une ligne par degré.
    const display = (tokens?.font.display ?? '').toLowerCase();
    stage = `<div class="flex h-full w-full flex-col ${portrait ? 'justify-start gap-[36px]' : 'justify-between'}">${block.levels
      .map((level, i) => {
        const size = tokens?.size[level.step] ?? 16;
        const family = level.family.toLowerCase() === display ? 'font-display' : 'font-body';
        return `<div class="flex min-h-0 items-baseline gap-[4%] border-t border-rule pt-[1.2%]"><div class="w-[24%] shrink-0"><p class="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-primary">{{${block.id}.levels.${i}.label}}</p><p class="mt-[4px] text-[12px] text-muted">{{${block.id}.levels.${i}.family}} · ${level.weight} · ${Math.round(size)} px</p>${level.usage ? `<p class="mt-[2px] text-[12px] text-muted">{{${block.id}.levels.${i}.usage}}</p>` : ''}</div><p class="min-w-0 ${family} font-[${level.weight}] text-[${size}px] leading-[1.1] text-ink">{{${block.id}.levels.${i}.sample}}</p></div>`;
      })
      .join('')}</div>`;
  } else if (block.kind === 'mockupShowcase') {
    // Les mockups ENTIERS, sans cadre ni légende : ils sont la démonstration.
    stage = `<idem-gallery data-block="${block.id}" data-labels="none" class="h-full"></idem-gallery>`;
  }
  return `<div class="flex h-full w-full flex-col bg-ground ${pad}">${header(section, format)}<div class="mt-[4%] min-h-0 flex-1">${stage}</div></div>`;
}
