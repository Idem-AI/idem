/**
 * LE RELEVÉ DU SITE À REFAIRE, côté moteur — sa forme (la même que `apps/ivision/core/src/site/site-crawler.ts`,
 * relevé par l'API IDEM, fichiers déjà recopiés chez nous) et ce que chaque agent en reçoit :
 *
 *   l'architecte   le plan : chaque page et chaque section, avec un identifiant (`p2.s3`) qu'il doit placer ;
 *   un auteur      le contenu INTÉGRAL des sections d'origine qu'on lui confie, avec leurs boutons et images ;
 *   le garde-fou   tout le texte du site : rien de ce qu'il dit n'est une invention.
 */

export interface InventoryImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  kind: 'img' | 'background';
  /**
   * Mesurée par le code à la recopie (`packages/design-tools/src/image-quality.ts`) : `width`/`height` sont alors
   * ceux du fichier recopié. Absente des relevés antérieurs au 21/11/2026.
   */
  quality?: { softness: number; blockiness: number; photo: boolean; issues: ('blurry' | 'blocky')[] };
  /** Regardée à la recopie par le modèle de vision (API `SiteImport/siteImageReading.ts`) ; absente avant le 25/11/2026. */
  vision?: ImageReading;
  /** Le texte qui appartient à cette image sur l'ancien site (légende, carte) : voir `binding.ts`. Depuis le 26/11/2026. */
  caption?: string;
}

/** Ce que montre une image de l'ancien site, lu à la recopie (même forme que `apps/ivision/core/src/site/site-crawler.ts`). */
export interface ImageReading {
  description: string;
  kind: 'photo' | 'illustration' | '3d' | 'logo' | 'icon' | 'screenshot' | 'text' | 'decorative';
  people: boolean;
  text: boolean;
  generic: boolean;
  flaws: string[];
}

/**
 * Une image de l'ancien site telle que l'agent média la voit : un identifiant court (`i3`), ce qu'elle montre, sa
 * forme et sa netteté (mesurées par le code), les sections qui la montraient. Les logos, icônes, captures et fonds
 * décoratifs n'y figurent pas : ils n'illustrent jamais une section.
 */
export interface LibraryImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  reading: ImageReading;
  /** Les sections d'origine qui la montraient (`p0.s1`). */
  from: string[];
  /** Défaut mesuré par le code (flou, blocs JPEG). */
  issues: string[];
  /** Le texte qui l'accompagnait (nom sous une photo d'équipe, titre d'un projet) : elle va avec cet élément-là. */
  caption?: string;
}

/**
 * Les images LIÉES d'une section : au moins deux images, chacune avec sa propre légende (photos d'équipe sous leur
 * nom, projets sous leur titre). Elles vont avec leur élément : jamais triées, jamais prêtées à une autre section.
 */
export function boundImages<T extends InventoryImage>(images: T[]): T[] {
  const captioned = images.filter((image) => image.caption);
  return captioned.length >= 2 && new Set(captioned.map((image) => image.caption)).size === captioned.length ? captioned : [];
}

const ILLUSTRATING: ImageReading['kind'][] = ['photo', 'illustration', '3d'];

/**
 * LE MANIFESTE DES IMAGES DE L'ANCIEN SITE, ou `null` quand le relevé n'a pas été regardé (relevé antérieur, vision
 * indisponible) : la refonte reprend alors les images comme avant, chacune dans sa section d'origine.
 */
