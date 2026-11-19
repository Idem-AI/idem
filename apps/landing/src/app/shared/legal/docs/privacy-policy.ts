/**
 * La politique de confidentialité d’IDEM.
 *
 * Elle décrit ce que le code fait réellement. Les règles vivent dans
 * `apps/api/api/config/data-governance.ts` et sont vérifiées par
 * `npm run check:privacy` ; `docs/PRIVACY.md` explique l’implémentation. Ce
 * texte-ci est leur version publique : s’il promet quelque chose, le code doit
 * le tenir — et la purge, la garde avant modèle, le chiffrement et le journal
 * d’audit existent précisément pour que ce soit le cas.
 *
 * Toute modification ici doit être relue en regard de ces trois fichiers.
 */

import { countryTable } from '../countries';
import { processorTable } from '../processors';
import type { LegalDocContent } from '../content.model';

export const GLOBAL_PRIVACY: LegalDocContent = {
  id: 'privacy-policy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
  subtitle: {
    fr: 'Ce que nous faisons de vos données, service par service, et ce que nous ne faisons pas. Rien ici n’est une intention : chaque règle de ce texte est appliquée par le code d’IDEM.',
    en: 'What we do with your data, service by service, and what we do not do. Nothing here is an intention: every rule in this text is enforced by IDEM’s code.',
  },
  sections: [
    {
      id: 'who',
      title: { fr: 'Qui est responsable de vos données', en: 'Who is responsible for your data' },
      paragraphs: [
        {
          fr: 'IDEM S.A.S. est une société par actions simplifiée de droit camerounais, établie à Douala, au Cameroun. C’est elle qui décide pourquoi et comment vos données personnelles sont traitées : en droit, elle est le responsable du traitement.',
          en: 'IDEM S.A.S. is a simplified joint-stock company incorporated in Cameroon, established in Douala, Cameroon. It decides why and how your personal data is processed: in law, it is the data controller.',
        },
        {
          fr: 'L’entreprise est camerounaise et n’a, à ce jour, d’établissement nulle part ailleurs. Nos services sont en revanche vendus et utilisés dans treize pays d’Afrique. Le droit camerounais s’applique donc à notre traitement, et le droit de votre pays s’y ajoute : la section 16 nomme, pays par pays, la loi et l’autorité qui vous protègent.',
          en: 'The company is Cameroonian and today has no establishment anywhere else. Our services, however, are sold and used in thirteen African countries. Cameroonian law therefore applies to our processing, and your own country’s law applies on top of it: section 16 names, country by country, the law and the authority that protect you.',
        },
        {
          fr: 'Pour toute question sur ce texte, pour exercer un droit ou pour signaler un problème : legal@idem.africa. Nous n’avons pas encore désigné de délégué à la protection des données ; les demandes sont traitées par la direction, qui en répond.',
          en: 'For any question about this text, to exercise a right or to report a problem: legal@idem.africa. We have not yet appointed a data protection officer; requests are handled by management, which answers for them.',
        },
      ],
    },
    {
      id: 'scope',
      title: { fr: 'Ce que ce texte couvre', en: 'What this text covers' },
      paragraphs: [
        {
          fr: 'Cette politique couvre tout IDEM : le site idem.africa, le tableau de bord, et chacun des services que la plateforme réunit.',
          en: 'This policy covers all of IDEM: the idem.africa site, the dashboard, and each of the services the platform brings together.',
        },
        {
          fr: 'Certains services traitent des données que les autres ne voient jamais — un nom de domaine exige des coordonnées publiques, un hébergement produit des journaux de serveur, un atelier de code lit un dépôt GitHub. Chacun a donc son complément, qui ne remplace pas ce texte mais le précise. Quand les deux se contredisent, le complément l’emporte pour le service concerné.',
          en: 'Some services process data the others never see — a domain name requires public contact details, hosting produces server logs, a code workshop reads a GitHub repository. Each therefore has its own addendum, which does not replace this text but adds to it. Where the two conflict, the addendum prevails for the service concerned.',
        },
      ],
      list: [
        {
          strong: { fr: 'IDEM', en: 'IDEM' },
          text: {
            fr: 'Le tableau de bord : projets, idées, business plans, charte de marque, documents juridiques, conseiller, communication.',
            en: 'The dashboard: projects, ideas, business plans, brand charter, legal documents, advisor, communication.',
          },
        },
        {
          strong: { fr: 'iCode', en: 'iCode' },
          text: {
            fr: 'L’atelier qui écrit le site ou l’application de votre projet, l’exécute dans un aperçu et le met en ligne.',
            en: 'The workshop that writes your project’s website or app, runs it in a preview and puts it online.',
          },
          link: { label: { fr: 'Complément iCode', en: 'iCode addendum' }, href: '/privacy/icode' },
        },
        {
          strong: { fr: 'iDeploy', en: 'iDeploy' },
          text: {
            fr: 'L’hébergement de vos applications, bases de données et serveurs, sur une infrastructure que nous opérons.',
            en: 'Hosting for your applications, databases and servers, on infrastructure we operate.',
          },
          link: {
            label: { fr: 'Complément iDeploy', en: 'iDeploy addendum' },
            href: '/privacy/ideploy',
          },
        },
        {
          strong: { fr: 'iVision', en: 'iVision' },
          text: {
            fr: 'La fabrication de vidéos, de visuels et de sites à partir d’une demande écrite ou dictée.',
            en: 'Making videos, visuals and sites from a written or dictated request.',
          },
          link: {
            label: { fr: 'Complément iVision', en: 'iVision addendum' },
            href: '/privacy/ivision',
          },
        },
        {
          strong: { fr: 'iDomain', en: 'iDomain' },
          text: {
            fr: 'L’achat et le renouvellement de noms de domaine, payables en mobile money.',
            en: 'Buying and renewing domain names, payable by mobile money.',
          },
          link: {
            label: { fr: 'Complément iDomain', en: 'iDomain addendum' },
            href: '/privacy/idomain',
          },
        },
        {
          strong: { fr: 'iSimulator', en: 'iSimulator' },
          text: {
            fr: 'L’épreuve d’un business plan contre un marché simulé, avant que le vrai marché s’en charge.',
            en: 'Stress-testing a business plan against a simulated market, before the real one does it.',
          },
          link: {
            label: { fr: 'Complément du simulateur', en: 'Simulator addendum' },
            href: '/privacy/simulator',
          },
        },
      ],
    },
    {
      id: 'data',
      title: { fr: 'Les données que nous traitons', en: 'The data we process' },
      paragraphs: [
        {
          fr: 'Nous distinguons trois origines : ce que vous nous donnez, ce que l’usage produit, et ce que des services tiers nous transmettent parce que vous les avez reliés.',
          en: 'We distinguish three origins: what you give us, what usage produces, and what third-party services send us because you connected them.',
        },
      ],
      subsections: [
        {
          id: 'data-provided',
          title: { fr: 'Ce que vous nous donnez', en: 'What you give us' },
          paragraphs: [
            {
              fr: 'Vous saisissez ces données vous-même, et vous pouvez les corriger à tout moment depuis votre compte.',
              en: 'You enter this data yourself, and you can correct it at any time from your account.',
            },
          ],
          list: [
            {
              strong: { fr: 'Votre compte', en: 'Your account' },
              text: {
                fr: 'Adresse e-mail, mot de passe (que nous ne stockons jamais en clair), nom affiché, langue, pays.',
                en: 'E-mail address, password (which we never store in clear), display name, language, country.',
              },
            },
            {
              strong: { fr: 'Vos projets', en: 'Your projects' },
              text: {
                fr: 'Le nom de l’entreprise, l’idée, la description, le secteur, la cible, les chiffres financiers, les textes, les images déposées, les choix de marque.',
                en: 'The business name, the idea, the description, the sector, the audience, the financial figures, the texts, the images uploaded, the brand choices.',
              },
            },
            {
              strong: { fr: 'Vos échanges avec nos agents', en: 'Your exchanges with our agents' },
              text: {
                fr: 'Les demandes que vous écrivez, les corrections que vous dictez, la voix que vous enregistrez quand vous la préférez au clavier.',
                en: 'The requests you write, the corrections you dictate, the voice you record when you prefer it to the keyboard.',
              },
            },
            {
              strong: { fr: 'Vos paiements', en: 'Your payments' },
              text: {
                fr: 'Le numéro mobile money que vous saisissez et le pays de l’opérateur. Nous ne voyons ni ne conservons de code PIN, et aucune carte bancaire ne transite par IDEM.',
                en: 'The mobile money number you enter and the operator’s country. We neither see nor keep any PIN, and no bank card passes through IDEM.',
              },
            },
            {
              strong: { fr: 'Vos demandes de support', en: 'Your support requests' },
              text: {
                fr: 'Ce que vous nous écrivez, et ce qu’il faut pour vous répondre.',
                en: 'What you write to us, and what it takes to answer you.',
              },
            },
          ],
        },
        {
          id: 'data-observed',
          title: { fr: 'Ce que l’usage produit', en: 'What usage produces' },
          paragraphs: [
            {
              fr: 'Ces données naissent du fonctionnement du service. Nous les réduisons au nécessaire : nos journaux techniques gardent la forme de ce qui s’est passé, jamais le contenu de vos projets — un filtre central expurge les descriptions, les analyses, les résultats et les chiffres avant écriture.',
              en: 'This data arises from the service running. We keep it to what is necessary: our technical logs keep the shape of what happened, never the content of your projects — a central filter redacts descriptions, analyses, results and figures before writing.',
            },
          ],
          list: [
            {
              strong: { fr: 'Votre appareil et votre session', en: 'Your device and your session' },
              text: {
                fr: 'Type d’appareil, navigateur, système, adresse IP, et l’empreinte qui lie une session à l’appareil qui l’a ouverte — c’est elle qui nous permet de vous avertir quand quelqu’un d’autre se connecte.',
                en: 'Device type, browser, operating system, IP address, and the fingerprint that ties a session to the device that opened it — this is what lets us warn you when someone else signs in.',
              },
            },
            {
              strong: { fr: 'Votre usage de l’IA', en: 'Your AI usage' },
              text: {
                fr: 'Pour chaque génération : la fonction appelée, le modèle, le nombre de jetons, le coût, la durée et le résultat. Des métadonnées, jamais votre demande ni la réponse du modèle.',
                en: 'For each generation: the feature called, the model, the token count, the cost, the duration and the outcome. Metadata, never your request nor the model’s answer.',
              },
            },
            {
              strong: { fr: 'Les journaux techniques', en: 'Technical logs' },
              text: {
                fr: 'Erreurs, latences, identifiants de requête. Les secrets sont retirés, les adresses e-mail réduites à leur domaine, les numéros à leurs deux derniers chiffres.',
                en: 'Errors, latencies, request identifiers. Secrets are removed, e-mail addresses reduced to their domain, phone numbers to their last two digits.',
              },
            },
            {
              strong: { fr: 'La mesure d’audience', en: 'Audience measurement' },
              text: {
                fr: 'Sur le site public idem.africa uniquement. Ni le tableau de bord, ni iCode, ni iVision, ni iDeploy, ni iDomain ne portent de traceur de mesure.',
                en: 'On the public idem.africa site only. Neither the dashboard, nor iCode, iVision, iDeploy or iDomain carries a measurement tracker.',
              },
              link: {
                label: { fr: 'Cookies et traceurs', en: 'Cookies and trackers' },
                href: '/cookie-policy',
              },
            },
          ],
        },
        {
          id: 'data-third-party',
          title: { fr: 'Ce que des tiers nous transmettent', en: 'What third parties send us' },
          paragraphs: [
            {
              fr: 'Uniquement parce que vous avez relié le service en question, et seulement tant que le lien existe. Retirer le lien retire l’accès.',
              en: 'Only because you connected that service, and only while the link exists. Removing the link removes the access.',
            },
          ],
          list: [
            {
              strong: { fr: 'GitHub', en: 'GitHub' },
              text: {
                fr: 'Votre identifiant et un jeton d’accès à vos dépôts, que nous stockons chiffré. Nous ne lisons que les dépôts que vous désignez.',
                en: 'Your identifier and an access token to your repositories, which we store encrypted. We read only the repositories you designate.',
              },
            },
            {
              strong: { fr: 'Google', en: 'Google' },
              text: {
                fr: 'Si vous vous connectez avec un compte Google : votre adresse e-mail, votre nom et votre photo de profil.',
                en: 'If you sign in with a Google account: your e-mail address, your name and your profile picture.',
              },
            },
            {
              strong: {
                fr: 'WhatsApp, Facebook, LinkedIn, X',
                en: 'WhatsApp, Facebook, LinkedIn, X',
              },
              text: {
                fr: 'Le numéro ou le compte que vous reliez, pour vous proposer des publications et les publier à votre place quand vous les validez.',
                en: 'The number or account you connect, so we can propose posts and publish them for you once you approve them.',
              },
            },
            {
              strong: { fr: 'pawaPay', en: 'pawaPay' },
              text: {
                fr: 'Le résultat de vos paiements mobile money : accepté, refusé, en attente, avec sa référence.',
                en: 'The outcome of your mobile money payments: accepted, refused, pending, with its reference.',
              },
            },
          ],
        },
        {
          id: 'data-levels',
          title: {
            fr: 'Les quatre niveaux de sensibilité que le code applique',
            en: 'The four sensitivity levels the code enforces',
          },
          paragraphs: [
            {
              fr: 'Chaque donnée porte un niveau, inscrit dans le code. Ce niveau n’est pas décoratif : il décide de ce qui peut sortir vers un modèle d’IA, de ce qui peut figurer dans un journal, et de qui peut le lire.',
              en: 'Every piece of data carries a level, written into the code. That level is not decorative: it decides what may leave for an AI model, what may appear in a log, and who may read it.',
            },
          ],
          table: {
            headers: [
              { fr: 'Niveau', en: 'Level' },
              { fr: 'Ce que c’est', en: 'What it is' },
              { fr: 'Exemples', en: 'Examples' },
            ],
            rows: [
              [
                { fr: 'L0 — public', en: 'L0 — public' },
                { fr: 'Ce que vous avez choisi de publier', en: 'What you chose to publish' },
                {
                  fr: 'Site mis en ligne, publication sociale, vitrine Builders',
                  en: 'Published site, social post, Builders showcase',
                },
              ],
              [
                { fr: 'L1 — interne', en: 'L1 — internal' },
                {
                  fr: 'Nécessaire au fonctionnement, sans révéler votre projet',
                  en: 'Needed to run the service, without revealing your project',
                },
                {
                  fr: 'Préférences, métadonnées d’usage, journaux techniques',
                  en: 'Preferences, usage metadata, technical logs',
                },
              ],
              [
                { fr: 'L2 — confidentiel', en: 'L2 — confidential' },
                { fr: 'Votre travail', en: 'Your work' },
                {
                  fr: 'Idées, business plans, finances, marque, conversations, fichiers déposés',
                  en: 'Ideas, business plans, finances, brand work, conversations, uploaded files',
                },
              ],
              [
                { fr: 'L3 — très sensible', en: 'L3 — highly sensitive' },
                {
                  fr: 'Ne quitte jamais notre infrastructure et n’est jamais envoyé à un modèle',
                  en: 'Never leaves our infrastructure and is never sent to a model',
                },
                {
                  fr: 'Jetons de session, secrets, données de paiement',
                  en: 'Session tokens, secrets, payment data',
                },
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'why',
      title: {
        fr: 'Pourquoi nous les traitons, et sur quelle base',
        en: 'Why we process it, and on what basis',
      },
      paragraphs: [
        {
          fr: 'Un traitement a une finalité déclarée et une base légale. Une donnée recueillie pour fournir le service n’est jamais réutilisée pour une autre finalité : la finalité est passée à chaque appel, et le code refuse l’appel qui n’en déclare pas.',
          en: 'A processing operation has a declared purpose and a legal basis. Data collected to deliver the service is never reused for another purpose: the purpose is passed on every call, and the code refuses a call that declares none.',
        },
      ],
      table: {
        caption: {
          fr: 'Les finalités déclarées dans le code, et la base légale de chacune. Les deux dernières ne sont pas mises en œuvre : elles sont réservées, et ne le seront qu’avec votre consentement explicite.',
          en: 'The purposes declared in the code, and the legal basis of each. The last two are not implemented: they are reserved, and will only be used with your explicit consent.',
        },
        headers: [
          { fr: 'Finalité', en: 'Purpose' },
          { fr: 'Ce que nous en faisons', en: 'What we do with it' },
          { fr: 'Base légale', en: 'Legal basis' },
        ],
        rows: [
          [
            { fr: 'Fournir le service', en: 'Deliver the service' },
            {
              fr: 'Créer un projet, générer un document, écrire un site, héberger une application, acheter un domaine',
              en: 'Create a project, generate a document, write a site, host an application, buy a domain',
            },
            { fr: 'Exécution du contrat', en: 'Performance of the contract' },
          ],
          [
            { fr: 'Sécuriser les comptes', en: 'Keep accounts secure' },
            {
              fr: 'Détecter une connexion inhabituelle, vous en avertir, bloquer un abus',
              en: 'Detect an unusual sign-in, warn you about it, block abuse',
            },
            { fr: 'Intérêt légitime', en: 'Legitimate interest' },
          ],
          [
            { fr: 'Facturer', en: 'Billing' },
            {
              fr: 'Débiter le portefeuille, encaisser un paiement, émettre une facture',
              en: 'Debit the wallet, collect a payment, issue an invoice',
            },
            { fr: 'Exécution du contrat', en: 'Performance of the contract' },
          ],
          [
            { fr: 'Respecter la loi', en: 'Comply with the law' },
            {
              fr: 'Conserver les pièces comptables, répondre à une demande d’autorité',
              en: 'Keep accounting records, answer a lawful request from an authority',
            },
            { fr: 'Obligation légale', en: 'Legal obligation' },
          ],
          [
            { fr: 'Mesurer et améliorer', en: 'Measure and improve' },
            {
              fr: 'Compter les générations, leur coût et leurs échecs, pour corriger ce qui casse',
              en: 'Count generations, their cost and their failures, to fix what breaks',
            },
            {
              fr: 'Intérêt légitime, sur des métadonnées seulement',
              en: 'Legitimate interest, on metadata only',
            },
          ],
          [
            { fr: 'Recherche en IA', en: 'AI research' },
            {
              fr: 'Non mis en œuvre. Aucun contenu de projet n’entraîne aucun modèle',
              en: 'Not implemented. No project content trains any model',
            },
            { fr: 'Consentement — réservé', en: 'Consent — reserved' },
          ],
          [
            { fr: 'Marketing', en: 'Marketing' },
            {
              fr: 'Non mis en œuvre. Nous n’envoyons que des e-mails de service',
              en: 'Not implemented. We send service e-mails only',
            },
            { fr: 'Consentement — réservé', en: 'Consent — reserved' },
          ],
        ],
      },
    },
    {
      id: 'never',
      title: { fr: 'Ce que nous ne faisons pas', en: 'What we do not do' },
      paragraphs: [
        {
          fr: 'Cette section est la plus courte, et c’est la plus importante. Chaque ligne est une interdiction tenue par le code, pas une promesse commerciale.',
          en: 'This section is the shortest, and it is the most important. Each line is a prohibition held by the code, not a marketing promise.',
        },
      ],
      warning: {
        type: 'info',
        icon: '🔒',
        title: {
          fr: 'Votre projet n’entraîne aucun modèle',
          en: 'Your project trains no model',
        },
        content: {
          fr: 'Aucun contenu de projet — idée, business plan, chiffres, texte, image, voix — n’est utilisé pour entraîner, affiner ou évaluer un modèle d’intelligence artificielle, ni par nous, ni par nos fournisseurs. Chaque requête part avec une politique de non-conservation que le code pose en dernier et qu’aucun appel ne peut relâcher. Aucune variable d’environnement ne permet de la désactiver.',
          en: 'No project content — idea, business plan, figures, text, image, voice — is used to train, fine-tune or evaluate an artificial intelligence model, neither by us nor by our providers. Every request leaves with a no-retention policy that the code sets last and that no caller can relax. No environment variable can switch it off.',
        },
      },
      list: [
        {
          strong: { fr: 'Nous ne vendons rien', en: 'We sell nothing' },
          text: {
            fr: 'Vos données ne sont ni vendues, ni louées, ni échangées, ni cédées à un courtier en données. Nous n’avons pas de régie publicitaire.',
            en: 'Your data is not sold, rented, traded or passed to a data broker. We have no advertising business.',
          },
        },
        {
          strong: {
            fr: 'Nous ne lisons pas vos projets pour le plaisir',
            en: 'We do not browse your projects',
          },
          text: {
            fr: 'Un membre de l’équipe ne peut ouvrir un projet que depuis le panneau d’administration, et chacune de ces lectures est enregistrée — qui, quand, quel projet, pourquoi.',
            en: 'A team member can only open a project from the admin panel, and every such read is recorded — who, when, which project, why.',
          },
        },
        {
          strong: {
            fr: 'Aucune donnée très sensible ne part vers un modèle',
            en: 'No highly sensitive data goes to a model',
          },
          text: {
            fr: 'Jetons, secrets, données de paiement : le garde refuse l’envoi, et un contrôle automatique échoue si un appel oublie de passer par lui.',
            en: 'Tokens, secrets, payment data: the guard refuses the send, and an automated check fails if a call forgets to go through it.',
          },
        },
        {
          strong: {
            fr: 'Aucune décision automatisée ne vous engage',
            en: 'No automated decision binds you',
          },
          text: {
            fr: 'Un indice de viabilité, un plan généré ou une recommandation n’ont pas d’effet juridique : rien n’est refusé, suspendu ni facturé par une décision prise sans intervention humaine, en dehors des contrôles anti-fraude et de quota, qui sont contestables auprès du support.',
            en: 'A viability index, a generated plan or a recommendation have no legal effect: nothing is refused, suspended or charged by a decision taken without human involvement, apart from anti-fraud and quota checks, which can be contested with support.',
          },
        },
        {
          strong: {
            fr: 'Aucun contenu de projet dans nos journaux',
            en: 'No project content in our logs',
          },
          text: {
            fr: 'Les descriptions, analyses, documents métier et résultats d’outils sont remplacés par leur forme avant écriture. Le même filtre s’applique aux trois back-ends.',
            en: 'Descriptions, analyses, business documents and tool results are replaced by their shape before writing. The same filter applies in all three back ends.',
          },
        },
      ],
    },
    {
      id: 'ai',
      title: {
        fr: 'L’intelligence artificielle, en détail',
        en: 'Artificial intelligence, in detail',
      },
      paragraphs: [
        {
          fr: 'IDEM est une plateforme d’IA : l’essentiel de ce que vous obtenez est produit par des modèles. Vous avez donc le droit de savoir exactement ce qui leur est envoyé, par où cela passe, et ce qu’il en reste.',
          en: 'IDEM is an AI platform: most of what you get is produced by models. You are therefore entitled to know exactly what is sent to them, where it goes, and what remains of it.',
        },
      ],
      subsections: [
        {
          id: 'ai-what',
          title: { fr: 'Ce qui est envoyé', en: 'What is sent' },
          paragraphs: [
            {
              fr: 'La demande nécessaire à la génération en cours, et rien de plus : votre description de projet pour un business plan, vos textes pour un site, votre consigne et vos images pour un visuel, votre enregistrement pour une voix off.',
              en: 'The request needed for the generation at hand, and nothing more: your project description for a business plan, your texts for a site, your instruction and your images for a visual, your recording for a voice-over.',
            },
            {
              fr: 'Ne partent jamais : votre mot de passe, vos jetons de session, vos secrets de déploiement, votre numéro de paiement. Le garde les refuse par niveau, pas par bonne volonté.',
              en: 'Never sent: your password, your session tokens, your deployment secrets, your payment number. The guard refuses them by level, not by good intentions.',
            },
          ],
        },
        {
          id: 'ai-where',
          title: { fr: 'Par où cela passe', en: 'Where it goes' },
          paragraphs: [
            {
              fr: 'Tous nos appels de modèles passent par OpenRouter, qui les route vers l’hébergeur du modèle choisi, ou par nos propres serveurs d’inférence. Nous n’utilisons que des modèles à poids ouverts figurant sur une liste blanche, à une exception près pour la génération vidéo.',
              en: 'All our model calls go through OpenRouter, which routes them to the chosen model’s host, or through our own inference servers. We use only open-weight models from an allow-list, with one exception for video generation.',
            },
            {
              fr: 'Ces hébergeurs sont, pour la plupart, situés hors d’Afrique, et notamment aux États-Unis. C’est un transfert international : la section 8 dit ce qui l’encadre.',
              en: 'Those hosts are mostly located outside Africa, in particular in the United States. That is an international transfer: section 8 says what frames it.',
            },
          ],
        },
        {
          id: 'ai-left',
          title: { fr: 'Ce qu’il en reste', en: 'What remains of it' },
          paragraphs: [
            {
              fr: 'Chez nous : la génération et son résultat, attachés à votre projet, que vous pouvez supprimer. Et une ligne de métadonnées — fonction, modèle, jetons, coût, durée — qui sert à vous facturer et à surveiller nos pannes.',
              en: 'With us: the generation and its result, attached to your project, which you can delete. And one line of metadata — feature, model, tokens, cost, duration — used to bill you and to watch our failures.',
            },
            {
              fr: 'Chez le fournisseur : la politique de non-conservation interdit l’usage de la requête pour l’entraînement et demande qu’elle ne soit pas conservée. Nous ne pouvons pas auditer les machines d’un tiers ; nous pouvons restreindre le routage aux seuls hébergeurs qui s’engagent à ne rien conserver, et c’est une option que nous activons service par service à mesure que les modèles éligibles le permettent.',
              en: 'With the provider: the no-retention policy forbids using the request for training and asks that it not be kept. We cannot audit a third party’s machines; we can restrict routing to hosts that commit to keeping nothing, an option we switch on service by service as eligible models allow.',
            },
          ],
        },
        {
          id: 'ai-quality',
          title: {
            fr: 'Ce que l’IA produit peut être faux',
            en: 'What the AI produces can be wrong',
          },
          paragraphs: [
            {
              fr: 'Un texte, un chiffre, un plan ou un code produits par un modèle peuvent être inexacts, incomplets ou inadaptés à votre situation. Vous restez responsable de ce que vous publiez, déposez ou signez. Les documents juridiques générés ne sont pas un conseil juridique, et les projections financières ne sont pas une garantie de résultat.',
              en: 'A text, a figure, a plan or code produced by a model can be inaccurate, incomplete or unsuited to your situation. You remain responsible for what you publish, file or sign. Generated legal documents are not legal advice, and financial projections are not a guarantee of results.',
            },
          ],
        },
      ],
    },
    {
      id: 'recipients',
      title: { fr: 'Qui reçoit vos données', en: 'Who receives your data' },
      paragraphs: [
        {
          fr: 'Nous ne confions vos données qu’à des prestataires nécessaires au fonctionnement du service, et à eux seuls. La liste complète est publiée, et le code refuse tout envoi à un destinataire qui n’y figure pas.',
          en: 'We entrust your data only to providers necessary to run the service, and to them alone. The full list is published, and the code refuses any send to a recipient that is not on it.',
        },
        {
          fr: 'Nous pouvons aussi divulguer des données lorsque la loi nous y oblige — réquisition judiciaire, demande d’une autorité compétente — ou pour défendre nos droits. Nous nous limitons alors à ce qui est demandé, et nous vous en informons sauf interdiction légale. Enfin, en cas de fusion ou de cession, vos données suivraient l’activité, et vous en seriez informé avant.',
          en: 'We may also disclose data where the law requires it — a court order, a request from a competent authority — or to defend our rights. We then limit ourselves to what is asked, and we inform you unless legally forbidden. Finally, in a merger or sale, your data would follow the business, and you would be informed beforehand.',
        },
      ],
      table: processorTable(),
    },
    {
      id: 'transfers',
      title: {
        fr: 'Les transferts hors de votre pays',
        en: 'Transfers outside your country',
      },
      paragraphs: [
        {
          fr: 'Nos serveurs sont en Europe et au Cameroun. Si vous utilisez IDEM depuis l’un des douze autres pays servis, vos données quittent donc votre pays dès que vous créez un compte. Et dès qu’une génération part vers un modèle, la requête quitte le continent.',
          en: 'Our servers are in Europe and in Cameroon. If you use IDEM from one of the twelve other countries served, your data therefore leaves your country as soon as you create an account. And as soon as a generation leaves for a model, the request leaves the continent.',
        },
        {
          fr: 'Ce que nous faisons pour l’encadrer : nous ne transmettons que ce qui est nécessaire ; chaque destinataire est inscrit à un registre avec le niveau de données qu’il peut recevoir ; les requêtes partent avec une interdiction de conservation et d’entraînement ; les communications sont chiffrées de bout en bout en transit.',
          en: 'What we do to frame it: we transmit only what is necessary; every recipient is registered with the data level it may receive; requests leave with a prohibition on retention and training; communications are encrypted in transit end to end.',
        },
        {
          fr: 'Ce que nous ne pouvons pas encore affirmer : plusieurs des pays servis exigent, pour un transfert, soit une décision d’adéquation, soit votre consentement explicite, soit un stockage local. Nous travaillons à mettre ces formalités en règle pays par pays, et nous le disons ici plutôt que de le passer sous silence. Si cette incertitude vous est inacceptable, n’utilisez pas le service et écrivez-nous : nous supprimerons votre compte.',
          en: 'What we cannot yet assert: several of the countries served require, for a transfer, either an adequacy decision, or your explicit consent, or local storage. We are working country by country to put those formalities in order, and we say so here rather than keeping quiet about it. If that uncertainty is unacceptable to you, do not use the service and write to us: we will delete your account.',
        },
      ],
      warning: {
        type: 'warning',
        icon: '🌍',
        title: {
          fr: 'En créant un compte, vous consentez à ce transfert',
          en: 'By creating an account, you consent to this transfer',
        },
        content: {
          fr: 'Fournir IDEM suppose de traiter vos données hors de votre pays : il n’existe aujourd’hui aucune version du service qui garde tout sur place. En créant un compte, vous acceptez ce transfert en connaissance de cause, pour les finalités de la section 4 et vers les destinataires de la section 7. Vous pouvez retirer ce consentement à tout moment en supprimant votre compte ; nous ne pourrons alors plus vous fournir le service.',
          en: 'Delivering IDEM means processing your data outside your country: there is today no version of the service that keeps everything local. By creating an account, you knowingly accept that transfer, for the purposes in section 4 and to the recipients in section 7. You can withdraw that consent at any time by deleting your account; we will then no longer be able to deliver the service to you.',
        },
      },
    },
    {
      id: 'retention',
      title: { fr: 'Combien de temps nous les gardons', en: 'How long we keep it' },
      paragraphs: [
        {
          fr: 'Ces durées ne sont pas des intentions : un service parcourt chaque heure ce qui est arrivé à échéance et l’efface réellement, puis recompte pour vérifier qu’il ne reste rien. Chaque passage écrit un rapport.',
          en: 'These durations are not intentions: a service sweeps every hour for what has come due and actually erases it, then counts again to check nothing remains. Each run writes a report.',
        },
      ],
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Votre compte et votre profil', en: 'Your account and profile' },
            {
              fr: 'Effacés 180 jours après votre demande de suppression. Vous reconnecter pendant ce délai annule la demande',
              en: 'Erased 180 days after your deletion request. Signing in again during that period cancels the request',
            },
          ],
          [
            { fr: 'Un projet supprimé', en: 'A deleted project' },
            {
              fr: 'Archivé, puis effacé 30 jours plus tard avec ses révisions, ses conversations, ses générations et ses fichiers',
              en: 'Archived, then erased 30 days later with its revisions, conversations, generations and files',
            },
          ],
          [
            { fr: 'Métadonnées d’usage de l’IA', en: 'AI usage metadata' },
            {
              fr: 'Conservées, mais détachées de votre compte et du projet dès leur effacement',
              en: 'Kept, but detached from your account and the project as soon as they are erased',
            },
          ],
          [
            { fr: 'Paiements, factures, grand livre', en: 'Payments, invoices, ledger' },
            {
              fr: '10 ans, au titre des obligations comptables. Conservés après la suppression du compte, mais sans votre e-mail ni votre téléphone',
              en: '10 years, under accounting obligations. Kept after the account is deleted, but without your e-mail or phone',
            },
          ],
          [
            { fr: 'Preuves d’acceptation des conditions', en: 'Proof that you accepted the terms' },
            { fr: 'Durée du compte, puis 5 ans', en: 'Account lifetime, then 5 years' },
          ],
          [
            { fr: 'Journaux techniques', en: 'Technical logs' },
            {
              fr: 'Rotation par taille, et selon la configuration de notre collecteur',
              en: 'Size-based rotation, and per our collector’s configuration',
            },
          ],
          [
            { fr: 'Sauvegardes', en: 'Backups' },
            {
              fr: '14 jours : un compte effacé disparaît donc des sauvegardes sous 14 jours',
              en: '14 days: an erased account therefore leaves the backups within 14 days',
            },
          ],
          [
            { fr: 'Journal d’audit des accès internes', en: 'Internal access audit log' },
            { fr: '1 an', en: '1 year' },
          ],
        ],
      },
    },
    {
      id: 'security',
      title: { fr: 'Comment nous les protégeons', en: 'How we protect it' },
      paragraphs: [
        {
          fr: 'La sécurité n’est pas une déclaration. Voici ce qui est en place, et ce qui ne l’est pas encore.',
          en: 'Security is not a statement. Here is what is in place, and what is not yet.',
        },
      ],
      list: [
        {
          strong: { fr: 'En transit', en: 'In transit' },
          text: {
            fr: 'HTTPS partout, avec HSTS. Rien ne circule en clair entre votre navigateur, nos services et nos sous-traitants.',
            en: 'HTTPS everywhere, with HSTS. Nothing travels in clear between your browser, our services and our sub-processors.',
          },
        },
        {
          strong: { fr: 'Vos secrets', en: 'Your secrets' },
          text: {
            fr: 'Jetons GitHub et réseaux sociaux, numéros de paiement, variables de déploiement : chiffrés en base avec une clé par usage, de sorte que la valeur d’un compte ne puisse pas être déchiffrée comme celle d’un autre.',
            en: 'GitHub and social tokens, payment numbers, deployment variables: encrypted in the database with a per-use key, so that one account’s value cannot be decrypted as another’s.',
          },
        },
        {
          strong: { fr: 'Vos mots de passe', en: 'Your passwords' },
          text: {
            fr: 'Jamais stockés. Seule une empreinte irréversible l’est. Les jetons de session sont eux aussi hachés.',
            en: 'Never stored. Only an irreversible hash is. Session refresh tokens are hashed too.',
          },
        },
        {
          strong: { fr: 'Vos sessions', en: 'Your sessions' },
          text: {
            fr: 'Liées à l’appareil qui les a ouvertes. Une session reprise ailleurs est refusée et vous recevez un e-mail « c’est moi / ce n’est pas moi ».',
            en: 'Bound to the device that opened them. A session resumed elsewhere is refused and you receive a “it was me / it wasn’t me” e-mail.',
          },
        },
        {
          strong: { fr: 'Nos sauvegardes', en: 'Our backups' },
          text: {
            fr: 'Chiffrées avant de quitter le serveur, avec une clé privée conservée hors ligne.',
            en: 'Encrypted before leaving the server, with a private key kept offline.',
          },
        },
        {
          strong: { fr: 'L’accès de l’équipe', en: 'Team access' },
          text: {
            fr: 'Chaque lecture et chaque écriture d’un contenu utilisateur depuis le panneau d’administration est enregistrée pendant un an, avec l’administrateur, la cible et le motif.',
            en: 'Every read and every write of user content from the admin panel is recorded for one year, with the administrator, the target and the reason.',
          },
        },
        {
          strong: { fr: 'L’isolement entre comptes', en: 'Isolation between accounts' },
          text: {
            fr: 'Chaque lecture et chaque écriture sont bornées au compte authentifié, au niveau du dépôt de données et non de l’interface.',
            en: 'Every read and every write is scoped to the authenticated account, at the data-access layer rather than in the interface.',
          },
        },
        {
          strong: { fr: 'Ce qui reste à faire', en: 'What is still to do' },
          text: {
            fr: 'L’authentification à deux facteurs des comptes administrateurs, et l’export de vos données en libre-service. Aucun système n’est inviolable : nous ne vous promettons pas une sécurité absolue, nous vous décrivons celle que nous appliquons.',
            en: 'Two-factor authentication for administrator accounts, and self-service export of your data. No system is impregnable: we do not promise you absolute security, we describe the security we apply.',
          },
        },
      ],
    },
    {
      id: 'rights',
      title: {
        fr: 'Vos droits, et comment les exercer',
        en: 'Your rights, and how to exercise them',
      },
      paragraphs: [
        {
          fr: 'Quel que soit votre pays, nous vous reconnaissons les droits suivants. Lorsque votre loi nationale en accorde davantage, c’est elle qui s’applique — jamais ce texte à son détriment.',
          en: 'Whatever your country, we grant you the following rights. Where your national law grants more, that law applies — never this text to its detriment.',
        },
      ],
      list: [
        {
          strong: { fr: 'Accès', en: 'Access' },
          text: {
            fr: 'Obtenir une copie des données que nous détenons sur vous. Écrivez à legal@idem.africa : nous répondons sous 30 jours.',
            en: 'Obtain a copy of the data we hold about you. Write to legal@idem.africa: we answer within 30 days.',
          },
        },
        {
          strong: { fr: 'Rectification', en: 'Rectification' },
          text: {
            fr: 'Corriger une donnée inexacte. La plupart le sont directement depuis votre compte.',
            en: 'Correct inaccurate data. Most of it can be corrected directly from your account.',
          },
        },
        {
          strong: { fr: 'Effacement', en: 'Erasure' },
          text: {
            fr: 'Supprimer un projet, ou tout votre compte. La section 12 décrit exactement ce qui est effacé et ce qui survit.',
            en: 'Delete a project, or your whole account. Section 12 describes exactly what is erased and what survives.',
          },
        },
        {
          strong: { fr: 'Portabilité', en: 'Portability' },
          text: {
            fr: 'Recevoir vos données dans un format lisible par machine. Sur demande aujourd’hui, en libre-service demain.',
            en: 'Receive your data in a machine-readable format. On request today, self-service tomorrow.',
          },
        },
        {
          strong: { fr: 'Opposition et limitation', en: 'Objection and restriction' },
          text: {
            fr: 'Vous opposer à un traitement fondé sur notre intérêt légitime, ou en demander le gel le temps d’un litige.',
            en: 'Object to processing based on our legitimate interest, or ask that it be frozen while a dispute is settled.',
          },
        },
        {
          strong: { fr: 'Retrait du consentement', en: 'Withdrawal of consent' },
          text: {
            fr: 'Retirer un consentement donné, sans que cela remette en cause ce qui a été fait avant.',
            en: 'Withdraw a consent you gave, without calling into question what was done before.',
          },
        },
        {
          strong: { fr: 'Réclamation', en: 'Complaint' },
          text: {
            fr: 'Saisir l’autorité de contrôle de votre pays. La section 16 la nomme. Vous n’avez pas à nous écrire d’abord.',
            en: 'Refer the matter to your country’s supervisory authority. Section 16 names it. You do not have to write to us first.',
          },
        },
      ],
    },
    {
      id: 'deletion',
      title: {
        fr: 'Supprimer un projet, supprimer votre compte',
        en: 'Deleting a project, deleting your account',
      },
      paragraphs: [
        {
          fr: 'Supprimer un projet l’archive d’abord : il disparaît de votre tableau de bord, et trente jours plus tard il est effacé pour de bon, avec ses révisions, ses conversations, ses générations et ses fichiers.',
          en: 'Deleting a project archives it first: it disappears from your dashboard, and thirty days later it is erased for good, with its revisions, conversations, generations and files.',
        },
        {
          fr: 'Supprimer votre compte ouvre un délai de grâce de 180 jours, pensé pour l’erreur et le regret. Vous reconnecter pendant ce délai annule la demande, et nous vous le disons. Passé le délai, un service balaie toutes les collections de la base avec vos identifiants, efface vos fichiers, vos clés de cache et votre compte d’authentification, puis recompte pour vérifier qu’il ne reste rien. Si quelque chose résiste, le rapport est marqué incomplet et le passage suivant reprend le travail.',
          en: 'Deleting your account opens a 180-day grace period, designed for mistakes and second thoughts. Signing in again during that period cancels the request, and we tell you so. Once the period is over, a service sweeps every collection of the database with your identifiers, erases your files, your cache keys and your authentication account, then counts again to check nothing remains. If something resists, the report is marked incomplete and the next run resumes the work.',
        },
        {
          fr: 'Ce qui survit, et pourquoi : les pièces comptables, parce que la loi nous impose de les conserver dix ans — nous en retirons alors votre adresse e-mail et votre numéro de téléphone. Et les métadonnées d’usage, détachées de vous et de vos projets : elles ne permettent plus de vous identifier.',
          en: 'What survives, and why: accounting records, because the law requires us to keep them for ten years — we then remove your e-mail address and phone number from them. And usage metadata, detached from you and your projects: it no longer makes you identifiable.',
        },
        {
          fr: 'Ce qui demande une action de notre part : les applications, bases de données et serveurs que vous faites tourner sur iDeploy. Ils sont comptés dans le rapport de purge et arrêtés par l’équipe, parce qu’un arrêt automatique d’un service en production est une opération que nous refusons d’automatiser.',
          en: 'What requires action on our side: the applications, databases and servers you run on iDeploy. They are counted in the purge report and stopped by the team, because automatically shutting down a production service is an operation we refuse to automate.',
        },
      ],
      list: [
        {
          strong: { fr: 'Depuis votre compte', en: 'From your account' },
          text: {
            fr: 'La page de suppression explique chaque étape avant de rien déclencher.',
            en: 'The deletion page explains every step before anything is triggered.',
          },
          link: {
            label: { fr: 'Supprimer mon compte', en: 'Delete my account' },
            href: '/delete-account',
          },
        },
      ],
    },
    {
      id: 'cookies',
      title: { fr: 'Cookies et traceurs', en: 'Cookies and trackers' },
      paragraphs: [
        {
          fr: 'Nous utilisons le strict nécessaire pour vous garder connecté, retenir votre langue et votre thème, et protéger vos sessions. Le site public porte en plus une mesure d’audience.',
          en: 'We use the strict minimum to keep you signed in, remember your language and theme, and protect your sessions. The public site additionally carries audience measurement.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Le détail — chaque cookie, son rôle, sa durée — est publié à part.',
            en: 'The detail — every cookie, its role, its lifetime — is published separately.',
          },
          link: {
            label: { fr: 'Lire la politique cookies', en: 'Read the cookie policy' },
            href: '/cookie-policy',
          },
        },
      ],
    },
    {
      id: 'children',
      title: { fr: 'Les mineurs', en: 'Minors' },
      paragraphs: [
        {
          fr: 'IDEM est un outil professionnel, destiné à des personnes capables de conclure un contrat. Nous ne destinons pas le service aux mineurs de moins de 18 ans et nous ne collectons pas sciemment leurs données.',
          en: 'IDEM is a professional tool, intended for people able to enter into a contract. We do not intend the service for minors under 18 and we do not knowingly collect their data.',
        },
        {
          fr: 'Si vous êtes mineur, vous ne pouvez utiliser IDEM qu’avec l’accord de la personne qui exerce l’autorité parentale, et c’est elle qui est engagée par les conditions. Si nous apprenons qu’un compte appartient à un mineur sans cet accord, nous l’effaçons. Si vous êtes parent et que c’est le cas, écrivez-nous : legal@idem.africa.',
          en: 'If you are a minor, you may use IDEM only with the agreement of the person holding parental authority, and it is that person who is bound by the terms. If we learn that an account belongs to a minor without that agreement, we erase it. If you are a parent and this is the case, write to us: legal@idem.africa.',
        },
      ],
    },
    {
      id: 'third-party',
      title: { fr: 'Les services que vous reliez', en: 'The services you connect' },
      paragraphs: [
        {
          fr: 'Lorsque vous reliez GitHub, WhatsApp, LinkedIn, X ou Facebook, lorsque vous achetez un domaine ou lorsque vous payez en mobile money, le service en question applique sa propre politique à ce qu’il reçoit. Nous ne la contrôlons pas.',
          en: 'When you connect GitHub, WhatsApp, LinkedIn, X or Facebook, when you buy a domain or when you pay by mobile money, that service applies its own policy to what it receives. We do not control it.',
        },
        {
          fr: 'Ce que nous contrôlons : ne lui transmettre que le nécessaire, ne garder son jeton d’accès que chiffré, et couper l’accès dès que vous retirez le lien. Les sites publiés avec IDEM ou hébergés sur iDeploy sont, eux, sous votre responsabilité : si votre site collecte des données, c’est vous qui en êtes responsable, pas nous.',
          en: 'What we do control: sending it only what is necessary, keeping its access token encrypted only, and cutting access as soon as you remove the link. Sites published with IDEM or hosted on iDeploy are your responsibility: if your site collects data, you are the controller of it, not us.',
        },
      ],
    },
    {
      id: 'countries',
      title: {
        fr: 'Les pays servis et l’autorité compétente',
        en: 'The countries served and the competent authority',
      },
      paragraphs: [
        {
          fr: 'IDEM est aujourd’hui disponible dans treize pays, parce que ce sont ceux où nous savons à la fois vous tarifer et encaisser un paiement mobile money. Notre ambition est d’être présents dans toute l’Afrique ; ce tableau sera étendu pays par pays, et il est daté pour qu’on puisse voir quand il a été relevé.',
          en: 'IDEM is today available in thirteen countries, because those are the ones where we can both price you and collect a mobile money payment. Our ambition is to be present across the whole of Africa; this table will be extended country by country, and it is dated so that one can see when it was checked.',
        },
        {
          fr: 'Vous pouvez saisir l’autorité de votre pays directement. Trois des pays servis n’ont pas, à notre dernier relevé, de loi dédiée ou d’autorité installée : vous pouvez alors nous écrire, saisir l’autorité camerounaise, ou vous appuyer sur la Convention de l’Union africaine sur la cybersécurité et la protection des données à caractère personnel, dite Convention de Malabo.',
          en: 'You can refer a matter to your country’s authority directly. Three of the countries served have, at our last check, no dedicated law or no authority in place: you can then write to us, refer the matter to the Cameroonian authority, or rely on the African Union Convention on Cyber Security and Personal Data Protection, known as the Malabo Convention.',
        },
      ],
      table: countryTable(),
    },
    {
      id: 'breach',
      title: { fr: 'En cas de violation de données', en: 'In the event of a data breach' },
      paragraphs: [
        {
          fr: 'Si un incident expose vos données, nous le qualifions, nous le contenons, puis nous informons l’autorité compétente dans les délais que sa loi impose — 72 heures là où ce délai existe.',
          en: 'If an incident exposes your data, we qualify it, we contain it, then we inform the competent authority within the deadlines its law imposes — 72 hours where that deadline exists.',
        },
        {
          fr: 'Nous vous informons directement, par e-mail, lorsque l’incident présente un risque réel pour vous. Nous vous disons ce qui s’est passé, quelles données sont concernées, ce que nous avons fait et ce que vous devriez faire. Nous ne nous contenterons pas d’une note sur une page que personne ne lit.',
          en: 'We inform you directly, by e-mail, when the incident presents a real risk to you. We tell you what happened, which data is affected, what we have done and what you should do. We will not settle for a note on a page nobody reads.',
        },
      ],
    },
    {
      id: 'changes',
      title: { fr: 'Les modifications de ce texte', en: 'Changes to this text' },
      paragraphs: [
        {
          fr: 'Ce texte porte une date d’effet et un numéro de version, en haut de la page. Toute modification de fond — une nouvelle finalité, un nouveau sous-traitant, une durée allongée — fait l’objet d’une nouvelle version, et nous vous en informons par e-mail au moins trente jours avant son entrée en vigueur.',
          en: 'This text carries an effective date and a version number, at the top of the page. Any substantive change — a new purpose, a new sub-processor, a longer retention — results in a new version, and we inform you by e-mail at least thirty days before it takes effect.',
        },
        {
          fr: 'Les corrections de forme sont appliquées sans préavis. Si une modification ne vous convient pas, vous pouvez supprimer votre compte avant son entrée en vigueur.',
          en: 'Editorial corrections are applied without notice. If a change does not suit you, you can delete your account before it takes effect.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'IDEM S.A.S., Douala, Cameroun. Pour une question de confidentialité, l’exercice d’un droit ou le signalement d’un incident : legal@idem.africa. Pour tout le reste : contact@idem.africa, et support@idem.africa pour un problème technique.',
          en: 'IDEM S.A.S., Douala, Cameroon. For a privacy question, to exercise a right or to report an incident: legal@idem.africa. For everything else: contact@idem.africa, and support@idem.africa for a technical problem.',
        },
        {
          fr: 'Nous répondons en français ou en anglais, sous trente jours au plus. Si nous avons besoin de vérifier votre identité avant de donner suite, nous vous demandons le minimum nécessaire et nous ne le conservons pas.',
          en: 'We answer in French or English, within thirty days at most. If we need to verify your identity before acting, we ask for the minimum necessary and we do not keep it.',
        },
      ],
    },
  ],
};
