/**
 * Les pays où IDEM est disponible, et le droit qui s'y applique.
 *
 * ## Pourquoi cette liste existe
 *
 * IDEM S.A.S. est camerounaise, et c'est la loi camerounaise qui régit son
 * traitement. Mais le service est **vendu dans treize pays** : la liste des
 * pays proposables est l'intersection de notre tarification et du
 * provisionnement de notre compte pawaPay
 * (`apps/api/api/services/payments/payment-countries.service.ts`). Un
 * utilisateur sénégalais ou kenyan a des droits que lui donne *sa* loi, pas la
 * nôtre — et une politique de confidentialité qui ne nomme que le Cameroun lui
 * cache l'autorité à laquelle il peut se plaindre.
 *
 * ## Pourquoi un drapeau `authority`
 *
 * Trois des treize pays n'ont pas, à notre dernière vérification, de loi
 * dédiée ou d'autorité installée. Nommer une autorité qui n'existe pas serait
 * pire que de n'en nommer aucune : la page affiche donc ce qui est vérifié, et
 * la clause générale couvre le reste. Les sources sont tracées dans
 * `PRIVACY_GAP_ANALYSIS_2026-11-18.md` (hors dépôt).
 *
 * Les codes sont ceux d'`ISO 3166-1 alpha-3`, comme dans la tarification.
 */

import type { T } from './content.model';

export interface CountryLaw {
  readonly code: string;
  readonly name: T;
  /** La loi nationale, ou `null` quand aucune n'est en vigueur. */
  readonly law: T | null;
  /** L'autorité de contrôle, ou `null` quand aucune n'est installée. */
  readonly authority: T | null;
  /** Le cadre régional dont le pays relève, en plus de sa loi nationale. */
  readonly regional: 'cedeao' | 'eac' | 'sadc' | 'cemac' | 'none';
  /** Relevé le : une donnée juridique vieillit, et doit le dire. */
  readonly checkedOn: string;
}

const NONE: T = {
  fr: "Pas de loi dédiée en vigueur à ce jour : la loi camerounaise et la Convention de Malabo s'appliquent",
  en: 'No dedicated law in force to date: Cameroonian law and the Malabo Convention apply',
};

const NO_AUTHORITY: T = {
  fr: "Pas d'autorité installée — nous écrire, ou saisir l'APDP camerounaise",
  en: 'No authority in place — write to us, or refer the matter to the Cameroonian APDP',
};

