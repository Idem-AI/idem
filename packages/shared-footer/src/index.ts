/**
 * Cœur indépendant de tout framework : la structure du pied de page et le
 * registre des textes juridiques.
 *
 * Les rendus vivent dans des points d'entrée séparés, pour qu'une application
 * React n'embarque pas Angular et réciproquement :
 * `@idem/shared-footer/angular` et `@idem/shared-footer/react`. Ils partagent
 * la même feuille, `./footer.css`.
 */
export {
  DEFAULT_SERVICES,
  GITHUB_ORG_URL,
  LICENSE_URL,
  resolveFooter,
  type FooterApp,
  type FooterServices,
  type ResolvedColumn,
  type ResolvedFooter,
  type ResolvedLink,
  type ResolveFooterOptions,
  type SocialLink,
} from './apps';

export {
  LEGAL_DOCS,
  LEGAL_DOC_BY_ID,
  addendumDocs,
  footerLegalDocs,
  legalUrl,
  type Bilingual,
  type FooterLocale,
  type LegalDoc,
  type LegalKind,
  type LegalScope,
} from './legal';
