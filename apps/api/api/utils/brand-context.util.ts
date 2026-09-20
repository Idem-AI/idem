/**
 * Contexte de marque commun aux livrables documentaires (business plan, pitch
 * deck, site) — et surtout : le bloc LOGO.
 *
 * Le logo n'apparaissait pas dans les documents produits pour une raison simple
 * et invisible : la seule URL du logo primaire était bien transmise, mais aucune
 * consigne ne disait de l'AFFICHER. Un modèle à qui l'on donne une donnée sans
 * verbe la traite comme une information de contexte, pas comme un élément à
 * poser sur la page. Le bloc ci-dessous porte donc les deux : les URLs prêtes à
 * l'emploi ET l'obligation de les utiliser, avec la règle de choix de la
 * déclinaison selon le fond.
 */

import { LogoModel } from '../models/logo.model';

/** Transforme un champ de logo en `src` d'image valide, ou renvoie ''. */
function toImgSrc(value?: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.includes('<svg')) {
    return `data:image/svg+xml;base64,${Buffer.from(trimmed).toString('base64')}`;
  }
  return '';
}

export interface LogoDeclensions {
  primary: string;
  icon: string;
  withTextLight: string;
  withTextDark: string;
  withTextMono: string;
  iconLight: string;
  iconDark: string;
  iconMono: string;
}

/**
 * Résout toutes les déclinaisons en URLs affichables.
 *
 * Les PNG hébergés (`assetUrls`) priment ; on retombe sur les SVG hébergés
 * (`variations`) pour les projets antérieurs, et une déclinaison absente reprend
 * le logo primaire — un trou dans la table conduisait le modèle à inventer une
 * URL, ce qui donne une image cassée sur la page.
 */
export function resolveLogoDeclensions(logo?: LogoModel | null): LogoDeclensions | null {
  if (!logo) return null;

  const a = logo.assetUrls;
  const v = logo.variations;
  const primary = toImgSrc(a?.primary) || toImgSrc(logo.svg);
  if (!primary) return null;

  const pick = (...candidates: Array<string | undefined>): string => {
    for (const candidate of candidates) {
      const src = toImgSrc(candidate);
      if (src) return src;
    }
    return primary;
  };

  return {
    primary,
    icon: pick(a?.icon, logo.iconSvg),
    withTextLight: pick(a?.withText?.lightBackground, v?.withText?.lightBackground),
    withTextDark: pick(a?.withText?.darkBackground, v?.withText?.darkBackground),
    withTextMono: pick(a?.withText?.monochrome, v?.withText?.monochrome),
    iconLight: pick(a?.iconOnly?.lightBackground, v?.iconOnly?.lightBackground),
    iconDark: pick(a?.iconOnly?.darkBackground, v?.iconOnly?.darkBackground),
    iconMono: pick(a?.iconOnly?.monochrome, v?.iconOnly?.monochrome),
  };
}

/** Toutes les URLs connues, dédoublonnées — sert au contrôle de présence. */
export function collectLogoUrls(logo?: LogoModel | null): string[] {
  const d = resolveLogoDeclensions(logo);
  if (!d) return [];
  return [...new Set(Object.values(d).filter(Boolean))];
}

export interface LogoBlockOptions {
  /**
   * Où le logo doit apparaître dans CE livrable. Sans destination explicite, le
   * modèle « prend note » de l'URL et ne pose rien.
   */
  placement: string;
  /** Taille attendue, exprimée dans les unités du support. */
  size?: string;
}

/**
 * Bloc LOGO à insérer dans un contexte de marque.
 *
 * Renvoie une consigne explicite d'ABSENCE quand la marque n'a pas de logo :
 * sans elle, le modèle dessine un placeholder ou invente une URL, ce qui produit
 * une image cassée — pire qu'un document sans logo.
 */
export function buildLogoBlock(logo?: LogoModel | null, options?: LogoBlockOptions): string {
  const d = resolveLogoDeclensions(logo);
  const placement = options?.placement || 'on the cover and in the footer of every page';
  const size = options?.size || 'large enough to be read, never a thumbnail in a corner';

  if (!d) {
    return `<logo>
This brand has NO logo asset available. Do not draw one, do not invent a URL, do not leave an empty placeholder: set the brand signature TYPOGRAPHICALLY, with the brand name in the charter display typeface.
</logo>`;
  }

  return `<logo>
The brand logo is supplied below as READY-TO-USE image URLs. It MUST appear in this deliverable: ${placement}.

Available declensions — each is named by the colour of its INK and by the background it is made for; read both before picking:
- Primary (full logo, default): ${d.primary}
- With text — DARK ink, goes ON A LIGHT background: ${d.withTextLight}
- With text — LIGHT ink, goes ON A DARK background: ${d.withTextDark}
- With text — monochrome: ${d.withTextMono}
- Icon only — DARK ink, on a light background: ${d.iconLight}
- Icon only — LIGHT ink, on a dark background: ${d.iconDark}
- Icon only — monochrome (watermark, pattern, corner mark): ${d.iconMono}

Usage rules, non negotiable:
- Place the logo as <img src="EXACT_URL" alt="${logo?.name || 'brand'} logo" style="height:...;width:auto" />. NEVER invent a URL, NEVER paste raw SVG markup, NEVER write a symbolic path such as "branding.logo.url".
- Pick the declension from the ACTUAL LUMINANCE of the zone the logo sits on, not from the overall mood of the page. Light zone → dark ink. Dark zone → light ink. Light ink on a light background makes the signature vanish: it is the single most frequent failure.
- If the zone under the logo is busy (photo, gradient), move the logo onto a plain flat rather than hoping it will read.
- Size: ${size}. Keep the aspect ratio (fixed height, width:auto). Full opacity.
- Keep clear space around the logo equal to half its own height: no text, no rule, no image subject inside that margin.
- Never enclose the logo in a filled pill or a button: it is a signature.
</logo>`;
}
