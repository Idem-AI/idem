/**
 * Le registre des contenus juridiques, indexé par l’identifiant du document.
 *
 * Les routes et les liens de pied de page viennent de `@idem/shared-footer`.
 * Ici vit le texte. `npm run check:legal` vérifie que les deux listes se
 * recouvrent exactement : un document déclaré sans contenu afficherait une
 * page vide, et un contenu sans document serait inatteignable.
 */

import type { LegalDocContent } from '../content.model';

import { COOKIE_POLICY } from './cookie-policy';
import { GLOBAL_PRIVACY } from './privacy-policy';
import { GLOBAL_TERMS } from './terms-of-service';
import { ICODE_PRIVACY } from './icode-privacy';
import { ICODE_TERMS } from './icode-terms';
import { IDEPLOY_PRIVACY } from './ideploy-privacy';
import { IDEPLOY_TERMS } from './ideploy-terms';
import { IDOMAIN_PRIVACY } from './idomain-privacy';
import { IDOMAIN_TERMS } from './idomain-terms';
import { ISIMULATOR_PRIVACY } from './isimulator-privacy';
import { IVISION_PRIVACY } from './ivision-privacy';
import { IVISION_TERMS } from './ivision-terms';
import { SUBPROCESSORS } from './subprocessors';

/** Tous les textes écrits dans ce dossier, dans l’ordre de lecture. */
export const LEGAL_CONTENTS: readonly LegalDocContent[] = [
  GLOBAL_PRIVACY,
  GLOBAL_TERMS,
  COOKIE_POLICY,
  SUBPROCESSORS,
  ICODE_PRIVACY,
  ICODE_TERMS,
  IDEPLOY_PRIVACY,
  IDEPLOY_TERMS,
  IVISION_PRIVACY,
  IVISION_TERMS,
  IDOMAIN_PRIVACY,
  IDOMAIN_TERMS,
  ISIMULATOR_PRIVACY,
];

const BY_ID = new Map(LEGAL_CONTENTS.map((content) => [content.id, content]));

/** Le contenu d’un document, ou `undefined` si l’identifiant est inconnu. */
export function legalContent(id: string): LegalDocContent | undefined {
  return BY_ID.get(id);
}

export {
  COOKIE_POLICY,
  GLOBAL_PRIVACY,
  GLOBAL_TERMS,
  ICODE_PRIVACY,
  ICODE_TERMS,
  IDEPLOY_PRIVACY,
  IDEPLOY_TERMS,
  IDOMAIN_PRIVACY,
  IDOMAIN_TERMS,
  ISIMULATOR_PRIVACY,
  IVISION_PRIVACY,
  IVISION_TERMS,
  SUBPROCESSORS,
};
