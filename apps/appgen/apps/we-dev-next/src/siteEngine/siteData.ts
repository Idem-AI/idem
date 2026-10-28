/**
 * Les faits du site, écrits par le code dans le projet.
 *
 * Les composants écrits par le modèle n'ont pas à recopier un prix, un
 * téléphone ou un lien : ils importent `site` depuis `@/site/data`. Un fait
 * n'existe donc qu'à un endroit, exact, et une coordonnée ne peut pas être
 * inventée au détour d'un pied de page.
 */

import { resolveHeaderLogo } from '../design/charter.js';
import { ProjectModel } from '../types/project.js';
import type { MediaAsset } from './media/mediaPipeline.js';
import { SiteManifest } from './manifest.js';
import { SiteFacts } from './siteFacts.js';

export interface NavLink {
  label: string;
  href: string;
}

export interface BrandSource {
  path?: string;
  dataUri?: string;
  remote?: string;
  inlineSvg?: string;
}

const literal = (value: unknown): string => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

/** Le menu : les pages d'un site multi-pages, les ancres choisies d'un site d'une page. */
export function navigationOf(manifest: SiteManifest): NavLink[] {
  if (manifest.pages.length > 1) return manifest.pages.map((page) => ({ label: page.label, href: page.path }));
  return manifest.pages[0].sections
    .filter((section, index) => index > 0 && section.navLabel)
    .slice(0, 6)
    .map((section) => ({ label: section.navLabel!, href: `#${section.id}` }));
}

/** L'action principale du site : le premier vrai moyen de contact (WhatsApp, téléphone, e-mail). */
export function primaryActionOf(facts: SiteFacts, language: string): NavLink | null {
  const fr = language === 'fr';
  const channels = facts.channels.filter((channel) => channel.href);
  const whatsapp = channels.find((channel) => channel.href!.startsWith('https://wa.me/'));
  if (whatsapp) return { label: fr ? 'Écrire sur WhatsApp' : 'Message on WhatsApp', href: whatsapp.href! };
  const phone = channels.find((channel) => channel.href!.startsWith('tel:'));
  if (phone) return { label: fr ? 'Appeler' : 'Call us', href: phone.href! };
  const email = channels.find((channel) => channel.href!.startsWith('mailto:'));
  if (email) return { label: fr ? 'Nous écrire' : 'Email us', href: email.href! };
  return channels[0] ? { label: channels[0].label, href: channels[0].href! } : null;
}

/** `src/site/data.ts` */
/** Les valeurs de `@/site/data` (leurs textes forment aussi une part du catalogue des langues). */
export function siteDataOf(facts: SiteFacts, manifest: SiteManifest | null, language: string) {
  return {
    name: facts.name,
    description: facts.description,
    language,
    location: { city: facts.city, country: facts.country },
    contact: {
      phone: facts.phone,
      email: facts.email,
      channels: facts.channels.map((channel) => ({ label: channel.label, value: channel.value, href: channel.href ?? '' })),
    },
    primaryAction: primaryActionOf(facts, language),
    navigation: manifest ? navigationOf(manifest) : [],
    pages: manifest ? manifest.pages.map((page) => ({ label: page.label, href: page.path })) : [{ label: facts.name, href: '/' }],
    offers: facts.offers.map((offer) => ({ name: offer.name, price: offer.price, notes: offer.notes })),
    team: facts.team.map((member) => ({ name: member.name, role: member.role, bio: member.bio, photo: member.photo ?? '' })),
    year: new Date().getFullYear(),
  };
}

export function renderDataModule(facts: SiteFacts, manifest: SiteManifest | null, language: string): string {
  const site = siteDataOf(facts, manifest, language);

  return `/**
 * Les faits du site, posés par IDEM depuis le projet. Importez-les plutôt que
 * de les recopier : un prix, un numéro ou un lien n'existe qu'ici. Leurs textes
 * se lisent dans la langue de la page (\`localize\`, voir \`src/i18n\`).
 */
import { localize } from '@/i18n';

export const site = localize(${literal(site)});

export type Site = typeof site;
`;
}

