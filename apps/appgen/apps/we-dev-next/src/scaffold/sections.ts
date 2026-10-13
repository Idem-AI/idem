/**
 * Kit de sections : la mise en page appartient au code, le contenu au modèle.
 *
 * La trousse de composants (`ui/`) retirait au modèle le dessin d'un bouton.
 * Elle ne lui retirait pas le plus difficile : la *page*. Or c'est là que la
 * qualité se perd, et c'est là qu'un petit modèle échoue le plus — il empile
 * trois cartes identiques, centre tout, et sert la moyenne de son corpus.
 *
 * Ici, chaque section est écrite une fois, en jetons de la charte, responsive
 * et accessible. Le modèle ne fournit que ce qu'il sait faire : les mots et les
 * choix. `<Hero title="…" description="…" primaryCta={…} />` ne peut pas donner
 * un hero bancal, et coûte vingt jetons de sortie au lieu de trois cents.
 *
 * L'anti-monoculture tient toujours : la *variante par défaut* de chaque
 * section vient de la direction artistique tirée au sort par projet. Deux
 * projets ne reçoivent donc pas la même page, même avec le même brief, et sans
 * que le modèle ait à y penser.
 */

import { ArtDirection } from '../design/artDirections.js';

/**
 * Variantes par style de charte (styles du moteur graphique).
 *
 * Éditorial et suisse : grille, filets, lecture en lignes. Minimalisme et
 * surréalisme : peu d'éléments, beaucoup d'air, centré. Les styles plus
 * démonstratifs (pop, Y2K, maximalisme) prennent la grille bento.
 */
const CHARTER_SECTION_DEFAULTS: Record<string, SectionDefaults> = {
  editorial: { hero: 'editorial', features: 'rows', pricing: 'table' },
  swiss: { hero: 'split', features: 'rows', pricing: 'table' },
  minimalism: { hero: 'centered', features: 'rows', pricing: 'table' },
  surreal: { hero: 'centered', features: 'rows', pricing: 'cards' },
  victorian: { hero: 'editorial', features: 'rows', pricing: 'table' },
  'collage-art': { hero: 'editorial', features: 'bento', pricing: 'cards' },
  handwritten: { hero: 'editorial', features: 'cards', pricing: 'cards' },
  bohemian: { hero: 'centered', features: 'cards', pricing: 'cards' },
  retro: { hero: 'split', features: 'cards', pricing: 'cards' },
  'vector-art': { hero: 'split', features: 'bento', pricing: 'cards' },
  clay: { hero: 'centered', features: 'bento', pricing: 'cards' },
  glassmorphism: { hero: 'split', features: 'bento', pricing: 'cards' },
  maximalism: { hero: 'split', features: 'bento', pricing: 'cards' },
  'pop-art': { hero: 'centered', features: 'bento', pricing: 'cards' },
  y2k: { hero: 'centered', features: 'bento', pricing: 'cards' },
  futuristic: { hero: 'split', features: 'bento', pricing: 'table' },
  cyberpunk: { hero: 'split', features: 'bento', pricing: 'table' },
  aurora: { hero: 'centered', features: 'bento', pricing: 'cards' },
  graffiti: { hero: 'centered', features: 'bento', pricing: 'cards' },
  'pixel-art': { hero: 'split', features: 'cards', pricing: 'table' },
};

/** Variante par défaut de chaque section, décidée par la direction artistique. */
export interface SectionDefaults {
  hero: 'split' | 'centered' | 'editorial';
  features: 'bento' | 'rows' | 'cards';
  pricing: 'cards' | 'table';
}

export function sectionDefaults(direction: ArtDirection): SectionDefaults {
  // Direction tirée de la charte (`charter-<style>`) : les variantes suivent le
  // style que la charte, le business plan et le deck appliquent déjà.
  if (direction.id.startsWith('charter-')) {
    return CHARTER_SECTION_DEFAULTS[direction.id.slice('charter-'.length)] ?? {
      hero: 'split',
      features: 'bento',
      pricing: 'cards',
    };
  }

  switch (direction.id) {
    case 'editorial-serif':
      return { hero: 'editorial', features: 'rows', pricing: 'table' };
    case 'swiss-grid':
    case 'precision-product':
      return { hero: 'split', features: 'bento', pricing: 'table' };
    case 'brutalist-block':
    case 'drenched-mono':
      return { hero: 'centered', features: 'rows', pricing: 'cards' };
    default:
      return { hero: 'split', features: 'bento', pricing: 'cards' };
  }
}

/**
 * Les dispositions que le kit sait dessiner, par section. C'est le menu dans
 * lequel l'agent de mise en page choisit : il ne peut rien demander d'autre.
 */
export const KIT_VARIANTS = {
  Hero: ['split', 'centered', 'editorial', 'stacked', 'fullbleed'],
  Features: ['bento', 'cards', 'rows', 'numbered', 'sticky'],
  Split: ['balanced', 'wide', 'inset'],
  Steps: ['columns', 'timeline', 'cards'],
  Pricing: ['cards', 'table'],
  Faq: ['split', 'grid', 'stacked'],
  Cta: ['band', 'split', 'minimal'],
  Contact: ['split', 'cards'],
  Showcase: ['wide', 'overlap'],
  Statement: ['centered', 'rule'],
  Gallery: ['mosaic', 'row'],
} as const;

export type KitSection = keyof typeof KIT_VARIANTS;

