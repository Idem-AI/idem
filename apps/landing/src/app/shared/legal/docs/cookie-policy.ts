/**
 * La politique cookies.
 *
 * Les noms et les rôles sont relevés dans le code : les cookies de session
 * sont posés par l’API (`res.cookie('session')`, `res.cookie('refreshToken')`),
 * la langue et le thème par le cookie partagé entre applications
 * (`idem_lang`, `idem_theme`, `idem_uid`), et la mesure d’audience par
 * `shared/services/analytics.service.ts`, chargée à la demande sur la landing
 * seulement.
 *
 * Décision assumée du 18/11/2026 : la mesure d’audience de la landing n’est
 * pas précédée d’un écran de consentement. Ce texte le dit, et dit comment la
 * refuser — plutôt que de laisser croire à un recueil qui n’existe pas.
 */

import type { LegalDocContent } from '../content.model';

export const COOKIE_POLICY: LegalDocContent = {
  id: 'cookie-policy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Cookies et traceurs', en: 'Cookies and trackers' },
  subtitle: {
    fr: 'La liste complète de ce que nous déposons sur votre appareil, à quoi chaque élément sert, combien de temps il reste, et comment vous en débarrasser.',
    en: 'The full list of what we put on your device, what each item is for, how long it stays, and how to get rid of it.',
  },
  sections: [
    {
      id: 'principle',
      title: { fr: 'Le principe', en: 'The principle' },
      paragraphs: [
        {
          fr: 'Nous déposons le strict nécessaire. IDEM n’a pas de régie publicitaire, pas de pixel de réseau social, pas de traceur de reciblage, et ne partage aucun identifiant avec un courtier en données.',
          en: 'We store the strict minimum. IDEM has no advertising business, no social network pixel, no retargeting tracker, and shares no identifier with a data broker.',
        },
        {
          fr: 'Une distinction importante : le tableau de bord et les ateliers — iCode, iVision, iDeploy, iDomain, le simulateur — ne portent aucune mesure d’audience. Seul le site public idem.africa en porte une.',
          en: 'An important distinction: the dashboard and the workshops — iCode, iVision, iDeploy, iDomain, the simulator — carry no audience measurement. Only the public idem.africa site carries any.',
        },
      ],
    },
    {
      id: 'necessary',
      title: { fr: 'Ce qui est indispensable', en: 'What is indispensable' },
      paragraphs: [
        {
          fr: 'Sans ces éléments, le service ne fonctionne pas : vous ne pouvez pas rester connecté, et nous ne pouvons pas protéger votre session. Ils ne sont pas soumis à votre consentement, parce qu’ils ne servent qu’à exécuter ce que vous demandez.',
          en: 'Without these, the service does not work: you cannot stay signed in, and we cannot protect your session. They are not subject to your consent, because they serve only to do what you ask.',
        },
      ],
      table: {
        headers: [
          { fr: 'Nom', en: 'Name' },
          { fr: 'Rôle', en: 'Role' },
          { fr: 'Durée', en: 'Lifetime' },
        ],
        rows: [
          [
            { fr: 'session', en: 'session' },
            {
              fr: 'Vous garde connecté d’une page à l’autre. Illisible par le JavaScript de la page, et lié à l’appareil qui l’a ouvert',
              en: 'Keeps you signed in from page to page. Unreadable by the page’s JavaScript, and bound to the device that opened it',
            },
            { fr: 'Le temps de la session', en: 'For the session' },
          ],
          [
            { fr: 'refreshToken', en: 'refreshToken' },
            {
              fr: 'Renouvelle la session sans vous redemander votre mot de passe. Stocké chez nous sous forme d’empreinte seulement',
              en: 'Renews the session without asking for your password again. Stored on our side as a hash only',
            },
            { fr: 'Jusqu’à expiration ou déconnexion', en: 'Until expiry or sign-out' },
          ],
          [
            { fr: 'idem_uid', en: 'idem_uid' },
            {
              fr: 'Identifie votre compte entre les applications IDEM, pour que passer du tableau de bord à iCode ne vous déconnecte pas',
              en: 'Identifies your account across IDEM applications, so moving from the dashboard to iCode does not sign you out',
            },
            { fr: 'Le temps de la session', en: 'For the session' },
          ],
        ],
      },
    },
    {
      id: 'preferences',
      title: { fr: 'Ce qui retient vos préférences', en: 'What remembers your preferences' },
      paragraphs: [
        {
          fr: 'Ces éléments vous évitent de redire la même chose à chaque visite. Ils ne nous apprennent rien sur vous, et ils sont partagés entre les applications IDEM pour que votre choix suive.',
          en: 'These save you from repeating yourself on every visit. They tell us nothing about you, and they are shared across IDEM applications so your choice follows you.',
        },
      ],
      table: {
        headers: [
          { fr: 'Nom', en: 'Name' },
          { fr: 'Rôle', en: 'Role' },
          { fr: 'Durée', en: 'Lifetime' },
        ],
        rows: [
          [
            { fr: 'idem_lang', en: 'idem_lang' },
            { fr: 'La langue que vous avez choisie', en: 'The language you chose' },
            { fr: '1 an', en: '1 year' },
          ],
          [
            { fr: 'idem_theme', en: 'idem_theme' },
            {
              fr: 'Le thème clair ou sombre que vous avez choisi',
              en: 'The light or dark theme you chose',
            },
            { fr: '1 an', en: '1 year' },
          ],
          [
            {
              fr: 'Stockage local du navigateur',
              en: 'Browser local storage',
            },
            {
              fr: 'Brouillons non envoyés, onglet ouvert, panneaux replié, avancement d’un guide. Ne quitte jamais votre navigateur',
              en: 'Unsent drafts, open tab, collapsed panels, a tour’s progress. Never leaves your browser',
            },
            {
              fr: 'Jusqu’à ce que vous effaciez les données du site',
              en: 'Until you clear the site’s data',
            },
          ],
        ],
      },
    },
    {
      id: 'analytics',
      title: {
        fr: 'La mesure d’audience du site public',
        en: 'Audience measurement on the public site',
      },
      paragraphs: [
        {
          fr: 'Le site idem.africa charge Google Analytics 4 pour savoir quelles pages sont lues, d’où viennent les visiteurs, et quels écrans échouent. Les scripts ne sont chargés que lorsque vous naviguez effectivement sur le site public.',
          en: 'The idem.africa site loads Google Analytics 4 to know which pages are read, where visitors come from, and which screens fail. The scripts are loaded only when you actually browse the public site.',
        },
        {
          fr: 'Ce que cette mesure voit : les pages vues, la provenance, le type d’appareil, le pays, et une adresse IP tronquée. Ce qu’elle ne voit jamais : le contenu d’un projet, une demande envoyée à un modèle, un fichier, un numéro de paiement. Elle n’est pas chargée dans les applications où ce contenu existe.',
          en: 'What this measurement sees: page views, referrer, device type, country, and a truncated IP address. What it never sees: a project’s content, a request sent to a model, a file, a payment number. It is not loaded in the applications where that content lives.',
        },
      ],
      table: {
        headers: [
          { fr: 'Nom', en: 'Name' },
          { fr: 'Déposé par', en: 'Set by' },
          { fr: 'Rôle', en: 'Role' },
          { fr: 'Durée', en: 'Lifetime' },
        ],
        rows: [
          [
            { fr: '_ga', en: '_ga' },
            { fr: 'Google Analytics 4', en: 'Google Analytics 4' },
            { fr: 'Distingue les visiteurs', en: 'Distinguishes visitors' },
            { fr: '2 ans', en: '2 years' },
          ],
          [
            { fr: '_ga_… ', en: '_ga_… ' },
            { fr: 'Google Analytics 4', en: 'Google Analytics 4' },
            {
              fr: 'Tient l’état de la visite en cours',
              en: 'Keeps the state of the current visit',
            },
            { fr: '2 ans', en: '2 years' },
          ],
        ],
      },
      warning: {
        type: 'info',
        icon: 'ℹ️',
        title: {
          fr: 'Nous ne vous demandons pas votre consentement pour cette mesure',
          en: 'We do not ask for your consent for this measurement',
        },
        content: {
          fr: 'C’est une décision, et nous préférons l’écrire plutôt que de la masquer derrière un bandeau trompeur. Elle ne porte que sur le site public, elle ne concerne aucun contenu de projet, et vous pouvez la refuser en trois façons : activer le refus de suivi de votre navigateur, bloquer les cookies tiers, ou installer l’extension de désactivation de Google Analytics. Si la loi de votre pays exige un consentement préalable pour ce type de mesure, écrivez-nous à legal@idem.africa : nous vous retirons de la mesure et nous traitons votre demande comme une opposition.',
          en: 'That is a decision, and we prefer to write it down rather than hide it behind a misleading banner. It covers the public site only, it concerns no project content, and you can refuse it in three ways: turn on your browser’s do-not-track setting, block third-party cookies, or install Google’s Analytics opt-out add-on. If your country’s law requires prior consent for this kind of measurement, write to us at legal@idem.africa: we remove you from the measurement and treat your request as an objection.',
        },
      },
    },
    {
      id: 'third-party',
      title: {
        fr: 'Ce que les services que vous reliez déposent',
        en: 'What the services you connect set',
      },
      paragraphs: [
        {
          fr: 'Si vous vous connectez avec Google ou GitHub, ces services déposent leurs propres cookies au moment de la connexion, selon leurs politiques. Même chose pour un paiement : la page de l’opérateur mobile money est la sienne, pas la nôtre.',
          en: 'If you sign in with Google or GitHub, those services set their own cookies at sign-in time, under their own policies. The same goes for a payment: the mobile money operator’s page is theirs, not ours.',
        },
        {
          fr: 'Les sites que vous publiez avec iCode ou hébergez sur iDeploy sont les vôtres : s’ils déposent des cookies, c’est à vous de les déclarer et, le cas échéant, d’en recueillir le consentement.',
          en: 'The sites you publish with iCode or host on iDeploy are yours: if they set cookies, it is for you to declare them and, where required, collect consent for them.',
        },
      ],
    },
    {
      id: 'manage',
      title: { fr: 'Comment les refuser ou les effacer', en: 'How to refuse or erase them' },
      paragraphs: [
        {
          fr: 'Tous les navigateurs permettent de bloquer les cookies, de les effacer, ou de les limiter au site visité. Attention : bloquer les cookies indispensables vous empêchera de rester connecté à IDEM.',
          en: 'Every browser lets you block cookies, erase them, or limit them to the site you are visiting. A warning: blocking the indispensable cookies will stop you from staying signed in to IDEM.',
        },
        {
          fr: 'Se déconnecter supprime les cookies de session. Effacer les données du site dans votre navigateur supprime aussi vos préférences et vos brouillons non envoyés.',
          en: 'Signing out removes the session cookies. Clearing the site’s data in your browser also removes your preferences and your unsent drafts.',
        },
      ],
    },
    {
      id: 'changes',
      title: { fr: 'Les modifications de ce texte', en: 'Changes to this text' },
      paragraphs: [
        {
          fr: 'Ce texte porte une date d’effet. Tout nouveau traceur y est inscrit avant d’être déposé. Si nous ajoutons un jour un traceur soumis à consentement, nous construirons l’écran qui le recueille — et ce texte le dira.',
          en: 'This text carries an effective date. Any new tracker is listed here before being set. If we one day add a tracker that requires consent, we will build the screen that collects it — and this text will say so.',
        },
      ],
    },
  ],
};
