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

/** Les images d'une section, de la meilleure à la moins bonne (tri stable). */
export function bestFirst<T extends InventoryImage>(images: T[]): T[] {
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
      lines.push(`- ${s.id} : ${what.join(' ; ')}`);
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
      const u = new URL(href);
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