/** Le type de `site`, résumé pour les prompts (sans les valeurs). */
export function describeDataModule(facts: SiteFacts, manifest: SiteManifest): string {
  const lines = [
    "import { site } from '@/site/data';",
    `site.name · site.description · site.location.city · site.location.country`,
    `site.primaryAction : { label, href } | null${primaryActionOf(facts, 'fr') ? '' : ' (null pour ce projet)'}`,
    `site.navigation : { label, href }[] (${navigationOf(manifest).length} liens) · site.pages : { label, href }[]`,
    `site.contact : { phone, email, channels: { label, value, href }[] } (${facts.channels.length} moyens de contact)`,
    `site.offers : { name, price, notes }[] (${facts.offers.length} offres, prix réels)`,
    `site.team : { name, role, bio, photo }[] (${facts.team.length} personnes)`,
    'site.year : année en cours (mentions du pied de page)',
  ];
  return lines.join('\n');
}

/** `src/site/media.ts` : les visuels produits, par clé. */
export function renderMediaModule(media: Record<string, MediaAsset[]>): string {
  const entries = Object.fromEntries(
    Object.entries(media)
      .filter(([, assets]) => assets.length)
      .map(([key, assets]) => {
        const [first, ...rest] = assets;
        // L'origine sert aux journaux, pas au site.
        const clean = (asset: MediaAsset) => Object.fromEntries(Object.entries(asset).filter(([name]) => name !== 'origin'));
        return rest.length ? [[key, clean(first)], ...rest.map((asset, index) => [`${key}-${index + 2}`, clean(asset)])] : [[key, clean(first)]];
      })
      .flat()
  );

  return `/**
 * Les visuels du site, choisis et produits par IDEM (banque d'images,
 * génération, dessin, motif de la charte). À afficher avec <Media asset={…} />.
 */
import type { MediaAsset } from '@/components/ui/media';

export const media: Record<string, MediaAsset | undefined> = ${literal(entries)};
`;
}

/** `src/site/seo.json` : lu par le pré-rendu (données structurées, plan du site). */
export function renderSeo(facts: SiteFacts, manifest: SiteManifest | null, language: string): string {
  const home = manifest?.pages[0];
  return `${JSON.stringify(
    {
      name: facts.name,
      title: home?.seoTitle || facts.name,
      description: home?.seoDescription || facts.description.slice(0, 160),
      language,
      url: '',
      keywords: manifest?.keywords ?? [],
      business: {
        type: manifest?.businessType || (facts.city || facts.phone ? 'LocalBusiness' : 'Organization'),
        city: facts.city,
        country: facts.country,
        phone: facts.phone,
        email: facts.email,
      },
    },
    null,
    2
  )}\n`;
}

/** `src/site/brand.tsx` : le logo de la charte, posé par le code. */
export function renderBrandModule(projectData: ProjectModel | undefined, name: string, source?: BrandSource): string {
  const declared = resolveHeaderLogo(projectData?.analysisResultModel?.branding?.logo as unknown);
  const src = source ?? (declared ? (declared.startsWith('<') ? { inlineSvg: declared } : { remote: declared }) : {});
  const url = src.path ?? src.dataUri ?? src.remote;

  let body: string;
  let constant = '';
  if (url) {
    constant = `const LOGO_SRC = ${JSON.stringify(url)};\n\n`;
    body = `<img src={LOGO_SRC} alt={BRAND_NAME} className={cn('h-9 w-auto', className)} />`;
  } else if (src.inlineSvg && src.inlineSvg.length <= 20000) {
    constant = `const LOGO_SVG = ${JSON.stringify(src.inlineSvg)};\n\n`;
    body = `<span role="img" aria-label={BRAND_NAME} className={cn('inline-block h-9 [&>svg]:h-full [&>svg]:w-auto', className)} dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />`;
  } else {
    body = `<span className={cn('font-heading text-h4 text-foreground', className)}>{BRAND_NAME}</span>`;
  }

  return `/**
 * La marque du projet, posée par IDEM depuis la charte. <BrandMark /> affiche
 * le logo (ou le nom, sans logo). Hauteur réglable : <BrandMark className="h-12" />.
 */
import { cn } from '@/lib/utils';

${constant}export const BRAND_NAME = ${JSON.stringify(name)};

export default function BrandMark({ className }: { className?: string }) {
  return ${body};
}
`;
}
