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

/** Variante par défaut de chaque section, décidée par la direction artistique. */
export interface SectionDefaults {
  hero: 'split' | 'centered' | 'editorial';
  features: 'bento' | 'rows' | 'cards';
  pricing: 'cards' | 'table';
}

export function sectionDefaults(direction: ArtDirection): SectionDefaults {
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
        <a href="#top" className="flex min-h-[44px] items-center gap-2 font-display text-lg">
          <BrandMark fallback={logo} />
        </a>

        <nav aria-label="Navigation principale" className="hidden items-center gap-block md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-[44px] items-center text-ink-muted transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
          {cta && (
            <a href={cta.href} className="inline-flex min-h-[44px] items-center rounded bg-brand-600 px-5 font-medium text-white transition-colors hover:bg-brand-700">
              {cta.label}
            </a>
          )}
        </nav>

        {links.length > 0 && (
          <details className="group relative md:hidden">
            <summary className="grid h-11 w-11 cursor-pointer place-items-center rounded list-none" aria-label="Ouvrir le menu">
              <span aria-hidden="true" className="relative block h-0.5 w-6 bg-ink before:absolute before:-top-2 before:block before:h-0.5 before:w-6 before:bg-ink after:absolute after:top-2 after:block after:h-0.5 after:w-6 after:bg-ink" />
            </summary>
            <nav aria-label="Navigation principale" className="absolute right-0 top-12 w-56 rounded-lg border border-neutral-200 bg-surface-raised p-tight shadow-lg">
              {links.map((link) => (
                <a key={link.href} href={link.href} className="flex min-h-[44px] items-center rounded px-3 text-ink hover:bg-surface">
                  {link.label}
                </a>
              ))}
              {cta && (
                <a href={cta.href} className="mt-tight block min-h-[44px] rounded bg-brand-600 px-3 py-2 text-center font-medium text-white">
                  {cta.label}
                </a>
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
        <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-brand-600 px-7 text-lg font-medium text-white transition-colors hover:bg-brand-700">
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

  const heading = (
    <>
      {eyebrow && <p className="mb-tight text-sm font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>}
      {/* clamp plutôt qu'un cran de l'échelle : certaines directions montent à
          90 px, ce qui donne un titre de cinq lignes dans une demi-colonne. */}
      <h1 className="font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.08] tracking-tight">{title}</h1>
      {description && <p className="mt-block max-w-measure text-lg text-ink-muted">{description}</p>}
    </>
  );

  if (variant === 'centered') {
    return (
      <section id="top" className={cn('px-6 py-section', className)}>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {heading}
          <div className="mt-block">{actions}</div>
          {visual && <div className="mt-section w-full">{visual}</div>}
        </div>
      </section>
    );
  }

  if (variant === 'editorial') {
    return (
      <section id="top" className={cn('px-6 py-section', className)}>
        <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            {heading}
            <div className="mt-block">{actions}</div>
          </div>
          <div className="border-t border-neutral-200 pt-block md:border-l md:border-t-0 md:pl-block md:pt-0">
            {visual}
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
          <div className="mt-block">{actions}</div>
        </div>
      </section>
    );
  }

  return (
    <section id="top" className={cn('px-6 py-section', className)}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-section md:grid-cols-2">
        <div>
          {heading}
          <div className="mt-block">{actions}</div>
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
export default function Features({ title, intro, items = [], variant = '${defaults.features}', className }) {
  const header = (title || intro) && (
    <div className="mb-section max-w-measure">
      {title && <h2 id="features-title" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
      {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
    </div>
  );

  if (variant === 'rows') {
    return (
      <section aria-labelledby={title ? 'features-title' : undefined} className={cn('px-6 py-section', className)}>
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
    <section aria-labelledby={title ? 'features-title' : undefined} className={cn('px-6 py-section', className)}>
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
export default function Steps({ title, items = [], className }) {
  return (
    <section aria-labelledby={title ? 'steps-title' : undefined} className={cn('px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id="steps-title" className="mb-section font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
        <ol className="grid gap-block md:grid-cols-3">
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
export default function Testimonials({ title, items = [], className }) {
  return (
    <section aria-labelledby={title ? 'testimonials-title' : undefined} className={cn('bg-surface-raised px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title && <h2 id="testimonials-title" className="mb-section font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
        <ul className="grid gap-block md:grid-cols-2">
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
export default function Pricing({ title, intro, plans = [], variant = '${defaults.pricing}', className }) {
  return (
    <section aria-labelledby={title ? 'pricing-title' : undefined} className={cn('px-6 py-section', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {(title || intro) && (
          <div className="mb-section max-w-measure">
            {title && <h2 id="pricing-title" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
            {intro && <p className="mt-tight text-lg text-ink-muted">{intro}</p>}
          </div>
        )}

        <ul className={cn('grid gap-block', variant === 'table' ? 'md:grid-cols-1' : 'md:grid-cols-3')}>
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
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
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
export default function Faq({ title, items = [], className }) {
  return (
    <section aria-labelledby={title ? 'faq-title' : undefined} className={cn('px-6 py-section', className)}>
      {/* Deux colonnes plutôt qu'un bloc centré : toutes les autres sections
          commencent au même bord gauche, et une seule section centrée au milieu
          de la page se lit comme un accident de mise en page. */}
      <div className="mx-auto grid w-full max-w-6xl gap-block md:grid-cols-[1fr_2fr]">
        {title && <h2 id="faq-title" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>}
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
export default function Cta({ title, description, primaryCta, secondaryCta, className }) {
  return (
    <section aria-labelledby="cta-title" className={cn('px-6 py-section', className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-block rounded-lg bg-brand-600 p-section text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="cta-title" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">{title}</h2>
          {description && <p className="mt-tight max-w-measure text-white/90">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-tight">
          {primaryCta && (
            <a href={primaryCta.href} className="inline-flex min-h-[52px] items-center rounded bg-white px-7 text-lg font-medium text-brand-700 transition-opacity hover:opacity-90">
              {primaryCta.label}
            </a>
          )}
          {secondaryCta && (
            <a href={secondaryCta.href} className="inline-flex min-h-[52px] items-center rounded border border-white/40 px-7 text-lg font-medium text-white transition-colors hover:border-white">
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
                      <a href={link.href} className="inline-flex min-h-[40px] items-center text-ink transition-colors hover:text-brand-700">
                        {link.label}
                      </a>
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
    'src/sections/index.js': `export { default as Cta } from './Cta.jsx';
export { default as Faq } from './Faq.jsx';
export { default as Features } from './Features.jsx';
export { default as Footer } from './Footer.jsx';
export { default as Hero } from './Hero.jsx';
export { default as Nav } from './Nav.jsx';
export { default as Pricing } from './Pricing.jsx';
export { default as Steps } from './Steps.jsx';
export { default as Testimonials } from './Testimonials.jsx';
`,
  };
}