/** Les fonds possibles d'une section — tous clairs. */
export const KIT_TONES = ['plain', 'tinted', 'raised'] as const;
export type KitTone = (typeof KIT_TONES)[number];

/**
 * Les sections, en JSX.
 *
 * Règles tenues par le code, donc jamais oubliées : une seule h1 par page,
 * chaque section reliée à son titre, cibles tactiles à 44 px, mesure de
 * lecture plafonnée, grilles qui s'empilent sur téléphone, aucune couleur hors
 * charte, aucun fond sombre. Chaque section accepte `variant` (sa
 * disposition, voir KIT_VARIANTS) et `tone` (son fond) ; les sections à
 * visuel acceptent `media`, une donnée rendue par `Media.jsx`.
 */
export function buildSectionKit(defaults: SectionDefaults): Record<string, string> {
  return {
    'src/sections/Nav.jsx': `import { cn } from '../lib/cn.js';
import BrandMark from '../brand.jsx';
import Link from './Link.jsx';

/**
 * Un lien interne (« /methode ») passe par le routeur, une ancre (« #tarifs »)
 * reste une ancre. Le kit ne connaît donc qu'une seule façon d'écrire un lien,
 * que le site ait une page ou dix.
 */
function NavLink({ href = '#', className, children }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/**
 * Barre de navigation. \`logo\` est un nœud (image de marque ou mot-logo),
 * \`links\` une liste { label, href }, \`cta\` un { label, href }.
 *
 * Le menu du téléphone est un <details> : aucun état, aucune dépendance, et il
 * se ferme au clavier comme à la souris.
 */
export default function Nav({ logo, links = [], cta, className }) {
  return (
    <header className={cn('sticky top-0 z-sticky border-b border-neutral-200 bg-surface/95 backdrop-blur', className)}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-tight px-6 py-tight">
        <a href="/" className="flex min-h-[44px] items-center gap-2 font-display text-lg">
          <BrandMark fallback={logo} />
        </a>

        <nav aria-label="Navigation principale" className="hidden items-center gap-block md:flex">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} className="inline-flex min-h-[44px] items-center text-ink-muted transition-colors hover:text-ink">
              {link.label}
            </NavLink>
          ))}
          {cta && (
            <NavLink href={cta.href} className="inline-flex min-h-[44px] items-center rounded bg-brand-600 px-5 font-medium text-on-brand transition-colors hover:bg-brand-700">
              {cta.label}
            </NavLink>
          )}
        </nav>

        {links.length > 0 && (
          <details className="group relative md:hidden">
            <summary className="grid h-11 w-11 cursor-pointer place-items-center rounded list-none" aria-label="Ouvrir le menu">
              <span aria-hidden="true" className="relative block h-0.5 w-6 bg-ink before:absolute before:-top-2 before:block before:h-0.5 before:w-6 before:bg-ink after:absolute after:top-2 after:block after:h-0.5 after:w-6 after:bg-ink" />
            </summary>
            <nav aria-label="Navigation principale" className="absolute right-0 top-12 w-56 rounded-lg border border-neutral-200 bg-surface-raised p-tight shadow-lg">
              {links.map((link) => (
                <NavLink key={link.href} href={link.href} className="flex min-h-[44px] items-center rounded px-3 text-ink hover:bg-surface">
                  {link.label}
                </NavLink>
              ))}
              {cta && (
                <NavLink href={cta.href} className="mt-tight block min-h-[44px] rounded bg-brand-600 px-3 py-2 text-center font-medium text-on-brand">
                  {cta.label}
                </NavLink>
              )}
            </nav>
          </details>
        )}
      </div>
    </header>
  );
}
`,
    'src/sections/Hero.jsx': `import { cn } from '../lib/cn.js';
import Media from './Media.jsx';
import { toneClass } from './tone.js';

/**
 * Ouverture de la page. Cinq dispositions :
 *
 *   split      texte et visuel côte à côte ;
 *   centered   texte centré, visuel large dessous ;
 *   editorial  titre à gauche, chapeau et actions dans une colonne filetée ;
 *   stacked    très grand titre sur toute la largeur, visuel panoramique ;
 *   fullbleed  le média en fond, le texte sur un voile clair.
 *
 * Le visuel vient de \`media\` (données) ou de \`visual\` (un nœud). Sans
 * visuel, chaque disposition se replie sur une forme qui n'a pas de trou.
 */
export default function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  visual,
  media,
  tone,
  variant = '${defaults.hero}',
  className,
}) {
  const hasActions = Boolean(primaryCta || secondaryCta);
  const actions = hasActions && (
    <div className="flex flex-wrap items-center gap-tight">
      {primaryCta && (
        <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-brand-600 px-7 text-lg font-medium text-on-brand transition-colors hover:bg-brand-700">
          {primaryCta.label}
        </a>
      )}
      {secondaryCta && (
        <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center rounded border border-neutral-300 bg-surface/70 px-7 text-lg font-medium text-ink transition-colors hover:border-neutral-500">
          {secondaryCta.label}
        </a>
      )}
    </div>
  );

  const eyebrowNode = eyebrow && (
    <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>
  );
  const titleNode = (
    <h1 className="font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.08] tracking-tight">{title}</h1>
  );
  const lead = description && <p className="mt-block max-w-measure text-lg text-ink-muted">{description}</p>;

  const hasMedia = Boolean(visual || media);
  const visualNode = visual || <Media media={media} ratio="4/3" priority />;
  const section = cn('px-6 py-section', toneClass(tone), className);

  if (variant === 'fullbleed' && media) {
    return (
      <section id="top" className={cn('relative isolate overflow-hidden', className)}>
        <div className="absolute inset-0 -z-20">
          <Media media={media} fill priority />
        </div>
        {/* Voile clair : le texte reste sombre sur fond clair, comme partout. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-surface/80 md:bg-transparent md:bg-gradient-to-r md:from-surface md:via-surface/90 md:to-surface/10" />
        <div className="mx-auto flex min-h-[78vh] w-full max-w-6xl items-center px-6 py-section">
          <div className="max-w-2xl">
            {eyebrowNode}
            {titleNode}
            {lead}
            {actions && <div className="mt-block">{actions}</div>}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'stacked' || variant === 'fullbleed') {
    return (
      <section id="top" className={cn('px-6 pt-section', !hasMedia && 'pb-section', toneClass(tone), className)}>
        <div className="mx-auto w-full max-w-6xl">
          {eyebrowNode}
          <h1 className="max-w-5xl font-display text-[clamp(2.5rem,6.5vw,5.75rem)] leading-[1.02] tracking-tight">{title}</h1>
          <div className="mt-block grid gap-block md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            {description && <p className="max-w-measure text-lg text-ink-muted">{description}</p>}
            {actions}
          </div>
          {hasMedia && (
            <div className="mt-section pb-section">
              {visual || <Media media={media} ratio="21/9" priority className="rounded-lg" />}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === 'centered') {
    return (
      <section id="top" className={section}>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {eyebrowNode}
          {titleNode}
          {lead}
          {actions && <div className="mt-block">{actions}</div>}
        </div>
        {hasMedia && (
          <div className="mx-auto mt-section w-full max-w-5xl overflow-hidden rounded-lg">
            {visual || <Media media={media} ratio="16/9" priority />}
          </div>
        )}
      </section>
    );
  }

  if (variant === 'editorial') {
    return (
      <section id="top" className={section}>
        <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            {eyebrowNode}
            {titleNode}
            {hasMedia && lead}
            {hasMedia && actions && <div className="mt-block">{actions}</div>}
          </div>
          <div className="border-t border-neutral-200 pt-block md:border-l md:border-t-0 md:pl-block md:pt-0">
            {hasMedia ? (
              <div className="overflow-hidden rounded-lg">{visualNode}</div>
            ) : (
              <>
                {description && <p className="max-w-measure text-lg text-ink-muted">{description}</p>}
                {actions && <div className="mt-block">{actions}</div>}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!hasMedia) {
    return (
      <section id="top" className={section}>
        <div className="mx-auto w-full max-w-4xl">
          {eyebrowNode}
          {titleNode}
          {lead}
          {actions && <div className="mt-block">{actions}</div>}
        </div>
      </section>
    );
  }

  return (
    <section id="top" className={section}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-section md:grid-cols-2">
        <div>
          {eyebrowNode}
          {titleNode}
          {lead}
          {actions && <div className="mt-block">{actions}</div>}
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-surface-raised">{visualNode}</div>
      </div>
    </section>
  );
}
`,
    'src/sections/Features.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Points forts. \`items\` : { title, description, icon? }. Cinq dispositions :
 *
 *   bento     grille dont la première carte est large ;
 *   cards     grille régulière de cartes ;
 *   rows      liste filetée, titre à gauche ;
 *   numbered  grands numéros, deux colonnes ;
 *   sticky    le titre reste en place pendant que la liste défile.
 */
export default function Features({ id, title, intro, items = [], tone, variant = '${defaults.features}', className }) {
  const headingId = (id || 'features') + '-title';
  const section = cn('px-6 py-section', toneClass(tone), className);
  const header = (title || intro) && (
    <div className="mb-section max-w-measure">
      {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
      {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
    </div>
  );

  if (variant === 'sticky') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto grid w-full max-w-6xl gap-section md:grid-cols-[1fr_1.4fr]">
          <div className="md:sticky md:top-24 md:self-start">
            {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
            {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
          </div>
          <ul className="space-y-block">
            {items.map((item) => (
              <li key={item.title} className="rounded-lg border border-neutral-200 bg-surface p-block">
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="mt-tight text-ink-muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (variant === 'numbered') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto w-full max-w-6xl">
          {header}
          <ol className="grid gap-x-section gap-y-block md:grid-cols-2">
            {items.map((item, index) => (
              <li key={item.title} className="flex gap-block border-t border-neutral-200 pt-block">
                <span aria-hidden="true" className="w-14 shrink-0 font-display text-4xl leading-none text-brand-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-xl">{item.title}</h3>
                  <p className="mt-tight text-ink-muted">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  if (variant === 'rows') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto w-full max-w-6xl">
          {header}
          <dl className="divide-y divide-neutral-200">
            {items.map((item) => (
              <div key={item.title} className="grid gap-tight py-block md:grid-cols-[1fr_2fr] md:gap-block">
                <dt className="flex items-center gap-tight font-display text-xl">
                  {item.icon}
                  {item.title}
                </dt>
                <dd className="max-w-measure text-ink-muted">{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }

  const bento = variant === 'bento';

  /**
   * Largeur de chaque carte en colonnes : la première est large, la dernière
   * comble sa ligne. Sans ce calcul, trois atouts laissaient deux trous.
   */
  const spanOf = (index) => {
    if (!bento || items.length < 3) return '';
    if (index === 0) return 'md:col-span-2';
    if (index < items.length - 1) return '';
    const before = 2 + (items.length - 2);
    const free = before % 3 === 0 ? 3 : 3 - (before % 3);
    return free === 3 ? 'md:col-span-3' : free === 2 ? 'md:col-span-2' : '';
  };

  const columns = bento
    ? 'md:grid-cols-3'
    : items.length === 4
      ? 'md:grid-cols-2'
      : 'md:grid-cols-2 lg:grid-cols-3';

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
      <div className="mx-auto w-full max-w-6xl">
        {header}
        <ul className={cn('grid gap-block', columns)}>
          {items.map((item, index) => (
            <li
              key={item.title}
              className={cn('rounded-lg border border-neutral-200 p-block', tone && tone !== 'plain' ? 'bg-surface' : 'bg-surface-raised', spanOf(index))}
            >
              {item.icon && <div className="mb-tight text-brand-600">{item.icon}</div>}
              <h3 className="font-display text-xl">{item.title}</h3>
              <p className="mt-tight text-ink-muted">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Split.jsx': `import { cn } from '../lib/cn.js';
import Media from './Media.jsx';
import { toneClass } from './tone.js';

/**
 * Un argument développé, avec son visuel. Trois dispositions :
 *
 *   balanced  texte et visuel à parts égales ;
 *   wide      le visuel prend la plus grande part ;
 *   inset     le visuel posé dans un panneau teinté, décalé.
 *
 * \`reversed\` inverse les colonnes. Sans visuel, les points clés prennent la
 * seconde colonne, numérotés et filetés : jamais de rectangle vide.
 */
export default function Split({ id, eyebrow, title, description, bullets = [], cta, visual, media, reversed = false, tone, variant = 'balanced', className }) {
  const headingId = (id || 'split') + '-title';
  const section = cn('px-6 py-section', toneClass(tone), className);

  const text = (
    <>
      {eyebrow && <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>}
      <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
      {description && <p className="mt-block max-w-measure text-ink-muted">{description}</p>}
    </>
  );

  const action = cta && (
    <a href={cta.href} className="mt-block inline-flex min-h-[44px] items-center rounded bg-brand-600 px-5 font-medium text-on-brand transition-colors hover:bg-brand-700">
      {cta.label}
    </a>
  );

  const hasMedia = Boolean(visual || media);

  if (!hasMedia) {
    return (
      <section id={id} aria-labelledby={headingId} className={section}>
        <div className="mx-auto grid w-full max-w-6xl gap-section md:grid-cols-2">
          <div className={cn(reversed && 'md:order-2')}>
            {text}
            {action}
          </div>
          {bullets.length > 0 && (
            <ol className={cn('self-start divide-y divide-neutral-200 border-y border-neutral-200', reversed && 'md:order-1')}>
              {bullets.map((bullet, index) => (
                <li key={bullet} className="flex gap-block py-block">
                  <span className="font-mono text-sm text-brand-700">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-ink">{bullet}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    );
  }

  const bulletList = bullets.length > 0 && (
    <ul className="mt-block space-y-2">
      {bullets.map((bullet) => (
        <li key={bullet} className="flex gap-tight text-ink">
          <span aria-hidden="true" className="text-brand-600">—</span>
          {bullet}
        </li>
      ))}
    </ul>
  );

  const grid =
    variant === 'wide'
      ? reversed
        ? 'md:grid-cols-[7fr_5fr]'
        : 'md:grid-cols-[5fr_7fr]'
      : 'md:grid-cols-2';

  const picture = visual || <Media media={media} ratio={variant === 'wide' ? '16/10' : '4/3'} />;

  return (
    <section id={id} aria-labelledby={headingId} className={section}>
      <div className={cn('mx-auto grid w-full max-w-6xl items-center gap-section', grid)}>
        <div className={cn(reversed && 'md:order-2')}>
          {text}
          {bulletList}
          {action}
        </div>
        <div className={cn(reversed && 'md:order-1')}>
          {variant === 'inset' ? (
            <div className={cn('rounded-lg bg-brand-50 p-block md:p-section', reversed ? 'md:-ml-block' : 'md:-mr-block')}>
              <div className="overflow-hidden rounded-lg shadow-sm">{picture}</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg">{picture}</div>
          )}
        </div>
      </div>
    </section>
  );
}
`,
    'src/sections/Steps.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Déroulé en étapes. \`items\` : { title, description }. Trois dispositions :
 * \`columns\` (filet au-dessus de chaque étape), \`timeline\` (ligne verticale
 * et jalons), \`cards\` (cartes numérotées).
 */
export default function Steps({ id, title, intro, items = [], tone, variant = 'columns', className }) {
  const headingId = (id || 'steps') + '-title';
  const section = cn('px-6 py-section', toneClass(tone), className);
  const heading = (title || intro) && (
    <div className="mb-section max-w-measure">
      {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
      {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
    </div>
  );
  const number = (index) => String(index + 1).padStart(2, '0');

  if (variant === 'timeline') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto grid w-full max-w-6xl gap-section md:grid-cols-[1fr_1.5fr]">
          <div>{heading}</div>
          <ol className="ml-1.5 border-l-2 border-brand-600/30">
            {items.map((item, index) => (
              <li key={item.title} className="relative pb-section pl-block last:pb-0">
                <span aria-hidden="true" className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-brand-600" />
                <span className="font-mono text-sm text-brand-700">{number(index)}</span>
                <h3 className="mt-tight font-display text-xl">{item.title}</h3>
                <p className="mt-tight max-w-measure text-ink-muted">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const columns = items.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3';

  if (variant === 'cards') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto w-full max-w-6xl">
          {heading}
          <ol className={cn('grid gap-block', columns)}>
            {items.map((item, index) => (
              <li key={item.title} className={cn('rounded-lg p-block', tone === 'tinted' ? 'bg-surface' : 'bg-brand-50')}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-mono text-sm text-on-brand">{index + 1}</span>
                <h3 className="mt-block font-display text-xl">{item.title}</h3>
                <p className="mt-tight text-ink-muted">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
      <div className="mx-auto w-full max-w-6xl">
        {heading}
        <ol className={cn('grid gap-block', columns)}>
          {items.map((item, index) => (
            <li key={item.title} className="border-t-2 border-brand-600 pt-block">
              <span className="font-mono text-sm text-brand-700">{number(index)}</span>
              <h3 className="mt-tight font-display text-xl">{item.title}</h3>
              <p className="mt-tight text-ink-muted">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
`,
    'src/sections/Testimonials.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/** Paroles de clients. \`items\` : { quote, name, role, avatar? }. */
export default function Testimonials({ id, title, items = [], tone, className }) {
  const headingId = (id || 'testimonials') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', toneClass(tone || 'raised'), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id={headingId} className="mb-section font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
        <ul className={cn('grid gap-block', items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          {items.map((item) => (
            <li key={item.name} className="flex flex-col gap-block rounded-lg border border-neutral-200 bg-surface p-block">
              <blockquote className="max-w-measure text-lg">“{item.quote}”</blockquote>
              <div className="flex items-center gap-tight">
                {item.avatar}
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.role && <p className="text-sm text-ink-muted">{item.role}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Pricing.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Tarifs. \`plans\` : { name, price, period, description, features[], cta, featured }.
 * Variantes : \`cards\`, \`table\` (comparaison en lignes).
 */
export default function Pricing({ id, title, intro, plans = [], variant = '${defaults.pricing}', tone, className }) {
  const headingId = (id || 'pricing') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {(title || intro) && (
          <div className="mb-section max-w-measure">
            {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
            {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
          </div>
        )}

        <ul
          className={cn(
            'grid gap-block',
            variant === 'table'
              ? 'md:grid-cols-1'
              : plans.length === 1
                ? 'md:max-w-xl'
                : plans.length === 2
                  ? 'md:grid-cols-2'
                  : plans.length === 4
                    ? 'md:grid-cols-2 lg:grid-cols-4'
                    : 'md:grid-cols-3',
          )}
        >
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={cn(
                'rounded-lg border bg-surface-raised p-block',
                plan.featured ? 'border-brand-600' : 'border-neutral-200',
                variant === 'table' && 'md:grid md:grid-cols-[1fr_2fr_auto] md:items-center md:gap-block',
              )}
            >
              <div>
                <h3 className="font-display text-xl">{plan.name}</h3>
                <p className="mt-tight">
                  <span className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{plan.price}</span>
                  {plan.period && <span className="text-ink-muted"> /{plan.period}</span>}
                </p>
                {plan.description && <p className="mt-tight text-ink-muted">{plan.description}</p>}
              </div>

              {plan.features?.length > 0 && (
                <ul className={cn('mt-block space-y-1 text-ink-muted', variant === 'table' && 'md:mt-0')}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-tight">
                      <span aria-hidden="true" className="text-brand-600">—</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              {plan.cta && (
                <a
                  href={plan.cta.href}
                  className={cn(
                    'mt-block inline-flex min-h-[44px] items-center justify-center rounded px-5 font-medium transition-colors',
                    plan.featured
                      ? 'bg-brand-600 text-on-brand hover:bg-brand-700'
                      : 'border border-neutral-200 text-ink hover:border-neutral-400',
                    variant === 'table' && 'md:mt-0',
                  )}
                >
                  {plan.cta.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Faq.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Questions fréquentes. \`items\` : { question, answer }. Trois dispositions :
 * \`split\` (titre à gauche, questions repliables à droite), \`grid\` (réponses
 * ouvertes sur deux colonnes), \`stacked\` (une colonne étroite).
 */
export default function Faq({ id, title, items = [], tone, variant = 'split', className }) {
  const headingId = (id || 'faq') + '-title';
  const section = cn('px-6 py-section', toneClass(tone), className);
  const heading = title && (
    <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
  );

  const foldable = (
    <div className="divide-y divide-neutral-200">
      {items.map((item) => (
        <details key={item.question} className="group border-t border-neutral-200 py-block first:border-t-0">
          <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-tight font-medium">
            {item.question}
            <span aria-hidden="true" className="text-brand-600 transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-tight max-w-measure text-ink-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );

  if (variant === 'grid') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-section max-w-measure">{heading}</div>
          <dl className="grid gap-x-section gap-y-block md:grid-cols-2">
            {items.map((item) => (
              <div key={item.question} className="border-t border-neutral-200 pt-block">
                <dt className="font-display text-lg">{item.question}</dt>
                <dd className="mt-tight text-ink-muted">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }

  if (variant === 'stacked') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-block">{heading}</div>
          {foldable}
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={section}>
      <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1fr_2fr]">
        {heading}
        {foldable}
      </div>
    </section>
  );
}
`,
    'src/sections/Cta.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Relance de fin de page. Trois dispositions : \`band\` (bandeau à la couleur
 * de la marque), \`split\` (encadré clair, texte et actions côte à côte),
 * \`minimal\` (grand titre centré, sans fond).
 */
export default function Cta({ id, title, description, primaryCta, secondaryCta, tone, variant = 'band', className }) {
  const headingId = (id || 'cta') + '-title';

  if (variant === 'minimal') {
    return (
      <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', toneClass(tone), className)}>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center border-t border-neutral-200 pt-section text-center">
          <h2 id={headingId} className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-tight">{title}</h2>
          {description && <p className="mt-block max-w-measure text-lg text-ink-muted">{description}</p>}
          <div className="mt-block flex flex-wrap justify-center gap-tight">
            {primaryCta && (
              <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-brand-600 px-7 text-lg font-medium text-on-brand transition-colors hover:bg-brand-700">
                {primaryCta.label}
              </a>
            )}
            {secondaryCta && (
              <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center px-4 text-lg font-medium text-brand-700 underline underline-offset-4 hover:text-brand-600">
                {secondaryCta.label}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', toneClass(tone), className)}>
        <div className={cn('mx-auto grid w-full max-w-6xl gap-block rounded-lg border border-neutral-200 p-section md:grid-cols-[1.4fr_1fr] md:items-center', tone && tone !== 'plain' ? 'bg-surface' : 'bg-surface-raised')}>
          <div>
            <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
            {description && <p className="mt-tight max-w-measure text-ink-muted">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-tight md:justify-end">
            {primaryCta && (
              <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-brand-600 px-7 text-lg font-medium text-on-brand transition-colors hover:bg-brand-700">
                {primaryCta.label}
              </a>
            )}
            {secondaryCta && (
              <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center rounded border border-neutral-300 px-7 text-lg font-medium text-ink transition-colors hover:border-neutral-500">
                {secondaryCta.label}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-block rounded-lg bg-brand-600 p-section text-on-brand md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
          {description && <p className="mt-tight max-w-measure opacity-90">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-tight md:flex-nowrap">
          {primaryCta && (
            <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center whitespace-nowrap rounded bg-on-brand px-7 text-lg font-medium text-brand-600 transition-opacity hover:opacity-90">
              {primaryCta.label}
            </a>
          )}
          {secondaryCta && (
            <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center whitespace-nowrap rounded border border-current px-7 text-lg font-medium text-on-brand transition-opacity hover:opacity-80">
              {secondaryCta.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
`,
    'src/sections/Footer.jsx': `import { cn } from '../lib/cn.js';
import BrandMark from '../brand.jsx';
import Link from './Link.jsx';

function FooterLink({ href = '#', className, children }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/**
 * Pied de page. \`columns\` : { title, links[{label, href}] }.
 * \`logo\` est un nœud, \`legal\` une ligne de mentions.
 */
export default function Footer({ logo, tagline, columns = [], legal, className }) {
  return (
    <footer className={cn('border-t border-neutral-200 px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-section md:grid-cols-[1.5fr_2fr]">
          <div>
            <div className="flex items-center gap-2 font-display text-lg">
              <BrandMark fallback={logo} />
            </div>
            {tagline && <p className="mt-tight max-w-measure text-ink-muted">{tagline}</p>}
          </div>

          <div className="grid gap-block sm:grid-cols-2 md:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="text-sm font-medium uppercase tracking-wide text-ink-muted">{column.title}</h3>
                <ul className="mt-tight space-y-1">
                  {column.links?.map((link) => (
                    <li key={link.href}>
                      <FooterLink href={link.href} className="inline-flex min-h-[40px] items-center text-ink transition-colors hover:text-brand-700">
                        {link.label}
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {legal && <p className="mt-section border-t border-neutral-200 pt-block text-sm text-ink-muted">{legal}</p>}
      </div>
    </footer>
  );
}
`,
    'src/sections/Stats.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/** Chiffres clés. \`items\` : { value, label }. Trois ou quatre, pas davantage. */
export default function Stats({ id, title, items = [], tone, className }) {
  const headingId = (id || 'stats') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('border-y border-neutral-200 px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id={headingId} className="mb-block font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
        <dl className="grid gap-block sm:grid-cols-2 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="sr-only">{item.label}</dt>
              <dd>
                <span className="block font-display text-4xl text-brand-700">{item.value}</span>
                <span className="mt-tight block text-ink-muted">{item.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
`,
    'src/sections/Logos.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Bandeau de confiance. \`items\` : { name, src? } — un nom suffit, le logo est
 * un bonus. Sans image, le nom s'affiche en toutes lettres : mieux qu'un carré
 * gris, et honnête.
 */
export default function Logos({ id, title, items = [], tone, className }) {
  const headingId = (id || 'logos') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-block', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id={headingId} className="mb-block text-center text-sm uppercase tracking-wide text-ink-muted">{title}</h2>}
        <ul className="flex flex-wrap items-center justify-center gap-block">
          {items.map((item) => (
            <li key={item.name} className="text-ink-muted">
              {item.src ? (
                <img src={item.src} alt={item.name} className="h-8 w-auto opacity-70" />
              ) : (
                <span className="font-display text-lg">{item.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Team.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/** Deux initiales, pour une personne sans photo. */
function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** L'équipe. \`items\` : { name, role, bio?, photo? }. */
export default function Team({ id, title, intro, items = [], tone, className }) {
  const headingId = (id || 'team') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {(title || intro) && (
          <div className="mb-section max-w-measure">
            {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
            {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
          </div>
        )}
        <ul
          className={cn(
            'grid gap-block',
            items.length === 2
              ? 'sm:grid-cols-2'
              : items.length === 4
                ? 'sm:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 md:grid-cols-3',
          )}
        >
          {items.map((item) => (
            <li key={item.name}>
              {/* Sans photo, les initiales : un grand rectangle teinté par
                  personne se lisait comme des images qui n'ont pas chargé. */}
              {item.photo ? (
                <img src={item.photo} alt={item.name} className="aspect-[4/5] w-full rounded-lg object-cover" />
              ) : (
                <div aria-hidden="true" className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 font-display text-2xl text-brand-700">
                  {initialsOf(item.name)}
                </div>
              )}
              <h3 className="mt-tight font-display text-xl">{item.name}</h3>
              {item.role && <p className="text-sm text-brand-700">{item.role}</p>}
              {item.bio && <p className="mt-tight text-ink-muted">{item.bio}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Contact.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Prendre contact. \`channels\` : { label, value, href } — téléphone, WhatsApp,
 * courriel, adresse. Deux dispositions : \`split\` (texte à gauche, canaux en
 * liste) et \`cards\` (un canal par carte).
 *
 * Pas de formulaire : un site statique n'a pas de serveur pour le recevoir, et
 * un formulaire qui ne part nulle part est pire que pas de formulaire.
 */
export default function Contact({ id, title, description, channels = [], hours, tone, variant = 'split', className }) {
  const headingId = (id || 'contact') + '-title';
  const section = cn('px-6 py-section', toneClass(tone), className);

  const value = (channel, extra) =>
    channel.href ? (
      <a href={channel.href} className={cn('inline-flex min-h-[44px] items-center font-display text-xl text-ink transition-colors hover:text-brand-700', extra)}>
        {channel.value}
      </a>
    ) : (
      <p className={cn('font-display text-xl', extra)}>{channel.value}</p>
    );

  if (variant === 'cards') {
    return (
      <section id={id} aria-labelledby={headingId} className={section}>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-section max-w-measure">
            <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
            {description && <p className="mt-tight text-lg text-ink-muted">{description}</p>}
            {hours && <p className="mt-tight text-ink-muted">{hours}</p>}
          </div>
          <ul className={cn('grid gap-block', channels.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : channels.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
            {channels.map((channel) => (
              <li key={channel.label} className={cn('min-w-0 rounded-lg border border-neutral-200 p-block', tone && tone !== 'plain' ? 'bg-surface' : 'bg-surface-raised')}>
                <p className="text-sm uppercase tracking-wide text-ink-muted">{channel.label}</p>
                {value(channel, 'mt-tight break-all text-lg')}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={headingId} className={section}>
      <div className="mx-auto grid w-full max-w-6xl gap-section md:grid-cols-[1fr_1fr]">
        <div>
          <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
          {description && <p className="mt-block max-w-measure text-ink-muted">{description}</p>}
          {hours && <p className="mt-block text-ink-muted">{hours}</p>}
        </div>
        <ul className="divide-y divide-neutral-200">
          {channels.map((channel) => (
            <li key={channel.label} className="py-block">
              <p className="text-sm uppercase tracking-wide text-ink-muted">{channel.label}</p>
              {value(channel, 'mt-tight break-words')}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/Showcase.jsx': `import { cn } from '../lib/cn.js';
import Media from './Media.jsx';
import { toneClass } from './tone.js';

/**
 * Vitrine : un grand média et ce qu'il montre. Deux dispositions : \`wide\`
 * (texte en deux colonnes, média panoramique dessous) et \`overlap\` (média
 * large, encadré de texte qui le chevauche). Sans média, la section ne
 * s'affiche pas : une vitrine vide n'a rien à montrer.
 */
export default function Showcase({ id, eyebrow, title, description, media, visual, tone, variant = 'wide', className }) {
  if (!media && !visual) return null;
  const headingId = (id || 'showcase') + '-title';
  const picture = visual || <Media media={media} ratio={variant === 'overlap' ? '16/9' : '21/9'} />;

  if (variant === 'overlap') {
    return (
      <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', toneClass(tone), className)}>
        <div className="relative mx-auto w-full max-w-6xl">
          <div className="overflow-hidden rounded-lg">{picture}</div>
          <div className="relative mx-block -mt-section rounded-lg border border-neutral-200 bg-surface p-block shadow-sm md:absolute md:bottom-block md:left-block md:mx-0 md:mt-0 md:max-w-md">
            {eyebrow && <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>}
            <h2 id={headingId} className="font-display text-2xl leading-tight">{title}</h2>
            {description && <p className="mt-tight text-ink-muted">{description}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-block grid gap-block md:grid-cols-2 md:items-end">
          <div>
            {eyebrow && <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>}
            <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
          </div>
          {description && <p className="max-w-measure text-ink-muted">{description}</p>}
        </div>
        <div className="overflow-hidden rounded-lg">{picture}</div>
      </div>
    </section>
  );
}
`,
    'src/sections/Statement.jsx': `import { cn } from '../lib/cn.js';
import { toneClass } from './tone.js';

/**
 * Une phrase forte, en grand : ce que le projet défend. Deux dispositions :
 * \`centered\` et \`rule\` (filet épais à la couleur de la marque).
 */
export default function Statement({ id, statement, signature, tone, variant = 'centered', className }) {
  if (!statement) return null;
  const section = cn('px-6 py-section', toneClass(tone), className);

  if (variant === 'rule') {
    return (
      <section id={id} className={section}>
        <figure className="mx-auto w-full max-w-5xl border-l-4 border-brand-600 pl-block md:pl-section">
          <blockquote className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-tight">{statement}</blockquote>
          {signature && <figcaption className="mt-block text-ink-muted">{signature}</figcaption>}
        </figure>
      </section>
    );
  }

  return (
    <section id={id} className={section}>
      <figure className="mx-auto w-full max-w-4xl text-center">
        <blockquote className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-tight">{statement}</blockquote>
        {signature && <figcaption className="mt-block text-sm uppercase tracking-wide text-brand-700">{signature}</figcaption>}
      </figure>
    </section>
  );
}
`,
    'src/sections/Gallery.jsx': `import { cn } from '../lib/cn.js';
import Media from './Media.jsx';
import { toneClass } from './tone.js';

/**
 * Galerie : trois ou quatre images. \`images\` : liste de médias. Deux
 * dispositions : \`mosaic\` (la première grande, les autres autour) et \`row\`
 * (une rangée régulière). Moins de trois images : la section ne s'affiche pas.
 */
export default function Gallery({ id, title, intro, images = [], tone, variant = 'mosaic', className }) {
  if (images.length < 3) return null;
  const headingId = (id || 'gallery') + '-title';

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', toneClass(tone), className)}>
      <div className="mx-auto w-full max-w-6xl">
        {(title || intro) && (
          <div className="mb-section max-w-measure">
            {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
            {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
          </div>
        )}
        {variant === 'row' ? (
          <ul className={cn('grid gap-block sm:grid-cols-2', images.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
            {images.map((image, index) => (
              <li key={image.src + index} className="overflow-hidden rounded-lg">
                <Media media={image} ratio="4/5" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-block md:grid-cols-3 md:grid-rows-2">
            {images.slice(0, 3).map((image, index) => (
              <li key={image.src + index} className={cn('overflow-hidden rounded-lg', index === 0 && 'md:col-span-2 md:row-span-2')}>
                {/* La grande image prend la hauteur des deux petites : sans
                    ratio propre sur grand écran, elle ne pousse pas la grille. */}
                {index === 0 ? (
                  <Media media={image} ratio={null} className="aspect-[4/3] md:aspect-auto md:h-full" />
                ) : (
                  <Media media={image} ratio="3/2" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
`,
    'src/sections/Media.jsx': `import { cn } from '../lib/cn.js';

/**
 * Un média de section, décrit par des données (jamais du JSX écrit par un
 * modèle) : \`{ kind, src, alt, poster, fit, ground, tile }\`.
 *
 *   image    photo (Pexels ou générée), recadrée pour remplir le cadre ;
 *   drawing  illustration (dessinée en SVG ou générée), affichée entière ;
 *   video    clip court, muet, en boucle ; l'affiche le remplace si
 *            l'utilisateur a demandé moins d'animations ;
 *   pattern  le motif de la charte, en tuile.
 *
 * \`fill\` : le média remplit son parent (fond de hero) au lieu d'imposer un
 * ratio.
 */
export default function Media({ media, ratio = '4/3', fill = false, priority = false, className }) {
  if (!media || !media.kind) return null;

  const frame = cn('relative w-full overflow-hidden', fill ? 'h-full' : '', className);
  // \`ratio={null}\` : la hauteur vient du parent ou des classes (mosaïque).
  const style = fill || !ratio ? undefined : { aspectRatio: ratio };

  if (media.kind === 'pattern') {
    return (
      <div
        aria-hidden="true"
        className={frame}
        style={{
          ...style,
          backgroundColor: media.ground,
          backgroundImage: 'url(' + media.src + ')',
          backgroundSize: (media.tile || 160) + 'px ' + (media.tile || 160) + 'px',
        }}
      />
    );
  }

  if (media.kind === 'video') {
    return (
      <div className={frame} style={style}>
        {media.poster && (
          <img src={media.poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <video
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          src={media.src}
          poster={media.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      </div>
    );
  }

  const drawing = media.kind === 'drawing';
  return (
    <div className={cn(frame, drawing && 'bg-brand-50')} style={style}>
      <img
        src={media.src}
        alt={media.alt || ''}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn('absolute inset-0 h-full w-full', drawing ? 'object-contain p-block' : 'object-cover')}
      />
    </div>
  );
}
`,
    'src/sections/tone.js': `/**
 * Le fond d'une section. Toujours clair : un site vitrine IDEM reste sur des
 * surfaces claires, le rythme vient de l'alternance uni / teinté / relief.
 */
export function toneClass(tone) {
  if (tone === 'tinted') return 'bg-brand-50';
  if (tone === 'raised') return 'bg-surface-raised';
  return '';
}
`,
    'src/sections/index.js': `export { default as Contact } from './Contact.jsx';
export { default as Cta } from './Cta.jsx';
export { default as Faq } from './Faq.jsx';
export { default as Features } from './Features.jsx';
export { default as Footer } from './Footer.jsx';
export { default as Gallery } from './Gallery.jsx';
export { default as Hero } from './Hero.jsx';
export { default as Logos } from './Logos.jsx';
export { default as Media } from './Media.jsx';
export { default as Nav } from './Nav.jsx';
export { default as Pricing } from './Pricing.jsx';
export { default as Showcase } from './Showcase.jsx';
export { default as Split } from './Split.jsx';
export { default as Statement } from './Statement.jsx';
export { default as Stats } from './Stats.jsx';
export { default as Steps } from './Steps.jsx';
export { default as Team } from './Team.jsx';
export { default as Testimonials } from './Testimonials.jsx';
`,
  };
}
