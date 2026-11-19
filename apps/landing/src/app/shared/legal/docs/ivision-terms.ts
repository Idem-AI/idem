/**
 * Règles d’utilisation propres à iVision.
 *
 * Un outil qui fabrique des vidéos et des visuels publiables soulève des
 * questions que les conditions générales ne traitent pas : le visage d’une
 * personne réelle, la voix, la marque d’un tiers, et la publication
 * automatique sur un compte social.
 */

import type { LegalDocContent } from '../content.model';

export const IVISION_TERMS: LegalDocContent = {
  id: 'ivision-terms',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Règles d’utilisation — iVision', en: 'Usage rules — iVision' },
  subtitle: {
    fr: 'Ce que vous pouvez produire et publier, ce que vous ne pouvez pas faire générer, et à qui appartiennent les vidéos et les visuels qui en sortent.',
    en: 'What you may produce and publish, what you may not have generated, and who owns the videos and visuals that come out of it.',
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
          fr: 'Les conditions générales d’utilisation d’IDEM s’appliquent entièrement à iVision. Ces règles n’ajoutent que ce qui est propre à la fabrication de vidéos, de visuels et de sites, et l’emportent pour iVision en cas de contradiction.',
          en: 'The IDEM terms of service apply to iVision in full. These rules add only what is specific to making videos, visuals and sites, and prevail for iVision in the event of a conflict.',
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
      ],
    },
    {
      id: 'ownership',
      title: { fr: 'Ce qui sort d’iVision est à vous', en: 'What comes out of iVision is yours' },
      paragraphs: [
        {
          fr: 'Vidéos, visuels, voix off, sites et chartes produits à partir de votre demande vous sont cédés, pour un usage commercial compris, sans redevance et sans limite de durée ni de territoire.',
          en: 'Videos, visuals, voice-overs, sites and charters produced from your request are assigned to you, commercial use included, royalty-free and with no limit of duration or territory.',
        },
        {
          fr: 'Deux réserves que nous ne pouvons pas lever. Nous ne garantissons pas l’exclusivité : un modèle peut produire des résultats proches pour deux demandes proches. Et nous ne garantissons pas la protection au titre du droit d’auteur, qui, pour une création générée par machine, n’est pas tranchée de la même façon partout.',
          en: 'Two reservations we cannot lift. We do not guarantee exclusivity: a model can produce similar results for two similar requests. And we do not guarantee copyright protection, which, for a machine-generated work, is not settled the same way everywhere.',
        },
        {
          fr: 'Quand une génération échoue et que nous retombons sur une photographie de banque libre, cette photographie reste sous la licence de sa banque — généreuse, mais pas identique à une cession. Nous vous l’indiquons dans le projet.',
          en: 'When a generation fails and we fall back on a free stock photograph, that photograph remains under its library’s licence — generous, but not identical to an assignment. We mark it in the project.',
        },
      ],
    },
    {
      id: 'people',
      title: { fr: 'Les personnes réelles', en: 'Real people' },
      paragraphs: [
        {
          fr: 'C’est l’interdiction la plus importante de ce texte, et celle qui protège le plus de monde.',
          en: 'This is the most important prohibition in this text, and the one that protects the most people.',
        },
      ],
      warning: {
        type: 'error',
        icon: '🚫',
        title: {
          fr: 'Pas de visage, pas de voix, pas d’identité volés',
          en: 'No stolen face, voice or identity',
        },
        content: {
          fr: 'Vous ne pouvez pas faire générer le visage ou la voix d’une personne réelle, ni faire dire ou faire faire quelque chose à quelqu’un qui ne l’a pas dit ou fait. Cela vaut pour les personnes connues comme pour vos voisins. Vous ne pouvez pas non plus déposer la photo d’une personne identifiable sans son accord pour l’usage et le support que vous visez. Un manquement ici entraîne le retrait immédiat du contenu et, selon la gravité, la fermeture du compte.',
          en: 'You may not have a real person’s face or voice generated, nor make someone say or do something they did not say or do. That applies to public figures as much as to your neighbours. Nor may you upload the photo of an identifiable person without their agreement for the use and the medium you intend. A breach here leads to the immediate removal of the content and, depending on severity, the closure of the account.',
        },
      },
      list: [
        {
          text: {
            fr: 'Si vous apparaissez vous-même, c’est permis : c’est votre image.',
            en: 'If you appear yourself, that is allowed: it is your own image.',
          },
        },
        {
          text: {
            fr: 'Si un collaborateur ou un client apparaît, obtenez son accord écrit, et conservez-le. Nous ne vous le demanderons pas, mais une plainte vous le demandera.',
            en: 'If a colleague or a customer appears, obtain their written agreement, and keep it. We will not ask you for it, but a complaint will.',
          },
        },
        {
          text: {
            fr: 'Si une image de vous apparaît dans une création IDEM sans votre accord, écrivez à legal@idem.africa : nous la retirons.',
            en: 'If an image of you appears in an IDEM creation without your agreement, write to legal@idem.africa: we take it down.',
          },
        },
      ],
    },
    {
      id: 'brands',
      title: { fr: 'Les marques et les œuvres des autres', en: 'Other people’s brands and works' },
      paragraphs: [
        {
          fr: 'Ne faites pas produire une vidéo ou un visuel qui reprend le logo, la charte, le slogan ou l’univers visuel d’une marque que vous ne détenez pas, ni qui laisse croire à un partenariat ou à une approbation qui n’existe pas.',
          en: 'Do not have a video or visual produced that takes a logo, charter, slogan or visual world of a brand you do not own, nor that suggests a partnership or endorsement that does not exist.',
        },
        {
          fr: 'Si vous collez l’adresse d’un site pour qu’iVision en tire une direction artistique, faites-le pour un site dont vous avez le droit de reprendre l’identité. Reprendre celle d’un concurrent est un manquement.',
          en: 'If you paste a site’s address so iVision can derive an art direction from it, do it for a site whose identity you have the right to reuse. Taking a competitor’s identity is a breach.',
        },
        {
          fr: 'La musique et les polices utilisées dans vos vidéos viennent de sources dont nous détenons les droits d’usage. Ne remplacez pas une piste par un morceau commercial sans licence.',
          en: 'The music and fonts used in your videos come from sources for which we hold usage rights. Do not replace a track with a commercial piece without a licence.',
        },
      ],
    },
    {
      id: 'content',
      title: { fr: 'Ce que nous refusons de produire', en: 'What we refuse to produce' },
      paragraphs: [
        {
          fr: 'Certaines demandes sont refusées, quelle que soit la justification avancée.',
          en: 'Some requests are refused, whatever justification is offered.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Contenu sexuel, contenu impliquant des mineurs, violence gratuite, apologie du terrorisme, incitation à la haine.',
            en: 'Sexual content, content involving minors, gratuitous violence, glorification of terrorism, incitement to hatred.',
          },
        },
        {
          text: {
            fr: 'Fausse information présentée comme vraie : faux témoignage, faux avis, fausse étude, faux communiqué, faux résultat médical ou financier.',
            en: 'False information presented as true: fake testimonial, fake review, fake study, fake press release, fake medical or financial result.',
          },
        },
        {
          text: {
            fr: 'Publicité trompeuse : promesse de gain, remède miracle, garantie de résultat que vous ne pouvez pas tenir.',
            en: 'Misleading advertising: promises of gains, miracle cures, guarantees of results you cannot honour.',
          },
        },
        {
          text: {
            fr: 'Usurpation d’une institution : vidéo qui se présente comme émanant d’une banque, d’une administration, d’un média ou d’une organisation réelle.',
            en: 'Impersonating an institution: a video presenting itself as coming from a bank, a public body, a media outlet or a real organisation.',
          },
        },
      ],
    },
    {
      id: 'publishing',
      title: { fr: 'La publication et la validation', en: 'Publishing and approval' },
      paragraphs: [
        {
          fr: 'Rien n’est publié sans votre validation. Si vous activez les propositions par WhatsApp, la proposition du jour vous est envoyée, et c’est votre réponse qui déclenche la publication — jamais l’inverse.',
          en: 'Nothing is published without your approval. If you switch on WhatsApp proposals, the day’s proposal is sent to you, and it is your reply that triggers publication — never the other way round.',
        },
        {
          fr: 'Une fois publié sur un réseau, le contenu est soumis aux règles de ce réseau, qui peut le retirer sans nous consulter. Le supprimer dans iVision ne le supprime pas là-bas : utilisez les outils du réseau.',
          en: 'Once published to a network, the content is subject to that network’s rules, which may take it down without consulting us. Deleting it in iVision does not delete it there: use the network’s own tools.',
        },
        {
          fr: 'Vous restez responsable de la conformité de vos publications aux règles de la publicité de votre pays et de votre secteur — mentions obligatoires comprises.',
          en: 'You remain responsible for your publications’ compliance with the advertising rules of your country and your sector — mandatory disclosures included.',
        },
      ],
    },
    {
      id: 'billing',
      title: { fr: 'Ce qui est facturé', en: 'What is billed' },
      paragraphs: [
        {
          fr: 'Chaque vidéo, chaque visuel et chaque site est débité du portefeuille au prix annoncé avant de lancer la fabrication. Le niveau de créativité que vous choisissez change la gamme de gabarits utilisée, pas le prix.',
          en: 'Each video, each visual and each site is debited from the wallet at the price announced before launching production. The creativity level you choose changes the range of templates used, not the price.',
        },
        {
          fr: 'Une fabrication échouée n’est pas débitée ; si elle l’a été, nous recréditons. Une retouche est une nouvelle fabrication, annoncée et facturée comme telle.',
          en: 'A failed production is not debited; if it was, we credit it back. An edit is a new production, announced and billed as such.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Retrait d’une image ou d’une voix, signalement d’un contenu, contestation d’une mesure : legal@idem.africa. Problème de fabrication : support@idem.africa.',
          en: 'Removal of an image or a voice, reporting content, contesting a measure: legal@idem.africa. A production problem: support@idem.africa.',
        },
      ],
    },
  ],
};
