/**
 * Règles d’enregistrement propres à iDomain.
 *
 * Un nom de domaine n’est pas un bien que nous vendons : c’est une
 * délégation accordée par un registre, sous ses propres règles, que nous ne
 * pouvons ni assouplir ni contourner. Ce texte dit où s’arrête notre pouvoir.
 */

import type { LegalDocContent } from '../content.model';

export const IDOMAIN_TERMS: LegalDocContent = {
  id: 'idomain-terms',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Règles d’enregistrement — iDomain', en: 'Registration rules — iDomain' },
  subtitle: {
    fr: 'Ce que vous achetez exactement, quelles règles s’imposent à nous comme à vous, ce qui n’est pas remboursable, et ce qui se passe à l’expiration.',
    en: 'What exactly you are buying, which rules bind us as much as you, what is not refundable, and what happens at expiry.',
  },
  sections: [
    {
      id: 'scope',
      title: {
        fr: 'Ces règles complètent les conditions générales',
        en: 'These rules add to the terms of service',
      },
      paragraphs: [
        {
          fr: 'Les conditions générales d’utilisation d’IDEM s’appliquent entièrement à iDomain. Ces règles n’ajoutent que ce qui est propre à l’enregistrement d’un nom de domaine, et l’emportent pour iDomain en cas de contradiction.',
          en: 'The IDEM terms of service apply to iDomain in full. These rules add only what is specific to registering a domain name, and prevail for iDomain in the event of a conflict.',
        },
      ],
      list: [
        {
          text: { fr: 'Le contrat général.', en: 'The general contract.' },
          link: {
            label: { fr: 'Conditions générales', en: 'Terms of Service' },
            href: '/terms-of-service',
          },
        },
        {
          text: { fr: 'Et ce qui devient public.', en: 'And what becomes public.' },
          link: {
            label: { fr: 'Confidentialité iDomain', en: 'iDomain privacy' },
            href: '/privacy/idomain',
          },
        },
      ],
    },
    {
      id: 'what',
      title: { fr: 'Ce que vous achetez', en: 'What you are buying' },
      paragraphs: [
        {
          fr: 'Vous n’achetez pas un nom : vous obtenez le droit exclusif de l’utiliser pendant une durée déterminée, accordé par le registre de l’extension. Nous sommes l’intermédiaire qui enregistre ce droit pour vous, le renouvelle, et gère sa configuration technique.',
          en: 'You are not buying a name: you obtain the exclusive right to use it for a fixed period, granted by the extension’s registry. We are the intermediary that registers that right for you, renews it, and manages its technical configuration.',
        },
        {
          fr: 'Ce droit est soumis aux règles du registre et, pour la plupart des extensions, à celles de l’organisme qui coordonne les noms de domaine mondiaux. Ces règles s’imposent à nous autant qu’à vous : nous ne pouvons pas y déroger, même en votre faveur.',
          en: 'That right is subject to the registry’s rules and, for most extensions, to those of the body that coordinates global domain names. Those rules bind us as much as you: we cannot depart from them, even in your favour.',
        },
      ],
    },
    {
      id: 'holder',
      title: { fr: 'Vos obligations de titulaire', en: 'Your obligations as holder' },
      list: [
        {
          strong: { fr: 'Des coordonnées exactes', en: 'Accurate details' },
          text: {
            fr: 'Nom, adresse, e-mail et téléphone véridiques et à jour. Un registre qui constate des coordonnées fausses peut suspendre puis supprimer le domaine, et nous ne pouvons pas nous y opposer.',
            en: 'Truthful and up-to-date name, address, e-mail and phone. A registry that finds false details can suspend then delete the domain, and we cannot prevent it.',
          },
        },
        {
          strong: { fr: 'Une adresse e-mail qui fonctionne', en: 'A working e-mail address' },
          text: {
            fr: 'C’est par là que passent les avis de renouvellement et les vérifications du registre. Une adresse morte fait perdre le domaine.',
            en: 'That is how renewal notices and registry verifications reach you. A dead address loses the domain.',
          },
        },
        {
          strong: { fr: 'Le droit sur le nom', en: 'The right to the name' },
          text: {
            fr: 'N’enregistrez pas un nom qui reprend la marque d’un tiers, le nom d’une personne connue, ou celui d’une institution, dans le but de le revendre, de détourner son trafic ou de nuire. Ces enregistrements se perdent en procédure, et nous ne vous y défendrons pas.',
            en: 'Do not register a name that takes a third party’s trade mark, a public figure’s name, or an institution’s name, in order to resell it, divert its traffic or do harm. Such registrations are lost in proceedings, and we will not defend you in them.',
          },
        },
        {
          strong: { fr: 'Les exigences de l’extension', en: 'The extension’s requirements' },
          text: {
            fr: 'Certaines extensions nationales exigent une présence locale, un numéro d’entreprise ou un secteur d’activité. Nous vous l’indiquons avant l’achat ; si vous ne remplissez pas la condition, l’enregistrement est refusé.',
            en: 'Some national extensions require a local presence, a company number or a line of business. We tell you before purchase; if you do not meet the condition, registration is refused.',
          },
        },
      ],
    },
    {
      id: 'refund',
      title: { fr: 'Ce qui n’est pas remboursable', en: 'What is not refundable' },
      paragraphs: [
        {
          fr: 'Un nom de domaine, une fois enregistré auprès du registre, n’est pas remboursable. Ce n’est pas une politique commerciale de notre part : le registre a encaissé la redevance, et il ne la rend pas. Une faute de frappe dans le nom ne change rien à cela.',
          en: 'A domain name, once registered with the registry, is not refundable. That is not a commercial policy of ours: the registry has collected the fee, and it does not return it. A typo in the name does not change that.',
        },
        {
          fr: 'Relisez le nom avant de confirmer. Nous l’affichons une dernière fois, en entier, sur l’écran de confirmation, exactement pour cette raison.',
          en: 'Read the name again before confirming. We display it one last time, in full, on the confirmation screen, for exactly that reason.',
        },
        {
          fr: 'Ce qui est remboursable : un enregistrement qui échoue et dont vous êtes débité — nous recréditons votre portefeuille ; et une recharge non consommée, dans les conditions du contrat général.',
          en: 'What is refundable: a registration that fails and for which you were debited — we credit your wallet back; and an unused top-up, under the general contract’s conditions.',
        },
      ],
    },
    {
      id: 'renewal',
      title: { fr: 'Renouvellement et expiration', en: 'Renewal and expiry' },
      paragraphs: [
        {
          fr: 'Un domaine expire. Nous vous écrivons avant l’échéance, et nous renouvelons automatiquement si votre portefeuille le permet et si vous n’avez pas désactivé le renouvellement.',
          en: 'A domain expires. We write to you before the due date, and we renew automatically if your wallet allows it and you have not switched off renewal.',
        },
        {
          fr: 'Si le renouvellement échoue — solde insuffisant, moyen de paiement indisponible — le domaine entre dans les phases prévues par le registre : une période de grâce où vous pouvez encore le récupérer, souvent à un tarif majoré fixé par le registre, puis une période de rachat, puis la libération du nom. Les durées et les tarifs de ces phases sont ceux du registre, pas les nôtres.',
          en: 'If renewal fails — insufficient balance, unavailable payment method — the domain enters the phases the registry provides for: a grace period where you can still recover it, often at an increased fee set by the registry, then a redemption period, then release of the name. The durations and fees of those phases are the registry’s, not ours.',
        },
        {
          fr: 'Une fois le nom libéré, n’importe qui peut l’enregistrer. Nous ne pouvons pas le réserver pour vous, ni le récupérer.',
          en: 'Once the name is released, anyone can register it. We cannot reserve it for you, nor get it back.',
        },
      ],
      warning: {
        type: 'warning',
        icon: '📅',
        title: {
          fr: 'Supprimer votre compte IDEM ne transfère pas vos domaines',
          en: 'Deleting your IDEM account does not transfer your domains',
        },
        content: {
          fr: 'Si vous supprimez votre compte alors que vous détenez un domaine, nous vous écrivons avant d’agir. Un domaine laissé sans titulaire actif expire et peut être repris par un tiers. Pendant le délai de grâce de votre compte, vous pouvez encore transférer vos domaines vers un autre registraire : demandez-nous le code de transfert à legal@idem.africa, nous vous le remettons.',
          en: 'If you delete your account while holding a domain, we write to you before acting. A domain left without an active holder expires and can be taken by someone else. During your account’s grace period, you can still transfer your domains to another registrar: ask us for the transfer code at legal@idem.africa, and we will provide it.',
        },
      },
    },
    {
      id: 'transfer',
      title: { fr: 'Transférer un domaine', en: 'Transferring a domain' },
      paragraphs: [
        {
          fr: 'Vous pouvez partir avec votre domaine à tout moment. Nous vous remettons le code de transfert et nous débloquons le nom, sans frais et sans discussion.',
          en: 'You can leave with your domain at any time. We provide the transfer code and unlock the name, free of charge and without argument.',
        },
        {
          fr: 'Une seule limite, et elle n’est pas la nôtre : la plupart des registres interdisent le transfert d’un domaine dans les soixante jours suivant son enregistrement ou un changement de titulaire. Nous vous indiquons la date à laquelle le transfert devient possible.',
          en: 'One limit only, and it is not ours: most registries forbid transferring a domain within sixty days of its registration or a change of holder. We tell you the date from which the transfer becomes possible.',
        },
      ],
    },
    {
      id: 'disputes',
      title: { fr: 'Litiges sur un nom', en: 'Disputes over a name' },
      paragraphs: [
        {
          fr: 'Si un tiers conteste votre nom de domaine — titulaire d’une marque, personne homonyme, institution — la procédure est celle du registre, et elle est extérieure à IDEM. Nous ne sommes ni juge ni partie.',
          en: 'If a third party contests your domain name — a trade mark holder, a namesake, an institution — the procedure is the registry’s, and it is external to IDEM. We are neither judge nor party.',
        },
        {
          fr: 'Notre rôle : vous transmettre la réclamation, vous fournir les pièces techniques dont vous avez besoin, et exécuter la décision qui en résulte. Nous ne transférons ni ne suspendons un domaine sur simple allégation, mais nous exécutons une décision rendue.',
          en: 'Our role: to forward the claim to you, provide the technical records you need, and carry out the resulting decision. We neither transfer nor suspend a domain on a mere allegation, but we do carry out a decision once rendered.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Code de transfert, correction de coordonnées, litige, question sur une extension : legal@idem.africa. Problème technique de DNS ou de configuration : support@idem.africa.',
          en: 'A transfer code, correcting details, a dispute, a question about an extension: legal@idem.africa. A technical DNS or configuration problem: support@idem.africa.',
        },
      ],
    },
  ],
};