export function siteImageLibrary(inventory: SiteInventory): LibraryImage[] | null {
  const byUrl = new Map<string, LibraryImage>();
  let seen = 0;
  let read = 0;
  for (const page of inventory.pages)
    for (const section of page.sections)
      for (const image of section.images) {
        const known = byUrl.get(image.url);
        if (known) {
          if (!known.from.includes(section.id)) known.from.push(section.id);
          continue;
        }
        seen += 1;
        const bound = boundImages(section.images).includes(image);
        if (image.vision) read += 1;
        // Une image liée (photo d'équipe de 100 px, trop petite pour être regardée) reste dans le manifeste : sa
        // légende dit ce qu'elle montre, et elle doit rester avec son élément.
        if (!image.vision && !bound) continue;
        if (image.vision && !ILLUSTRATING.includes(image.vision.kind) && !bound) continue;
        const reading: ImageReading = image.vision ?? { description: `Image shown with « ${image.caption} » on the old site`, kind: 'photo', people: false, text: false, generic: false, flaws: [] };
        byUrl.set(image.url, {
          id: `i${byUrl.size + 1}`,
          url: image.url,
          alt: image.alt,
          width: image.width,
          height: image.height,
          reading,
          from: [section.id],
          issues: image.quality?.issues ?? [],
          ...(image.caption ? { caption: image.caption } : {}),
        });
      }
  // Moins de la moitié des images regardées : le manifeste mentirait sur l'ancien site, la règle d'avant reste.
  if (!seen || read < seen / 2) return null;
  return [...byUrl.values()];
}

/**
 * Le rang d'une image dans sa section : la plus grande et la plus nette en tête. La première image d'une section
 * est celle que le design montre en grand (héros, visuel principal) : une vignette floue n'y a pas sa place quand
 * une meilleure image de la même section existe. L'ordre du site d'origine départage les égalités.
 */
export function imageRank(image: InventoryImage): number {
  const pixels = Math.min(image.width * image.height, 2400 * 1600) / (2400 * 1600);
  return pixels - (image.quality?.issues.length ?? 0) * 0.25;
}

/**
 * Les images d'une section, de la meilleure à la moins bonne (tri stable). Des images LIÉES (`boundImages`) gardent
 * l'ordre de l'ancien site : chacune va avec son élément, la plus nette n'a pas à passer devant.
 */
