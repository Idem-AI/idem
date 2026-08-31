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
  const placement = options?.placement || 'sur la couverture et en pied de chaque page';
  const size = options?.size || 'assez grand pour être lu, jamais une vignette dans un coin';

  if (!d) {
    return `<logo>
Cette marque n'a PAS de logo disponible. Ne pas en dessiner un, ne pas inventer d'URL, ne pas laisser d'emplacement vide : composer la signature de marque en TYPOGRAPHIE, avec le nom de la marque dans la police de titre de la charte.
</logo>`;
  }

  return `<logo>
Le logo de la marque est fourni ci-dessous sous forme d'URLs d'images PRÊTES À L'EMPLOI. Il DOIT apparaître dans ce livrable : ${placement}.

Déclinaisons disponibles — chacune est nommée par la couleur de son ENCRE et par le fond auquel elle est destinée ; lire les deux avant de choisir :
- Primaire (logo complet, par défaut) : ${d.primary}
- Avec texte — encre SOMBRE, va SUR UN FOND CLAIR : ${d.withTextLight}
- Avec texte — encre CLAIRE, va SUR UN FOND SOMBRE : ${d.withTextDark}
- Avec texte — monochrome : ${d.withTextMono}
- Icône seule — encre SOMBRE, sur fond clair : ${d.iconLight}
- Icône seule — encre CLAIRE, sur fond sombre : ${d.iconDark}
- Icône seule — monochrome (filigrane, motif, marque d'angle) : ${d.iconMono}

Règles d'emploi, non négociables :
- Poser le logo comme <img src="URL_EXACTE" alt="logo ${logo?.name || 'de la marque'}" style="height:...;width:auto" />. Ne JAMAIS inventer d'URL, ne JAMAIS recopier de balisage SVG, ne JAMAIS écrire un chemin symbolique du type "branding.logo.url".
- Choisir la déclinaison d'après la LUMINOSITÉ RÉELLE de la zone sur laquelle le logo est posé, pas d'après l'ambiance générale de la page. Zone claire → encre sombre. Zone sombre → encre claire. Une encre claire sur un fond clair fait disparaître la signature : c'est l'erreur la plus fréquente.
- Si la zone sous le logo est chargée (photo, dégradé), déplacer le logo sur un aplat plutôt que d'espérer qu'il se lise.
- Taille : ${size}. Conserver le rapport d'aspect (hauteur fixée, width:auto). Opacité pleine.
- Réserver autour du logo un espace libre égal à la moitié de sa hauteur : aucun texte, aucun filet, aucun sujet d'image dans cette marge.
- Ne jamais enfermer le logo dans une pastille pleine ni dans un bouton : c'est une signature.
</logo>`;
}
