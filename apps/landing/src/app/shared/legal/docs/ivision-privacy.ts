/**
 * Complément de confidentialité propre à iVision.
 *
 * iVision est le seul service qui traite de la voix — la vôtre, quand vous
 * dictez, et une voix de synthèse pour la narration — et des images de
 * personnes. Ce sont des données qui méritent d’être nommées plutôt que
 * noyées dans « vos contenus ».
 */

import type { LegalDocContent } from '../content.model';

export const IVISION_PRIVACY: LegalDocContent = {
  id: 'ivision-privacy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Confidentialité — iVision', en: 'Privacy — iVision' },
  subtitle: {
    fr: 'Ce que l’atelier de création ajoute à la politique globale : votre voix, les images que vous déposez, celles que nous générons, et ce que la publication sur un réseau social emporte.',
    en: 'What the creative workshop adds to the global policy: your voice, the images you upload, the ones we generate, and what publishing to a social network entails.',
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
          fr: 'La politique de confidentialité d’IDEM s’applique entièrement à iVision. Ce complément n’ajoute que ce qui est propre à la fabrication de vidéos, de visuels et de sites.',
          en: 'The IDEM privacy policy applies to iVision in full. This addendum adds only what is specific to making videos, visuals and sites.',
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
      id: 'voice',
      title: { fr: 'Votre voix', en: 'Your voice' },
      paragraphs: [
        {
          fr: 'Vous pouvez dicter votre demande au lieu de l’écrire. Dans ce cas, l’enregistrement est transcrit en texte, et c’est le texte qui part vers le modèle qui fabrique la vidéo.',
          en: 'You can dictate your request instead of writing it. In that case, the recording is transcribed into text, and it is the text that goes to the model that makes the video.',
        },
        {
          fr: 'La transcription a lieu sur nos propres machines, avec un modèle que nous hébergeons : votre enregistrement ne part donc pas chez un fournisseur tiers pour être transcrit. L’audio est supprimé dès la transcription obtenue ; seul le texte est conservé avec votre projet.',
          en: 'Transcription happens on our own machines, with a model we host: your recording therefore does not go to a third-party provider to be transcribed. The audio is deleted as soon as the transcription is obtained; only the text is kept with your project.',
        },
        {
          fr: 'Une voix est une donnée biométrique dans plusieurs des pays que nous servons. Nous ne construisons donc aucune empreinte vocale, nous ne vous identifions pas par la voix, et nous n’utilisons pas votre enregistrement pour entraîner un modèle de voix.',
          en: 'A voice is biometric data in several of the countries we serve. We therefore build no voiceprint, we do not identify you by voice, and we do not use your recording to train a voice model.',
        },
        {
          fr: 'La voix off de vos vidéos est une voix de synthèse, choisie dans un catalogue. Elle n’imite personne, et ce n’est pas la vôtre.',
          en: 'The voice-over in your videos is a synthetic voice, chosen from a catalogue. It imitates nobody, and it is not yours.',
        },
      ],
    },
    {
      id: 'images',
      title: { fr: 'Les images que vous déposez', en: 'The images you upload' },
      paragraphs: [
        {
          fr: 'Vous pouvez déposer un logo, une photo de produit, une photo d’équipe. Ces fichiers sont stockés sur notre infrastructure, rattachés à votre projet, et envoyés au modèle quand la génération en a besoin — pour reprendre vos couleurs, votre logo ou votre cadrage.',
          en: 'You can upload a logo, a product photo, a team photo. Those files are stored on our infrastructure, attached to your project, and sent to the model when the generation needs them — to pick up your colours, your logo or your framing.',
        },
        {
          fr: 'Vos photos ne sont jamais retouchées à votre place : nous avons retiré les filtres, les duotones et les vectorisations, et un contrôle automatique vérifie qu’aucune consigne de génération ne demande de transformer une photographie. Ce que vous déposez est ce qui est affiché.',
          en: 'Your photos are never altered on your behalf: we removed filters, duotones and vectorisation, and an automated check verifies that no generation instruction asks for a photograph to be transformed. What you upload is what is shown.',
        },
      ],
      warning: {
        type: 'warning',
        icon: '👤',
        title: {
          fr: 'Une photo de personne exige son accord',
          en: 'A photo of a person requires their agreement',
        },
        content: {
          fr: 'Si vous déposez l’image d’une personne identifiable — un collaborateur, un client, un modèle — vous devez avoir son accord pour l’utiliser dans la vidéo ou le visuel que vous produisez, et pour le support où vous allez le publier. C’est vous qui en répondez, pas nous. Ne déposez pas la photo d’un tiers que vous ne pouvez pas joindre, et ne faites pas générer le visage d’une personne réelle.',
          en: 'If you upload the image of an identifiable person — a colleague, a customer, a model — you must have their agreement to use it in the video or visual you produce, and for the medium where you will publish it. You answer for that, not us. Do not upload a third party’s photo if you cannot reach them, and do not have a real person’s face generated.',
        },
      },
    },
    {
      id: 'generated',
      title: { fr: 'Les médias que nous générons', en: 'The media we generate' },
      paragraphs: [
        {
          fr: 'Les images et les plans vidéo de vos films sont produits par des modèles, à partir de votre demande. Quand la génération échoue, nous retombons sur une banque de photographies libres : la requête envoyée à cette banque ne contient que des mots-clés, jamais votre projet ni vos fichiers.',
          en: 'The images and video shots of your films are produced by models, from your request. When generation fails, we fall back on a stock photo library: the request sent to that library contains only keywords, never your project nor your files.',
        },
        {
          fr: 'Les médias générés sont stockés avec votre projet et vous appartiennent, dans les limites que les conditions générales décrivent — un modèle peut produire des résultats proches pour deux demandes proches, et nous ne pouvons donc pas vous garantir l’exclusivité.',
          en: 'Generated media is stored with your project and belongs to you, within the limits the terms of service describe — a model can produce similar results for two similar requests, so we cannot guarantee you exclusivity.',
        },
      ],
    },
    {
      id: 'brand',
      title: { fr: 'Votre marque, si vous en avez une', en: 'Your brand, if you have one' },
      paragraphs: [
        {
          fr: 'iVision n’exige jamais de marque. Vous pouvez produire une vidéo sans projet, sans charte et sans logo. Si vous en fournissez une, ou si vous laissez iVision la déduire d’un site existant, ses couleurs, ses polices et son logo sont conservés pour que vos créations suivantes s’y conforment.',
          en: 'iVision never requires a brand. You can produce a video with no project, no charter and no logo. If you provide one, or let iVision derive it from an existing site, its colours, fonts and logo are kept so your later creations match it.',
        },
        {
          fr: 'Si vous collez l’adresse d’un site pour qu’iVision en tire une direction artistique, ce site est lu publiquement, comme le ferait un navigateur. Ne le faites que pour un site dont vous avez le droit de reprendre l’identité.',
          en: 'If you paste a site’s address so iVision can derive an art direction from it, that site is read publicly, as a browser would. Do this only for a site whose identity you have the right to reuse.',
        },
      ],
    },
    {
      id: 'publishing',
      title: { fr: 'La publication sur un réseau social', en: 'Publishing to a social network' },
      paragraphs: [
        {
          fr: 'Publier est toujours une action que vous déclenchez. Rien n’est publié automatiquement sans que vous l’ayez validé — y compris quand la validation passe par WhatsApp.',
          en: 'Publishing is always an action you trigger. Nothing is published automatically without your approval — including when the approval goes through WhatsApp.',
        },
        {
          fr: 'Quand vous reliez un compte, nous recevons un jeton d’accès, stocké chiffré, et nous l’utilisons uniquement pour publier ce que vous avez validé. Une fois publié, le contenu est entre les mains du réseau : sa politique s’applique, et le supprimer chez nous ne le supprime pas chez lui.',
          en: 'When you connect an account, we receive an access token, stored encrypted, and we use it only to publish what you approved. Once published, the content is in the network’s hands: its policy applies, and deleting it with us does not delete it there.',
        },
        {
          fr: 'Si vous activez les propositions par WhatsApp, votre numéro est conservé chiffré tant que le lien existe, avec l’historique des messages nécessaires au suivi. Retirer le lien supprime les deux.',
          en: 'If you switch on WhatsApp proposals, your number is kept encrypted while the link exists, with the message history needed to follow up. Removing the link deletes both.',
        },
      ],
    },
    {
      id: 'retention',
      title: { fr: 'Durées propres à iVision', en: 'Durations specific to iVision' },
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Enregistrement vocal', en: 'Voice recording' },
            {
              fr: 'Supprimé dès la transcription obtenue',
              en: 'Deleted as soon as the transcription is obtained',
            },
          ],
          [
            { fr: 'Transcription', en: 'Transcription' },
            {
              fr: 'Conservée avec le projet, effacée avec lui',
              en: 'Kept with the project, erased with it',
            },
          ],
          [
            { fr: 'Fichiers déposés et médias générés', en: 'Uploaded files and generated media' },
            {
              fr: 'Tant que le projet existe ; effacés 30 jours après sa suppression',
              en: 'As long as the project exists; erased 30 days after it is deleted',
            },
          ],
          [
            { fr: 'Vidéos et visuels finis', en: 'Finished videos and visuals' },
            {
              fr: 'Idem. Téléchargez-les si vous voulez les garder au-delà',
              en: 'The same. Download them if you want to keep them beyond that',
            },
          ],
          [
            { fr: 'Marque et charte', en: 'Brand and charter' },
            {
              fr: 'Liées au compte ; une marque provisoire est supprimée si vous ne la conservez pas',
              en: 'Tied to the account; a provisional brand is deleted if you do not keep it',
            },
          ],
          [
            { fr: 'Jetons de réseaux sociaux', en: 'Social network tokens' },
            {
              fr: 'Chiffrés, supprimés quand vous retirez le lien',
              en: 'Encrypted, deleted when you remove the link',
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
          fr: 'Question sur ce texte, retrait d’une image, exercice d’un droit : legal@idem.africa. Si une image de vous a été utilisée dans une création IDEM sans votre accord, écrivez-nous à cette même adresse : nous la retirons.',
          en: 'A question about this text, removal of an image, exercising a right: legal@idem.africa. If an image of you has been used in an IDEM creation without your agreement, write to us at that same address: we take it down.',
        },
      ],
    },
  ],
};
