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
 * Les sections, en JSX.
 *
 * Règles tenues par le code, donc jamais oubliées : une seule `<h1>` par page,
 * chaque section reliée à son titre par `aria-labelledby`, cibles tactiles à
 * 44 px, mesure de lecture plafonnée, grilles qui s'empilent sur téléphone, et
 * aucune couleur hors charte.
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

/**
 * Hero. Variantes : \`split\` (texte + visuel), \`centered\`, \`editorial\`.
 * La variante par défaut vient de la direction artistique du projet.
 *
 * \`visual\` est un nœud libre (image, capture, composition). Sans visuel, la
 * variante split affiche un panneau tonal plutôt qu'un vide.
 */
export default function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  visual,
  variant = '${defaults.hero}',
  className,
}) {
  const actions = (
    <div className="flex flex-wrap items-center gap-tight">
      {primaryCta && (
        <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-brand-600 px-7 text-lg font-medium text-on-brand transition-colors hover:bg-brand-700">
          {primaryCta.label}
        </a>
      )}
      {secondaryCta && (
        <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center rounded border border-neutral-200 px-7 text-lg font-medium text-ink transition-colors hover:border-neutral-400">
          {secondaryCta.label}
        </a>
      )}
    </div>
  );

  const headline = (
    <>
      {eyebrow && <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>}
      {/* clamp plutôt qu'un cran de l'échelle : certaines directions montent à
          90 px, ce qui donne un titre de cinq lignes dans une demi-colonne. */}
      <h1 className="font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.08] tracking-tight">{title}</h1>
    </>
  );
  const lead = description && <p className="mt-block max-w-measure text-lg text-ink-muted">{description}</p>;
  const heading = (
    <>
      {headline}
      {lead}
    </>
  );
  const hasActions = Boolean(primaryCta || secondaryCta);

  if (variant === 'centered') {
    return (
      <section id="top" className={cn('px-6 py-section', className)}>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {heading}
          {hasActions && <div className="mt-block">{actions}</div>}
          {visual && <div className="mt-section w-full">{visual}</div>}
        </div>
      </section>
    );
  }

  if (variant === 'editorial') {
    // Sans visuel, la colonne filetée porte le chapeau et les actions : la
    // mise en page de presse tient, et aucune colonne ne reste vide.
    return (
      <section id="top" className={cn('px-6 py-section', className)}>
        <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            {visual ? heading : headline}
            {visual && hasActions && <div className="mt-block">{actions}</div>}
          </div>
          <div className="border-t border-neutral-200 pt-block md:border-l md:border-t-0 md:pl-block md:pt-0">
            {visual || (
              <>
                {description && <p className="max-w-measure text-lg text-ink-muted">{description}</p>}
                {hasActions && <div className="mt-block">{actions}</div>}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Sans visuel, la colonne de droite serait un rectangle vide — le défaut le
  // plus visible d'un hero généré. On passe alors à une colonne unique, qui se
  // lit comme un choix.
  if (!visual) {
    return (
      <section id="top" className={cn('px-6 py-section', className)}>
        <div className="mx-auto w-full max-w-4xl">
          {heading}
          {hasActions && <div className="mt-block">{actions}</div>}
        </div>
      </section>
    );
  }

  return (
    <section id="top" className={cn('px-6 py-section', className)}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-section md:grid-cols-2">
        <div>
          {heading}
          {hasActions && <div className="mt-block">{actions}</div>}
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-surface-raised">{visual}</div>
      </div>
    </section>
  );
}
`,
    'src/sections/Features.jsx': `import { cn } from '../lib/cn.js';

/**
 * Atouts. \`items\` : { title, description, icon? } — \`icon\` est un nœud.
 * Variantes : \`bento\` (première carte large), \`rows\`, \`cards\`.
 *
 * La variante bento casse volontairement la grille régulière : trois cartes de
 * même largeur sont la signature d'une page générée.
 */
export default function Features({ id, title, intro, items = [], variant = '${defaults.features}', className }) {
  const headingId = (id || 'features') + '-title';
  const header = (title || intro) && (
    <div className="mb-section max-w-measure">
      {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
      {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
    </div>
  );

  if (variant === 'rows') {
    return (
      <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
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
   * Largeur de chaque carte en colonnes.
   *
   * La première est large — c'est ce qui distingue un bento d'une rangée de
   * cartes identiques — et la dernière comble sa ligne. Sans ce calcul, trois
   * atouts donnent une ligne pleine puis une carte seule avec deux trous à
   * droite, ce qui est pire que la grille régulière que l'on cherchait à fuir.
   */
  const spanOf = (index) => {
    if (!bento || items.length < 3) return '';
    if (index === 0) return 'md:col-span-2';
    if (index < items.length - 1) return '';

    // Cellules occupées avant la dernière carte : 2 pour la première, 1 pour
    // chacune des autres. Ce qui reste de la ligne revient à la dernière.
    const before = 2 + (items.length - 2);
    const free = before % 3 === 0 ? 3 : 3 - (before % 3);
    return free === 3 ? 'md:col-span-3' : free === 2 ? 'md:col-span-2' : '';
  };

  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {header}
        <ul className={cn('grid gap-block', bento ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3')}>
          {items.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                'rounded-lg border border-neutral-200 bg-surface-raised p-block',
                spanOf(index),
              )}
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
    'src/sections/Steps.jsx': `import { cn } from '../lib/cn.js';

/** Déroulé en étapes. \`items\` : { title, description }. */
export default function Steps({ id, title, items = [], className }) {
  const headingId = (id || 'steps') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id={headingId} className="mb-section font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
        <ol className={cn('grid gap-block', items.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')}>
          {items.map((item, index) => (
            <li key={item.title} className="border-t-2 border-brand-600 pt-block">
              <span className="font-mono text-sm text-brand-700">{String(index + 1).padStart(2, '0')}</span>
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

/** Paroles de clients. \`items\` : { quote, name, role, avatar? }. */
export default function Testimonials({ id, title, items = [], className }) {
  const headingId = (id || 'testimonials') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('bg-surface-raised px-6 py-section', className)}>
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

/**
 * Tarifs. \`plans\` : { name, price, period, description, features[], cta, featured }.
 * Variantes : \`cards\`, \`table\` (comparaison en lignes).
 */
export default function Pricing({ id, title, intro, plans = [], variant = '${defaults.pricing}', className }) {
  const headingId = (id || 'pricing') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
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

/** Questions fréquentes. \`items\` : { question, answer }. Ouverture native. */
export default function Faq({ id, title, items = [], className }) {
  const headingId = (id || 'faq') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
      {/* Deux colonnes plutôt qu'un bloc centré : toutes les autres sections
          commencent au même bord gauche, et une seule section centrée au milieu
          de la page se lit comme un accident de mise en page. */}
      <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1fr_2fr]">
        {title && <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
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
      </div>
    </section>
  );
}
`,
    'src/sections/Cta.jsx': `import { cn } from '../lib/cn.js';

/** Bande de conversion, en fin de page. */
export default function Cta({ id, title, description, primaryCta, secondaryCta, className }) {
  const headingId = (id || 'cta') + '-title';
  return (
    <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-block rounded-lg bg-brand-600 p-section text-on-brand md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id={headingId} className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
          {description && <p className="mt-tight max-w-measure opacity-90">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-tight">
          {primaryCta && (
            <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-on-brand px-7 text-lg font-medium text-brand-600 transition-opacity hover:opacity-90">
              {primaryCta.label}
            </a>
          )}
          {secondaryCta && (
            <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center rounded border border-current px-7 text-lg font-medium text-on-brand transition-opacity hover:opacity-80">
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
    'src/sections/Split.jsx': `import { cn } from '../lib/cn.js';

/**
 * Un argument développé : texte + visuel, côte à côte. \`reversed\` inverse
 * les colonnes.
 *
 * C'est la section qui donne de la longueur à un site sans le rendre bavard :
 * deux ou trois Split qui alternent racontent un produit bien mieux qu'une
 * grille de cartes de plus.
 *
 * Sans visuel, les points clés prennent la seconde colonne, numérotés et
 * filetés. Un rectangle teinté à la place d'une image se lisait comme une
 * image qui n'a pas chargé.
 */
export default function Split({ id, eyebrow, title, description, bullets = [], cta, visual, reversed = false, className }) {
  const headingId = (id || 'split') + '-title';

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

  if (!visual) {
    return (
      <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', className)}>
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

  return (
    <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', className)}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-section md:grid-cols-2">
        <div className={cn(reversed && 'md:order-2')}>
          {text}
          {bullets.length > 0 && (
            <ul className="mt-block space-y-2">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-tight text-ink">
                  <span aria-hidden="true" className="text-brand-600">—</span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}
          {action}
        </div>
        <div className={cn('overflow-hidden rounded-lg', reversed && 'md:order-1')}>{visual}</div>
      </div>
    </section>
  );
}
`,
    'src/sections/Stats.jsx': `import { cn } from '../lib/cn.js';

/** Chiffres clés. \`items\` : { value, label }. Trois ou quatre, pas davantage. */
export default function Stats({ id, title, items = [], className }) {
  const headingId = (id || 'stats') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('border-y border-neutral-200 px-6 py-section', className)}>
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

/**
 * Bandeau de confiance. \`items\` : { name, src? } — un nom suffit, le logo est
 * un bonus. Sans image, le nom s'affiche en toutes lettres : mieux qu'un carré
 * gris, et honnête.
 */
export default function Logos({ id, title, items = [], className }) {
  const headingId = (id || 'logos') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-block', className)}>
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
export default function Team({ id, title, intro, items = [], className }) {
  const headingId = (id || 'team') + '-title';
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('px-6 py-section', className)}>
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

/**
 * Prendre contact. \`channels\` : { label, value, href } — téléphone, WhatsApp,
 * courriel, adresse.
 *
 * Pas de formulaire par défaut : un site statique n'a pas de serveur pour le
 * recevoir, et un formulaire qui ne part nulle part est pire que pas de
 * formulaire. Les canaux, eux, fonctionnent depuis un téléphone.
 */
export default function Contact({ id, title, description, channels = [], hours, className }) {
  const headingId = (id || 'contact') + '-title';
  return (
    <section id={id} aria-labelledby={headingId} className={cn('px-6 py-section', className)}>
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
              {channel.href ? (
                <a href={channel.href} className="mt-tight inline-flex min-h-[44px] items-center font-display text-xl text-ink transition-colors hover:text-brand-700">
                  {channel.value}
                </a>
              ) : (
                <p className="mt-tight font-display text-xl">{channel.value}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
    'src/sections/index.js': `export { default as Contact } from './Contact.jsx';
export { default as Cta } from './Cta.jsx';
export { default as Faq } from './Faq.jsx';
export { default as Features } from './Features.jsx';
export { default as Footer } from './Footer.jsx';
export { default as Hero } from './Hero.jsx';
export { default as Logos } from './Logos.jsx';
export { default as Nav } from './Nav.jsx';
export { default as Pricing } from './Pricing.jsx';
export { default as Split } from './Split.jsx';
export { default as Stats } from './Stats.jsx';
export { default as Steps } from './Steps.jsx';
export { default as Team } from './Team.jsx';
export { default as Testimonials } from './Testimonials.jsx';
`,
  };
}
