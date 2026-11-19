/**
 * Règles d’utilisation propres à iCode.
 *
 * Un atelier qui écrit du code, l’exécute dans un conteneur et le met en ligne
 * ouvre des usages que les conditions générales ne pouvaient pas anticiper :
 * le conteneur comme machine de calcul, le code généré comme produit, la
 * refonte d’un site dont on n’est pas le titulaire.
 */

import type { LegalDocContent } from '../content.model';

export const ICODE_TERMS: LegalDocContent = {
  id: 'icode-terms',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Règles d’utilisation — iCode', en: 'Usage rules — iCode' },
  subtitle: {
    fr: 'Ce que vous pouvez faire de l’atelier, ce que vous ne pouvez pas en faire, et à qui appartient le code qui en sort.',
    en: 'What you may do with the workshop, what you may not, and who owns the code that comes out of it.',
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
          fr: 'Les conditions générales d’utilisation d’IDEM s’appliquent entièrement à iCode. Ces règles n’ajoutent que ce qui est propre à l’atelier de code. En cas de contradiction, elles l’emportent pour iCode.',
          en: 'The IDEM terms of service apply to iCode in full. These rules add only what is specific to the code workshop. In the event of a conflict, they prevail for iCode.',
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
      title: {
        fr: 'Le code qui sort de l’atelier est à vous',
        en: 'The code that comes out of the workshop is yours',
      },
      paragraphs: [
        {
          fr: 'Le code, les textes, les images et la configuration produits pour votre projet vous sont cédés. Vous pouvez les télécharger, les modifier, les héberger ailleurs, les vendre, et en faire ce que vous voulez. Nous ne gardons aucun droit dessus, et nous ne vous imposons pas d’héberger chez nous.',
          en: 'The code, texts, images and configuration produced for your project are assigned to you. You can download them, modify them, host them elsewhere, sell them, and do what you want with them. We keep no rights over them, and we do not require you to host with us.',
        },
        {
          fr: 'Ce qui n’est pas à vous : les gabarits, les catalogues de sections et les moteurs de l’atelier. Ils restent à nous, et notre licence open source dit ce que vous pouvez en faire. Le code assemblé pour votre projet, lui, est à vous sans réserve.',
          en: 'What is not yours: the templates, section catalogues and workshop engines. They stay ours, and our open source licence says what you may do with them. The code assembled for your project is yours without reservation.',
        },
        {
          fr: 'Les projets reposent sur des bibliothèques tierces, chacune avec sa licence. Nous n’utilisons que des licences permissives, mais c’est à vous de vérifier qu’elles conviennent à votre usage — en particulier si vous revendez le résultat.',
          en: 'Projects rely on third-party libraries, each with its own licence. We use only permissive licences, but it is for you to check they suit your use — in particular if you resell the result.',
        },
      ],
    },
    {
      id: 'check',
      title: { fr: 'Vérifiez avant de publier', en: 'Check before publishing' },
      paragraphs: [
        {
          fr: 'Un site généré est un brouillon avancé, pas un livrable validé. Avant de le mettre en ligne sous votre nom, relisez-le.',
          en: 'A generated site is an advanced draft, not an approved deliverable. Before putting it online under your name, read it.',
        },
      ],
      list: [
        {
          strong: { fr: 'Les textes', en: 'The texts' },
          text: {
            fr: 'Un modèle peut inventer un chiffre, une référence, un témoignage ou une mention légale. Publier une fausse mention vous expose, pas nous.',
            en: 'A model can invent a figure, a reference, a testimonial or a legal notice. Publishing a false statement exposes you, not us.',
          },
        },
        {
          strong: { fr: 'Les images', en: 'The images' },
          text: {
            fr: 'Vérifiez que chaque image que vous publiez vous appartient ou est libre d’usage pour votre support.',
            en: 'Check that every image you publish belongs to you or is free to use for your medium.',
          },
        },
        {
          strong: { fr: 'Les obligations de votre site', en: 'Your site’s own obligations' },
          text: {
            fr: 'Mentions légales, politique de confidentialité, conditions de vente, bandeau cookies : c’est à vous de les écrire. Un formulaire de contact suffit à les rendre nécessaires.',
            en: 'Legal notices, privacy policy, sales terms, cookie banner: it is for you to write them. A contact form alone makes them necessary.',
          },
        },
        {
          strong: { fr: 'La sécurité', en: 'Security' },
          text: {
            fr: 'Si votre projet traite des paiements, des mots de passe ou des données de santé, faites-le auditer. Nous ne garantissons pas que le code généré soit exempt de faille.',
            en: 'If your project handles payments, passwords or health data, have it audited. We do not warrant that the generated code is free of flaws.',
          },
        },
      ],
    },
    {
      id: 'redesign',
      title: { fr: 'La refonte d’un site existant', en: 'Redesigning an existing site' },
      paragraphs: [
        {
          fr: 'Vous pouvez faire refondre un site en collant son adresse. En le faisant, vous déclarez être le titulaire de ce site, ou agir pour son titulaire.',
          en: 'You can have a site redesigned by pasting its address. In doing so, you declare that you own that site, or act for its owner.',
        },
        {
          fr: 'Refondre le site d’un tiers pour vous l’approprier, copier l’identité d’un concurrent, ou reproduire une marque que vous ne détenez pas est un manquement à ces règles. Nous refusons ces refontes quand nous les repérons, et nous retirons un relevé sur demande du titulaire du site concerné.',
          en: 'Redesigning a third party’s site to appropriate it, copying a competitor’s identity, or reproducing a trade mark you do not hold is a breach of these rules. We refuse such redesigns when we spot them, and we remove a survey on request from the owner of the site concerned.',
        },
      ],
    },
    {
      id: 'container',
      title: {
        fr: 'L’atelier n’est pas une machine de calcul',
        en: 'The workshop is not a compute machine',
      },
      paragraphs: [
        {
          fr: 'Le conteneur de l’atelier existe pour écrire, exécuter et prévisualiser votre projet. Il est dimensionné pour cela, et sa puissance est partagée.',
          en: 'The workshop container exists to write, run and preview your project. It is sized for that, and its power is shared.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Pas de minage de cryptomonnaie, pas de calcul distribué, pas d’entraînement de modèle, pas de rendu massif.',
            en: 'No cryptocurrency mining, no distributed computing, no model training, no bulk rendering.',
          },
        },
        {
          text: {
            fr: 'Pas de scan, de force brute, d’attaque ni de relais de trafic vers des tiers depuis le conteneur.',
            en: 'No scanning, brute forcing, attacks or traffic relaying towards third parties from the container.',
          },
        },
        {
          text: {
            fr: 'Pas de service permanent : un aperçu est un aperçu. Pour faire tourner une application en continu, passez par l’hébergement.',
            en: 'No permanent service: a preview is a preview. To run an application continuously, go through hosting.',
          },
          link: { label: { fr: 'Règles iDeploy', en: 'iDeploy rules' }, href: '/terms/ideploy' },
        },
        {
          text: {
            fr: 'Pas de tentative de sortir du conteneur, d’atteindre une autre machine, ou de lire l’atelier d’un autre utilisateur. Si vous trouvez une faille qui le permet, signalez-la à support@idem.africa : nous la corrigeons et nous vous en remercions.',
            en: 'No attempt to escape the container, reach another machine, or read another user’s workshop. If you find a flaw that allows it, report it to support@idem.africa: we fix it and we thank you for it.',
          },
        },
      ],
    },
    {
      id: 'billing',
      title: {
        fr: 'Ce qui est facturé, et ce qui ne l’est pas',
        en: 'What is billed, and what is not',
      },
      paragraphs: [
        {
          fr: 'Chaque génération est débitée de votre portefeuille au prix annoncé avant de la lancer. Le prix dépend du type de projet et du niveau de créativité que vous choisissez.',
          en: 'Each generation is debited from your wallet at the price announced before you launch it. The price depends on the project type and the creativity level you choose.',
        },
      ],
      list: [
        {
          strong: { fr: 'Reprendre un projet', en: 'Resuming a project' },
          text: {
            fr: 'Dire « continue » reprend là où le plan s’était arrêté, et ne refacture pas ce qui est déjà construit.',
            en: 'Saying “continue” resumes where the plan stopped, and does not re-charge for what is already built.',
          },
        },
        {
          strong: { fr: 'Une génération échouée', en: 'A failed generation' },
          text: {
            fr: 'N’est pas débitée. Si elle l’a été, écrivez-nous : nous recréditons.',
            en: 'Is not debited. If it was, write to us: we credit it back.',
          },
        },
        {
          strong: { fr: 'Une retouche', en: 'An edit' },
          text: {
            fr: 'Est facturée comme une génération, parce qu’elle en est une. Le prix est annoncé avant.',
            en: 'Is billed as a generation, because it is one. The price is announced beforehand.',
          },
        },
        {
          strong: { fr: 'L’aperçu', en: 'The preview' },
          text: {
            fr: 'N’est pas facturé. Il est en revanche borné dans le temps : un atelier inactif est arrêté, et votre projet est conservé.',
            en: 'Is not billed. It is, however, time-bounded: an idle workshop is stopped, and your project is kept.',
          },
        },
      ],
    },
    {
      id: 'limits',
      title: { fr: 'Ce que nous ne garantissons pas', en: 'What we do not guarantee' },
      paragraphs: [
        {
          fr: 'Que le code généré compile du premier coup, qu’il corresponde exactement à l’image que vous aviez en tête, qu’il soit identique si vous relancez la même demande, ou qu’il soit unique — deux demandes proches peuvent produire deux sites proches.',
          en: 'That the generated code compiles on the first try, that it matches exactly the picture you had in mind, that it is identical if you relaunch the same request, or that it is unique — two similar requests can produce two similar sites.',
        },
        {
          fr: 'Ce que nous garantissons : que le projet vous appartient, que vous pouvez le télécharger à tout moment, et qu’un échec de notre fait ne vous est pas facturé.',
          en: 'What we do guarantee: that the project is yours, that you can download it at any time, and that a failure on our side is not billed to you.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Contestation d’une mesure, question sur ces règles, signalement d’un abus : legal@idem.africa. Faille de sécurité ou problème technique : support@idem.africa.',
          en: 'Contesting a measure, a question about these rules, reporting abuse: legal@idem.africa. A security flaw or a technical problem: support@idem.africa.',
        },
      ],
    },
  ],
};
