/**
 * Complément de confidentialité propre à iDomain.
 *
 * iDomain est le seul service d’IDEM où une donnée personnelle est transmise
 * pour être *publiée* : le registre d’une extension exige des coordonnées de
 * titulaire, et une partie de ces coordonnées est consultable publiquement.
 * C’est une exception à tout le reste de notre politique, et elle doit être
 * dite avant l’achat, pas après.
 */

import type { LegalDocContent } from '../content.model';

export const IDOMAIN_PRIVACY: LegalDocContent = {
  id: 'idomain-privacy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Confidentialité — iDomain', en: 'Privacy — iDomain' },
  subtitle: {
    fr: 'Acheter un nom de domaine oblige à déclarer un titulaire. Voici exactement quelles coordonnées partent, à qui, ce qui en devient public, et ce que vous pouvez en masquer.',
    en: 'Buying a domain name requires declaring a holder. Here is exactly which details leave, to whom, what becomes public, and what you can mask.',
  },
  sections: [
    {
      id: 'scope',
      title: {
        fr: 'Ce texte complète la politique globale',
        en: 'This text adds to the global policy',
      },
      paragraphs: [
        {
          fr: 'La politique de confidentialité d’IDEM s’applique entièrement à iDomain. Ce complément décrit la seule chose qu’elle ne peut pas promettre ici : la confidentialité totale.',
          en: 'The IDEM privacy policy applies to iDomain in full. This addendum describes the one thing it cannot promise here: total confidentiality.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Le texte global, à lire d’abord.',
            en: 'The global text, to be read first.',
          },
          link: {
            label: { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
            href: '/privacy-policy',
          },
        },
      ],
    },
    {
      id: 'why',
      title: {
        fr: 'Pourquoi un nom de domaine n’est pas anonyme',
        en: 'Why a domain name is not anonymous',
      },
      paragraphs: [
        {
          fr: 'Un nom de domaine n’est pas un produit que nous vendons : c’est une délégation accordée par le registre de l’extension — le gestionnaire mondial des « .com », « .africa », « .cm » et des autres. Ce registre impose ses règles, et l’une d’elles est de savoir à qui le nom est délégué.',
          en: 'A domain name is not a product we sell: it is a delegation granted by the extension’s registry — the global manager of “.com”, “.africa”, “.cm” and the rest. That registry imposes its rules, and one of them is knowing to whom the name is delegated.',
        },
        {
          fr: 'Nous ne pouvons pas vous dispenser de cette déclaration : sans elle, l’enregistrement est refusé. Et nous ne pouvons pas la retirer après coup : seule la suppression du nom y met fin.',
          en: 'We cannot exempt you from that declaration: without it, registration is refused. And we cannot withdraw it afterwards: only deleting the name ends it.',
        },
      ],
      warning: {
        type: 'warning',
        icon: '🌐',
        title: {
          fr: 'Ces coordonnées sortent d’IDEM et ne reviennent pas',
          en: 'These details leave IDEM and do not come back',
        },
        content: {
          fr: 'En achetant un nom de domaine, vous nous autorisez à transmettre vos coordonnées de titulaire à notre registraire, au registre de l’extension, et aux organismes qu’ils désignent — y compris hors d’Afrique. Une partie peut être publiée dans les annuaires publics d’enregistrement. Ce transfert est nécessaire à l’exécution de votre commande : si vous le refusez, n’achetez pas le domaine, et nous ne pourrons pas vous le fournir.',
          en: 'By buying a domain name, you authorise us to transmit your holder details to our registrar, to the extension’s registry, and to the bodies they designate — including outside Africa. Some of it may be published in the public registration directories. That transfer is necessary to perform your order: if you refuse it, do not buy the domain, and we will not be able to provide it.',
        },
      },
    },
    {
      id: 'what',
      title: {
        fr: 'Ce qui est transmis, et ce qui devient public',
        en: 'What is transmitted, and what becomes public',
      },
      paragraphs: [
        {
          fr: 'Le détail varie selon l’extension : chaque registre a ses exigences, et certaines extensions nationales en demandent plus que les extensions génériques. Voici la règle générale.',
          en: 'The detail varies by extension: each registry has its requirements, and some national extensions ask for more than generic ones. Here is the general rule.',
        },
      ],
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Transmise au registre', en: 'Sent to the registry' },
          { fr: 'Publiée dans l’annuaire public', en: 'Published in the public directory' },
        ],
        rows: [
          [
            { fr: 'Nom du titulaire', en: 'Holder’s name' },
            { fr: 'Oui, obligatoire', en: 'Yes, mandatory' },
            {
              fr: 'Masqué par défaut pour un particulier ; publié pour une organisation',
              en: 'Masked by default for an individual; published for an organisation',
            },
          ],
          [
            { fr: 'Organisation', en: 'Organisation' },
            { fr: 'Oui, si vous en déclarez une', en: 'Yes, if you declare one' },
            { fr: 'Publiée', en: 'Published' },
          ],
          [
            { fr: 'Adresse postale', en: 'Postal address' },
            { fr: 'Oui, obligatoire', en: 'Yes, mandatory' },
            {
              fr: 'Masquée par défaut ; le pays reste visible',
              en: 'Masked by default; the country stays visible',
            },
          ],
          [
            { fr: 'Adresse e-mail', en: 'E-mail address' },
            { fr: 'Oui, obligatoire', en: 'Yes, mandatory' },
            {
              fr: 'Remplacée par une adresse de relais, ou masquée',
              en: 'Replaced by a relay address, or masked',
            },
          ],
          [
            { fr: 'Téléphone', en: 'Phone' },
            { fr: 'Oui, obligatoire', en: 'Yes, mandatory' },
            { fr: 'Masqué par défaut', en: 'Masked by default' },
          ],
          [
            { fr: 'Dates et serveurs de noms', en: 'Dates and name servers' },
            { fr: 'Oui', en: 'Yes' },
            {
              fr: 'Publiés : ce sont des données techniques du domaine',
              en: 'Published: these are the domain’s technical data',
            },
          ],
        ],
      },
    },
    {
      id: 'masking',
      title: { fr: 'Le masquage, et ses limites', en: 'Masking, and its limits' },
      paragraphs: [
        {
          fr: 'La plupart des extensions appliquent aujourd’hui un masquage par défaut des coordonnées d’un titulaire particulier : l’annuaire public ne montre alors que le domaine, son pays, ses dates et ses serveurs de noms.',
          en: 'Most extensions today apply masking by default to an individual holder’s details: the public directory then shows only the domain, its country, its dates and its name servers.',
        },
        {
          fr: 'Ce masquage a trois limites. Il ne s’applique pas aux organisations, dont le nom reste public. Il ne vous protège pas d’une demande légitime d’accès — un titulaire de marque, une autorité, un tribunal peuvent obtenir les coordonnées complètes auprès du registraire. Et certaines extensions nationales ne le proposent pas du tout.',
          en: 'That masking has three limits. It does not apply to organisations, whose name stays public. It does not protect you from a legitimate access request — a trade mark holder, an authority, a court can obtain the full details from the registrar. And some national extensions do not offer it at all.',
        },
        {
          fr: 'Nous vous indiquons, au moment de l’achat, ce que l’extension choisie exige et ce qu’elle publie. Si une extension vous paraît trop exposante, choisissez-en une autre : c’est la seule protection réelle.',
          en: 'We tell you, at the time of purchase, what the chosen extension requires and what it publishes. If an extension looks too exposing to you, choose another: that is the only real protection.',
        },
      ],
    },
    {
      id: 'accuracy',
      title: {
        fr: 'Des coordonnées exactes, et pourquoi c’est sérieux',
        en: 'Accurate details, and why it matters',
      },
      paragraphs: [
        {
          fr: 'Les registres exigent des coordonnées exactes et à jour, et ils vérifient. Une adresse e-mail invalide, un nom fictif ou une adresse inventée peuvent entraîner la suspension du domaine, puis sa suppression — et personne, ni nous ni le registraire, ne peut s’y opposer.',
          en: 'Registries require accurate and up-to-date details, and they verify them. An invalid e-mail address, a fictitious name or an invented address can lead to the domain being suspended, then deleted — and nobody, neither us nor the registrar, can prevent it.',
        },
        {
          fr: 'Vous pouvez corriger vos coordonnées à tout moment depuis iDomain ; la correction est transmise au registre. Certaines extensions traitent un changement de titulaire comme un transfert, avec un délai de blocage : nous vous le disons avant.',
          en: 'You can correct your details at any time from iDomain; the correction is sent to the registry. Some extensions treat a change of holder as a transfer, with a lock period: we tell you beforehand.',
        },
      ],
    },
    {
      id: 'payment',
      title: { fr: 'Le paiement et la facturation', en: 'Payment and billing' },
      paragraphs: [
        {
          fr: 'Un domaine est payé depuis votre portefeuille IDEM, que vous rechargez en mobile money. Votre numéro de paiement n’est jamais transmis au registre : il ne sert qu’à l’encaissement, et il est conservé chiffré.',
          en: 'A domain is paid from your IDEM wallet, which you top up by mobile money. Your payment number is never transmitted to the registry: it serves only for collection, and it is kept encrypted.',
        },
        {
          fr: 'Les pièces de facturation d’un domaine sont conservées dix ans, comme toutes les pièces comptables, et survivent à la suppression de votre compte sans vos coordonnées.',
          en: 'A domain’s billing records are kept for ten years, like all accounting records, and survive the deletion of your account without your contact details.',
        },
      ],
    },
    {
      id: 'retention',
      title: { fr: 'Durées propres à iDomain', en: 'Durations specific to iDomain' },
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Vos coordonnées de titulaire, chez nous', en: 'Your holder details, with us' },
            {
              fr: 'Tant que vous détenez au moins un domaine, puis effacées avec le compte',
              en: 'As long as you hold at least one domain, then erased with the account',
            },
          ],
          [
            {
              fr: 'Vos coordonnées de titulaire, chez le registre',
              en: 'Your holder details, with the registry',
            },
            {
              fr: 'Selon ses règles — plusieurs années après l’expiration du nom, hors de notre contrôle',
              en: 'Per its own rules — several years after the name expires, outside our control',
            },
          ],
          [
            { fr: 'Recherches de disponibilité', en: 'Availability searches' },
            { fr: 'Non conservées à votre nom', en: 'Not kept against your name' },
          ],
          [
            { fr: 'Facturation du domaine', en: 'Domain billing' },
            { fr: '10 ans (obligation comptable)', en: '10 years (accounting obligation)' },
          ],
          [
            {
              fr: 'Compte supprimé alors que vous détenez un domaine',
              en: 'Account deleted while you hold a domain',
            },
            {
              fr: 'Nous vous écrivons avant : un domaine abandonné expire et peut être repris par un tiers. Le transfert vers un autre registraire reste possible pendant le délai de grâce',
              en: 'We write to you first: an abandoned domain expires and can be taken by someone else. Transferring to another registrar remains possible during the grace period',
            },
          ],
        ],
      },
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Question sur ce texte, correction de coordonnées, demande de masquage, exercice d’un droit : legal@idem.africa. Nous vous dirons franchement ce que nous pouvons obtenir du registre et ce que nous ne pouvons pas.',
          en: 'A question about this text, correcting details, a masking request, exercising a right: legal@idem.africa. We will tell you frankly what we can obtain from the registry and what we cannot.',
        },
      ],
    },
  ],
};
