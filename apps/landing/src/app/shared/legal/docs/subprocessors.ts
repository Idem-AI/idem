/**
 * La page des sous-traitants.
 *
 * Elle existe pour une raison simple : une politique de confidentialité qui dit
 * « nous travaillons avec des prestataires de confiance » ne dit rien. Le
 * registre qui engage le code est dans `data-governance.ts` ; cette page en est
 * la publication, et `npm run check:legal` refuse qu’elles divergent.
 */

import type { LegalDocContent } from '../content.model';
import { processorTable } from '../processors';

export const SUBPROCESSORS: LegalDocContent = {
  id: 'subprocessors',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Nos sous-traitants', en: 'Our sub-processors' },
  subtitle: {
    fr: 'Tous les tiers qui touchent à vos données, ce qu’ils en reçoivent, où ils le traitent, et ce qu’ils ont le droit d’en faire. La liste est exhaustive : le code refuse tout envoi à un destinataire qui n’y figure pas.',
    en: 'Every third party that touches your data, what it receives, where it processes it, and what it may do with it. The list is exhaustive: the code refuses any send to a recipient that is not on it.',
  },
  sections: [
    {
      id: 'how',
      title: { fr: 'Comment cette liste est tenue', en: 'How this list is maintained' },
      paragraphs: [
        {
          fr: 'Chaque destinataire est inscrit dans un registre, avec le niveau de sensibilité maximal qu’il peut recevoir. Avant chaque envoi vers un modèle d’intelligence artificielle, un garde vérifie trois choses : que le destinataire est au registre, qu’il accepte ce niveau de données, et que la finalité déclarée autorise ce niveau sans consentement supplémentaire.',
          en: 'Each recipient is listed in a registry, with the maximum sensitivity level it may receive. Before every send to an AI model, a guard checks three things: that the recipient is in the registry, that it accepts that data level, and that the declared purpose allows that level without additional consent.',
        },
        {
          fr: 'Un envoi qui ne passe pas par ce garde fait échouer notre contrôle automatique : il ne peut donc pas arriver en production inaperçu. C’est la différence entre une liste affichée et une liste appliquée.',
          en: 'A send that does not go through that guard fails our automated check: it therefore cannot reach production unnoticed. That is the difference between a list displayed and a list enforced.',
        },
      ],
    },
    {
      id: 'list',
      title: { fr: 'La liste', en: 'The list' },
      paragraphs: [
        {
          fr: 'Les sous-traitants marqués « infrastructure IDEM » tournent sur nos propres machines : nous en sommes seuls responsables. Les autres sont des tiers, et la colonne « lieu du traitement » indique où vos données vont réellement.',
          en: 'The sub-processors marked “IDEM infrastructure” run on our own machines: we alone are responsible for them. The others are third parties, and the “place of processing” column states where your data actually goes.',
        },
      ],
      table: processorTable(),
    },
    {
      id: 'optional',
      title: { fr: 'Ceux que vous activez vous-même', en: 'The ones you switch on yourself' },
      paragraphs: [
        {
          fr: 'GitHub, WhatsApp, Facebook, LinkedIn et X ne reçoivent rien tant que vous ne les avez pas reliés. Relier un compte est une action volontaire, réversible : retirer le lien coupe l’accès et supprime le jeton correspondant.',
          en: 'GitHub, WhatsApp, Facebook, LinkedIn and X receive nothing until you connect them. Connecting an account is a deliberate, reversible action: removing the link cuts off access and deletes the corresponding token.',
        },
        {
          fr: 'Un nom de domaine est un cas à part : le registre de l’extension exige des coordonnées de titulaire, et ces coordonnées ne peuvent pas être retirées sans supprimer le domaine. Le complément iDomain le détaille.',
          en: 'A domain name is a case apart: the extension’s registry requires holder contact details, and those details cannot be withdrawn without deleting the domain. The iDomain addendum details this.',
        },
      ],
    },
    {
      id: 'changes',
      title: { fr: 'Quand cette liste change', en: 'When this list changes' },
      paragraphs: [
        {
          fr: 'Nous publions tout nouveau sous-traitant sur cette page avant de lui transmettre quoi que ce soit, et nous vous en informons par e-mail trente jours avant s’il reçoit des données confidentielles. Si ce changement ne vous convient pas, vous pouvez supprimer votre compte pendant ce délai.',
          en: 'We publish any new sub-processor on this page before transmitting anything to it, and we inform you by e-mail thirty days beforehand if it receives confidential data. If that change does not suit you, you can delete your account during that period.',
        },
        {
          fr: 'Remplacer un fournisseur par un autre pour la même fonction, ou retirer un fournisseur, ne nécessite pas de préavis : cela ne fait que réduire ce qui sort.',
          en: 'Replacing one provider with another for the same function, or removing a provider, requires no notice: it only reduces what leaves.',
        },
      ],
    },
  ],
};
