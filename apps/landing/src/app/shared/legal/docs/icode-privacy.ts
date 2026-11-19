/**
 * Complément de confidentialité propre à iCode.
 *
 * Trois traitements que la politique globale ne couvre pas : le dépôt GitHub
 * que vous reliez, l’atelier qui exécute du code dans un conteneur, et le
 * relevé d’un site existant quand vous demandez une refonte — un site qui
 * n’est pas forcément le vôtre.
 */

import type { LegalDocContent } from '../content.model';

export const ICODE_PRIVACY: LegalDocContent = {
  id: 'icode-privacy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Confidentialité — iCode', en: 'Privacy — iCode' },
  subtitle: {
    fr: 'Ce que l’atelier de code ajoute à la politique globale : votre dépôt GitHub, le conteneur qui exécute votre projet, et le relevé du site que vous demandez à refondre.',
    en: 'What the code workshop adds to the global policy: your GitHub repository, the container that runs your project, and the survey of the site you ask us to redesign.',
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
          fr: 'La politique de confidentialité d’IDEM s’applique entièrement à iCode. Ce complément n’ajoute que ce qui est propre à l’atelier de code.',
          en: 'The IDEM privacy policy applies to iCode in full. This addendum adds only what is specific to the code workshop.',
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
      id: 'project',
      title: {
        fr: 'Ce que nous traitons pour écrire votre projet',
        en: 'What we process to write your project',
      },
      paragraphs: [
        {
          fr: 'Vous décrivez ce que vous voulez, en français, en anglais ou dans la langue de votre choix. Cette demande, et les corrections que vous demandez ensuite, sont envoyées au modèle qui écrit le code. Elles sont conservées avec votre projet pour que vous puissiez reprendre là où vous en étiez, même plusieurs jours plus tard.',
          en: 'You describe what you want, in French, English or the language of your choice. That request, and the corrections you ask for afterwards, are sent to the model that writes the code. They are kept with your project so you can resume where you left off, even days later.',
        },
      ],
      list: [
        {
          strong: { fr: 'Votre demande et vos échanges', en: 'Your request and your exchanges' },
          text: {
            fr: 'Le texte que vous écrivez, les images que vous joignez, les choix que vous cliquez. Conservés avec le projet, supprimés avec lui.',
            en: 'The text you write, the images you attach, the choices you click. Kept with the project, deleted with it.',
          },
        },
        {
          strong: { fr: 'Les fichiers du projet', en: 'The project’s files' },
          text: {
            fr: 'Le code, les textes, les images et la configuration produits pour vous. Stockés sur notre infrastructure et enregistrés régulièrement pour qu’une coupure ne vous fasse pas tout perdre.',
            en: 'The code, texts, images and configuration produced for you. Stored on our infrastructure and saved regularly so that a disconnection does not lose everything.',
          },
        },
        {
          strong: { fr: 'Le plan du projet', en: 'The project plan' },
          text: {
            fr: 'Ce qui a été fait et ce qui reste à faire, pour que « continue » reprenne sans vous refacturer ce qui est déjà construit.',
            en: 'What has been done and what remains, so that “continue” resumes without charging you again for what is already built.',
          },
        },
        {
          strong: { fr: 'Les erreurs rencontrées', en: 'The errors encountered' },
          text: {
            fr: 'Les messages d’erreur de votre projet, pour vous proposer un correctif. Ils peuvent contenir des extraits de votre code : ils sont donc traités comme votre code.',
            en: 'Your project’s error messages, so we can offer a fix. They may contain fragments of your code: they are therefore treated as your code.',
          },
        },
      ],
    },
    {
      id: 'container',
      title: { fr: 'L’atelier et son aperçu', en: 'The workshop and its preview' },
      paragraphs: [
        {
          fr: 'Votre projet est écrit et exécuté dans un conteneur qui n’est qu’à vous, isolé de celui des autres. L’aperçu que vous voyez est votre projet qui tourne réellement : il exécute donc le code qui vient d’être écrit.',
          en: 'Your project is written and run in a container that is yours alone, isolated from everyone else’s. The preview you see is your project actually running: it therefore executes the code that was just written.',
        },
        {
          fr: 'Deux conséquences. D’une part, si vous saisissez des données réelles dans cet aperçu — un vrai client, un vrai numéro — elles sont stockées dans la base de l’aperçu, qui vit sur notre infrastructure ou dans votre navigateur selon le type de projet. Utilisez des données de test. D’autre part, le conteneur est détruit avec le projet : rien n’y survit.',
          en: 'Two consequences. First, if you enter real data in that preview — a real customer, a real phone number — it is stored in the preview’s database, which lives on our infrastructure or in your browser depending on the project type. Use test data. Second, the container is destroyed with the project: nothing survives in it.',
        },
      ],
    },
    {
      id: 'github',
      title: { fr: 'Votre dépôt GitHub', en: 'Your GitHub repository' },
      paragraphs: [
        {
          fr: 'Relier GitHub est facultatif, et vous pouvez travailler sans. Si vous le reliez, nous recevons un jeton d’accès à vos dépôts, que nous stockons chiffré avec une clé propre à votre compte.',
          en: 'Connecting GitHub is optional, and you can work without it. If you connect it, we receive an access token to your repositories, which we store encrypted with a key specific to your account.',
        },
        {
          fr: 'Nous ne lisons et n’écrivons que les dépôts que vous désignez pour un projet. Nous ne parcourons pas votre compte, nous ne clonons rien d’autre, et nous n’envoyons aucun contenu de dépôt à un modèle sans que ce soit nécessaire à ce que vous avez demandé.',
          en: 'We read and write only the repositories you designate for a project. We do not browse your account, we clone nothing else, and we send no repository content to a model unless it is necessary for what you asked.',
        },
        {
          fr: 'Retirer le lien révoque le jeton de notre côté et supprime la valeur chiffrée. Vous pouvez aussi le révoquer directement depuis GitHub, ce qui est plus sûr : cela ne dépend plus de nous.',
          en: 'Removing the link revokes the token on our side and deletes the encrypted value. You can also revoke it directly from GitHub, which is safer: it then no longer depends on us.',
        },
      ],
    },
    {
      id: 'redesign',
      title: { fr: 'Le relevé d’un site existant', en: 'Surveying an existing site' },
      paragraphs: [
        {
          fr: 'Quand vous demandez la refonte d’un site, iCode va lire ce site : ses pages publiques, ses textes, ses images, ses couleurs et ses polices, pour pouvoir le reconstruire. C’est un accès public, comme celui d’un navigateur ou d’un moteur de recherche.',
          en: 'When you ask for a site to be redesigned, iCode reads that site: its public pages, texts, images, colours and fonts, so it can rebuild it. That is public access, like a browser’s or a search engine’s.',
        },
        {
          fr: 'Ce relevé est conservé avec votre projet le temps de la refonte, puis supprimé avec lui. Nous ne lisons que ce qui est accessible sans authentification, et nous respectons les signaux de refus d’indexation du site.',
          en: 'That survey is kept with your project for the duration of the redesign, then deleted with it. We read only what is accessible without authentication, and we respect the site’s crawling refusal signals.',
        },
      ],
      warning: {
        type: 'warning',
        icon: '⚠️',
        title: {
          fr: 'Ne faites relever que les sites que vous avez le droit de refondre',
          en: 'Only have us survey sites you have the right to redesign',
        },
        content: {
          fr: 'En lançant une refonte, vous déclarez être le titulaire du site ou agir pour lui. Si ce site contient des données personnelles — un annuaire d’employés, une liste de clients, des témoignages — elles sont relevées avec le reste, et c’est vous qui en répondez. Nous refusons les refontes de sites manifestement appartenant à un tiers, et nous retirons un relevé sur simple demande du titulaire du site concerné, à legal@idem.africa.',
          en: 'By launching a redesign, you declare that you own the site or act for its owner. If that site contains personal data — a staff directory, a customer list, testimonials — it is surveyed along with the rest, and you answer for it. We refuse redesigns of sites manifestly belonging to a third party, and we remove a survey on simple request from the owner of the site concerned, at legal@idem.africa.',
        },
      },
    },
    {
      id: 'published',
      title: { fr: 'Ce que vous publiez', en: 'What you publish' },
      paragraphs: [
        {
          fr: 'Mettre un projet en ligne le fait passer d’iCode à iDeploy. À partir de ce moment, le site est public, et les données qu’il collecte de ses visiteurs sont sous votre responsabilité.',
          en: 'Putting a project online moves it from iCode to iDeploy. From that moment, the site is public, and the data it collects from its visitors is your responsibility.',
        },
        {
          fr: 'Deux choses à faire avant de publier, que personne ne fera pour vous : vérifier le contenu généré (un texte faux, un chiffre inventé, une image qui ne vous appartient pas), et publier votre propre politique de confidentialité si votre site collecte quoi que ce soit — un formulaire de contact suffit à l’exiger.',
          en: 'Two things to do before publishing, that nobody will do for you: check the generated content (a false statement, an invented figure, an image that is not yours), and publish your own privacy policy if your site collects anything — a contact form is enough to require one.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Ce qui s’applique à votre site une fois en ligne.',
            en: 'What applies to your site once it is online.',
          },
          link: {
            label: { fr: 'Confidentialité iDeploy', en: 'iDeploy privacy' },
            href: '/privacy/ideploy',
          },
        },
      ],
    },
    {
      id: 'models',
      title: { fr: 'Ce qui est envoyé aux modèles', en: 'What is sent to the models' },
      paragraphs: [
        {
          fr: 'La demande en cours, les fichiers nécessaires à cette demande, et la carte du projet qui permet au modèle de savoir où intervenir sans relire tout le code. Jamais votre jeton GitHub, jamais vos variables d’environnement, jamais vos secrets.',
          en: 'The request at hand, the files needed for that request, and the project map that lets the model know where to act without re-reading all the code. Never your GitHub token, never your environment variables, never your secrets.',
        },
        {
          fr: 'Ces envois partent avec l’interdiction de conservation et d’entraînement décrite dans la politique globale. Votre code n’entraîne aucun modèle.',
          en: 'Those sends leave with the retention and training prohibition described in the global policy. Your code trains no model.',
        },
      ],
    },
    {
      id: 'retention',
      title: { fr: 'Durées propres à iCode', en: 'Durations specific to iCode' },
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Fichiers et plan du projet', en: 'Project files and plan' },
            {
              fr: 'Tant que le projet existe ; effacés 30 jours après sa suppression',
              en: 'As long as the project exists; erased 30 days after it is deleted',
            },
          ],
          [
            { fr: 'Conversation de l’atelier', en: 'The workshop conversation' },
            { fr: 'Liée au projet, effacée avec lui', en: 'Tied to the project, erased with it' },
          ],
          [
            { fr: 'Conteneur et aperçu', en: 'Container and preview' },
            {
              fr: 'Détruits à la fin de la session ou avec le projet',
              en: 'Destroyed at the end of the session or with the project',
            },
          ],
          [
            { fr: 'Relevé d’un site à refondre', en: 'Survey of a site to redesign' },
            {
              fr: 'Le temps de la refonte, puis effacé avec le projet',
              en: 'For the duration of the redesign, then erased with the project',
            },
          ],
          [
            { fr: 'Jeton GitHub', en: 'GitHub token' },
            {
              fr: 'Chiffré, supprimé dès que vous retirez le lien',
              en: 'Encrypted, deleted as soon as you remove the link',
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
          fr: 'Question sur ce texte, demande de retrait d’un relevé de site, exercice d’un droit : legal@idem.africa. Problème technique dans l’atelier : support@idem.africa.',
          en: 'A question about this text, a request to remove a site survey, exercising a right: legal@idem.africa. A technical problem in the workshop: support@idem.africa.',
        },
      ],
    },
  ],
};