export function bestFirst<T extends InventoryImage>(images: T[]): T[] {
  const bound = boundImages(images);
  if (bound.length) return [...bound, ...images.filter((image) => !bound.includes(image))];
  return images
    .map((image, index) => ({ image, index, rank: imageRank(image) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.image);
}

export interface InventoryCta {
  label: string;
  href: string;
  kind: 'internal' | 'external' | 'phone' | 'email' | 'whatsapp' | 'anchor';
}

export interface InventorySection {
  id: string;
  headings: string[];
  texts: string[];
  items: string[];
  ctas: InventoryCta[];
  images: InventoryImage[];
  form?: string[];
  videos?: string[];
}

export interface InventoryPage {
  url: string;
  path: string;
  title: string;
  description?: string;
  sections: InventorySection[];
}

/** Une langue de l'ancien site ; `widget` : proposée par un traducteur automatique, sans page vraiment traduite. */
export interface SiteLanguage {
  code: string;
  url?: string;
  via: 'html' | 'hreflang' | 'switcher' | 'path' | 'widget';
}

export interface SiteInventory {
  origin: string;
  language: string;
  /** Absent des relevés antérieurs aux langues. */
  languages?: SiteLanguage[];
  pages: InventoryPage[];
  skipped: { url: string; label: string }[];
  navigation: { label: string; href: string }[];
  /** Les boutons d'action de l'en-tête, hors du menu (relevés depuis le 22/11/2026). */
  headerActions?: { label: string; href: string }[];
  footer: { texts: string[]; links: { label: string; href: string }[] };
  contact: { phones: string[]; emails: string[]; whatsapp: string[]; addresses: string[]; socials: { network: string; url: string }[] };
  assets: { favicon?: string; appleIcon?: string; ogImage?: string; images: (InventoryImage & { page: string; section: string })[] };
  /** La technologie de l'ancien site et ce que le relevé a fait pour elle (relevés depuis le 19/11/2026). */
  technology?: { family: string; names: string[]; adaptations: string[] };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Toutes les sections du relevé, par identifiant. */
export function sectionIndex(inventory: SiteInventory): Map<string, { page: InventoryPage; section: InventorySection }> {
  const map = new Map<string, { page: InventoryPage; section: InventorySection }>();
  for (const page of inventory.pages) for (const section of page.sections) map.set(section.id, { page, section });
  return map;
}

/**
 * LA FORME QU'AVAIT UNE SECTION SUR L'ANCIEN SITE, devinée par le code d'après ce qu'elle contient (aucun modèle) :
 * une liste illustrée était une grille de cartes, une image et du texte un bloc « texte + image »… Dite à
 * l'architecte, et vérifiée après lui (`departFromOld`, manifest.ts) : une refonte ne remet pas le même contenu dans
 * la même forme. Les identifiants sont ceux des compositions du manifeste (`LAYOUTS`).
 */
export type OldShape = 'cards' | 'features' | 'gallery' | 'split-media' | 'intro' | 'cta-band' | 'form';

const SHAPE_LABEL: Record<OldShape, [string, string]> = {
  cards: ['grille de cartes', 'grid of cards'],
  features: ['liste ou grille d’éléments', 'list or grid of items'],
  gallery: ['galerie d’images', 'image gallery'],
  'split-media': ['texte à côté d’une image', 'copy beside an image'],
  intro: ['bloc de texte', 'block of copy'],
  'cta-band': ['bandeau avec un bouton', 'band with a button'],
  form: ['formulaire', 'form'],
};

export function oldShapeOf(s: InventorySection): OldShape | null {
  const images = s.images.length;
  const items = s.items.length;
  if (s.form?.length) return 'form';
  if (images >= 4 && items <= images) return 'gallery';
  if (items >= 3 && images >= 2) return 'cards';
  if (items >= 3) return 'features';
  if (images >= 1 && s.texts.length >= 1) return 'split-media';
  if (!images && !items && s.ctas.length && s.texts.length <= 1) return 'cta-band';
  if (!images && s.texts.length >= 1) return 'intro';
  return null;
}

/** La forme de chaque section d'origine, par identifiant (`p0.s3` → `cards`). */
export function oldShapes(inventory: SiteInventory): Record<string, OldShape> {
  const out: Record<string, OldShape> = {};
  for (const page of inventory.pages) for (const s of page.sections) {
    const shape = oldShapeOf(s);
    if (shape) out[s.id] = shape;
  }
  return out;
}

/** Le plan donné à l'architecte : une ligne par section, assez pour la placer, pas tout son texte. */
export function inventoryOutline(inventory: SiteInventory, fr: boolean): string {
  const lines: string[] = [];
  inventory.pages.forEach((page, index) => {
    lines.push(`\n## p${index} — ${fr ? 'page' : 'page'} « ${clip(page.title, 90)} » (${page.path})`);
    for (const s of page.sections) {
      const what = [
        s.headings.length ? `${fr ? 'titres' : 'headings'} : ${clip(s.headings.slice(0, 6).join(' | '), 220)}` : '',
        s.texts.length ? `${s.texts.length} ${fr ? 'paragraphe(s)' : 'paragraph(s)'} (« ${clip(s.texts[0], 110)} »)` : '',
        s.items.length ? `${s.items.length} ${fr ? 'élément(s) de liste' : 'list item(s)'}` : '',
        s.ctas.length ? `${fr ? 'boutons' : 'buttons'} : ${clip(s.ctas.slice(0, 5).map((c) => c.label).join(', '), 120)}` : '',
        s.images.length ? `${s.images.length} image(s)` : '',
        s.form?.length ? `${fr ? 'formulaire' : 'form'} (${s.form.slice(0, 6).join(', ')})` : '',
        s.videos?.length ? `${s.videos.length} ${fr ? 'vidéo(s)' : 'video(s)'}` : '',
      ].filter(Boolean);
      const shape = oldShapeOf(s);
      lines.push(`- ${s.id} : ${what.join(' ; ')}${shape ? ` — ${fr ? 'forme actuelle' : 'current shape'} : ${SHAPE_LABEL[shape][fr ? 0 : 1]}` : ''}`);
    }
  });
  if (inventory.skipped.length) {
    lines.push(
      `\n${fr ? 'Pages vues mais non relevées (articles en plus, à lister sur la page qui les regroupe)' : 'Pages seen but not read (extra articles, to list on the page that groups them)'} : ${clip(inventory.skipped.map((p) => p.label).join(' | '), 900)}`
    );
  }
  return lines.join('\n');
}

/** Les coordonnées et le menu relevés, ajoutés aux faits du projet. */
export function inventoryFacts(inventory: SiteInventory, fr: boolean): string {
  const c = inventory.contact;
  return [
    fr ? '# Le site actuel — coordonnées et menu (relevés)' : '# The current site — contact details and menu (read)',
    c.phones.length ? `${fr ? 'Téléphones' : 'Phones'} : ${c.phones.join(', ')}` : '',
    c.emails.length ? `E-mail : ${c.emails.join(', ')}` : '',
    c.whatsapp.length ? `WhatsApp : ${c.whatsapp.join(', ')}` : '',
    c.addresses.length ? `${fr ? 'Adresses' : 'Addresses'} : ${c.addresses.join(' | ')}` : '',
    c.socials.length ? `${fr ? 'Réseaux' : 'Social'} : ${c.socials.map((s) => `${s.network} ${s.url}`).join(', ')}` : '',
    inventory.navigation.length ? `${fr ? 'Menu actuel' : 'Current menu'} : ${inventory.navigation.map((n) => n.label).join(' · ')}` : '',
    inventory.footer.texts.length ? `${fr ? 'Pied de page' : 'Footer'} : ${clip(inventory.footer.texts.join(' | '), 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Où mène un lien de l'ancien site dans le nouveau : les pages gardent leur place, un lien interne est réécrit
 * vers la nouvelle adresse de sa page.
 */
export function linkMapper(inventory: SiteInventory, pathOf: (pageIndex: number) => string | undefined): (href: string) => string {
  const byUrl = new Map<string, string>();
  inventory.pages.forEach((page, index) => {
    const path = pathOf(index);
    if (!path) return;
    byUrl.set(page.url.replace(/\/$/, ''), path);
    byUrl.set(`${inventory.origin}${page.path}`.replace(/\/$/, ''), path);
  });
  return (href: string) => {
    try {
      // Un lien relatif de l'ancien site (« /contact/ ») se lit depuis son adresse : sinon il restait l'ancien chemin.
      const u = new URL(href, `${inventory.origin.replace(/\/$/, '')}/`);
      if (u.origin !== new URL(inventory.origin).origin) return href;
      const key = `${u.origin}${u.pathname}`.replace(/\/$/, '');
      const mapped = byUrl.get(key);
      return mapped ? `${mapped}${u.hash}` : href;
    } catch {
      return href;
    }
  };
}

/** Le contenu intégral des sections d'origine confiées à un auteur. */
export function sourceContent(sections: InventorySection[], mapLink: (href: string) => string, fr: boolean): string {
  return sections
    .map((s) => {
      const parts = [
        `### ${s.id}`,
        s.headings.length ? `${fr ? 'Titres' : 'Headings'} :\n${s.headings.map((h) => `- ${h}`).join('\n')}` : '',
        s.texts.length ? `${fr ? 'Textes' : 'Copy'} :\n${s.texts.map((t) => `- ${t}`).join('\n')}` : '',
        s.items.length ? `${fr ? 'Listes' : 'Lists'} :\n${s.items.map((t) => `- ${t}`).join('\n')}` : '',
        s.ctas.length ? `${fr ? 'Boutons et liens' : 'Buttons and links'} :\n${s.ctas.map((c) => `- « ${c.label} » → ${c.href ? mapLink(c.href) : '(action)'}`).join('\n')}` : '',
        s.form?.length ? `${fr ? 'Formulaire, champs' : 'Form fields'} : ${s.form.join(', ')}` : '',
        s.videos?.length ? `${fr ? 'Vidéos' : 'Videos'} : ${s.videos.join(', ')}` : '',
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n')
    .slice(0, 9000);
}

/** Tout le texte du site : la référence du garde-fou des faits. */
export function inventoryText(inventory: SiteInventory): string {
  const lines: string[] = [];
  for (const page of inventory.pages) {
    lines.push(`${page.title} ${page.description ?? ''}`);
    for (const s of page.sections) lines.push([...s.headings, ...s.texts, ...s.items, ...s.ctas.map((c) => c.label), ...(s.form ?? [])].join('\n'));
  }
  const c = inventory.contact;
  lines.push([...c.phones, ...c.emails, ...c.addresses, ...inventory.footer.texts, ...inventory.skipped.map((p) => p.label)].join('\n'));
  return lines.join('\n');
}