/** Les treize pays, dans l'ordre alphabétique de leur nom français. */
export const COUNTRY_LAWS: readonly CountryLaw[] = [
  {
    code: 'BEN',
    name: { fr: 'Bénin', en: 'Benin' },
    law: {
      fr: 'Loi n° 2017-20 du 20 avril 2018 portant Code du numérique, livre V',
      en: 'Law n° 2017-20 of 20 April 2018, Digital Code, Book V',
    },
    authority: {
      fr: 'Autorité de protection des données à caractère personnel (APDP)',
      en: 'Personal Data Protection Authority (APDP)',
    },
    regional: 'cedeao',
    checkedOn: '2026-11-19',
  },
  {
    code: 'CMR',
    name: { fr: 'Cameroun', en: 'Cameroon' },
    law: {
      fr: 'Loi n° 2024/017 du 23 décembre 2024 régissant la protection des données à caractère personnel',
      en: 'Law n° 2024/017 of 23 December 2024 on personal data protection',
    },
    authority: {
      fr: 'Autorité de protection des données à caractère personnel (APDP)',
      en: 'Personal Data Protection Authority (APDP)',
    },
    regional: 'cemac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'COG',
    name: { fr: 'Congo', en: 'Republic of the Congo' },
    law: {
      fr: 'Loi n° 29-2019 du 10 octobre 2019 sur la protection des données à caractère personnel',
      en: 'Law n° 29-2019 of 10 October 2019 on personal data protection',
    },
    authority: {
      fr: 'Commission nationale de protection des données à caractère personnel',
      en: 'National Personal Data Protection Commission',
    },
    regional: 'cemac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'CIV',
    name: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" },
    law: {
      fr: 'Loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel',
      en: 'Law n° 2013-450 of 19 June 2013 on personal data protection',
    },
    authority: {
      fr: 'Autorité de régulation des télécommunications (ARTCI)',
      en: 'Telecommunications Regulatory Authority (ARTCI)',
    },
    regional: 'cedeao',
    checkedOn: '2026-11-19',
  },
  {
    code: 'GAB',
    name: { fr: 'Gabon', en: 'Gabon' },
    law: {
      fr: 'Loi n° 001/2011 du 25 septembre 2011 relative à la protection des données à caractère personnel',
      en: 'Law n° 001/2011 of 25 September 2011 on personal data protection',
    },
    authority: {
      fr: 'Commission nationale pour la protection des données à caractère personnel (CNPDCP)',
      en: 'National Personal Data Protection Commission (CNPDCP)',
    },
    regional: 'cemac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'KEN',
    name: { fr: 'Kenya', en: 'Kenya' },
    law: { fr: 'Data Protection Act, 2019', en: 'Data Protection Act, 2019' },
    authority: {
      fr: 'Office of the Data Protection Commissioner (ODPC)',
      en: 'Office of the Data Protection Commissioner (ODPC)',
    },
    regional: 'eac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'MOZ',
    name: { fr: 'Mozambique', en: 'Mozambique' },
    law: null,
    authority: null,
    regional: 'sadc',
    checkedOn: '2026-11-19',
  },
  {
    code: 'UGA',
    name: { fr: 'Ouganda', en: 'Uganda' },
    law: {
      fr: 'Data Protection and Privacy Act, 2019, et ses règlements de 2021',
      en: 'Data Protection and Privacy Act, 2019, and its 2021 Regulations',
    },
    authority: {
      fr: 'Personal Data Protection Office (PDPO), au sein de NITA-U',
      en: 'Personal Data Protection Office (PDPO), within NITA-U',
    },
    regional: 'eac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'COD',
    name: { fr: 'République démocratique du Congo', en: 'Democratic Republic of the Congo' },
    law: null,
    authority: null,
    regional: 'none',
    checkedOn: '2026-11-19',
  },
  {
    code: 'RWA',
    name: { fr: 'Rwanda', en: 'Rwanda' },
    law: {
      fr: 'Loi n° 058/2021 du 13 octobre 2021 relative à la protection des données à caractère personnel et de la vie privée',
      en: 'Law n° 058/2021 of 13 October 2021 on the protection of personal data and privacy',
    },
    authority: {
      fr: 'Data Protection and Privacy Office (National Cyber Security Authority)',
      en: 'Data Protection and Privacy Office (National Cyber Security Authority)',
    },
    regional: 'eac',
    checkedOn: '2026-11-19',
  },
  {
    code: 'SEN',
    name: { fr: 'Sénégal', en: 'Senegal' },
    law: {
      fr: 'Loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel',
      en: 'Law n° 2008-12 of 25 January 2008 on personal data protection',
    },
    authority: {
      fr: 'Commission de protection des données personnelles (CDP)',
      en: 'Personal Data Protection Commission (CDP)',
    },
    regional: 'cedeao',
    checkedOn: '2026-11-19',
  },
  {
    code: 'SLE',
    name: { fr: 'Sierra Leone', en: 'Sierra Leone' },
    law: null,
    authority: null,
    regional: 'cedeao',
    checkedOn: '2026-11-19',
  },
  {
    code: 'ZMB',
    name: { fr: 'Zambie', en: 'Zambia' },
    law: { fr: 'Data Protection Act, 2021', en: 'Data Protection Act, 2021' },
    authority: {
      fr: 'Office of the Data Protection Commissioner (ODPC)',
      en: 'Office of the Data Protection Commissioner (ODPC)',
    },
    regional: 'sadc',
    checkedOn: '2026-11-19',
  },
];

/** Le tableau affiché dans la politique : pays, loi, autorité. */
export function countryTable() {
  return {
    caption: {
      fr: `Les ${COUNTRY_LAWS.length} pays où IDEM est disponible, et le droit national qui s'y applique en plus du droit camerounais (relevé du 19 novembre 2026).`,
      en: `The ${COUNTRY_LAWS.length} countries where IDEM is available, and the national law that applies there in addition to Cameroonian law (checked 19 November 2026).`,
    } satisfies T,
    headers: [
      { fr: 'Pays', en: 'Country' },
      { fr: 'Loi applicable', en: 'Applicable law' },
      { fr: 'Autorité de contrôle', en: 'Supervisory authority' },
    ] satisfies T[],
    rows: COUNTRY_LAWS.map((country) => [
      country.name,
      country.law ?? NONE,
      country.authority ?? NO_AUTHORITY,
    ]),
  };
}

/** La liste des pays en une phrase, pour les paragraphes qui l'énumèrent. */
export function countryList(locale: 'fr' | 'en'): string {
  return COUNTRY_LAWS.map((country) => country.name[locale]).join(', ');
}
