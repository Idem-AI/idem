/**
 * Complément de confidentialité propre à iDeploy.
 *
 * iDeploy est le seul service d’IDEM où nous traitons des données qui ne sont
 * pas les vôtres : celles des visiteurs de vos applications. C’est ce
 * renversement de rôle — nous devenons votre sous-traitant — que ce texte doit
 * nommer, parce que la politique globale ne peut pas le faire à votre place.
 */

import type { LegalDocContent } from '../content.model';

export const IDEPLOY_PRIVACY: LegalDocContent = {
  id: 'ideploy-privacy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Confidentialité — iDeploy', en: 'Privacy — iDeploy' },
  subtitle: {
    fr: 'Ce que l’hébergement ajoute à la politique globale : vos secrets de déploiement, vos journaux d’application, et les données des visiteurs de vos sites — dont vous êtes responsable, et nous le sous-traitant.',
    en: 'What hosting adds to the global policy: your deployment secrets, your application logs, and the data of your sites’ visitors — for which you are the controller, and we the processor.',
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
          fr: 'Tout ce que dit la politique de confidentialité d’IDEM s’applique à iDeploy : les finalités, les durées, vos droits, la suppression de votre compte. Ce complément n’ajoute que ce qui est propre à l’hébergement.',
          en: 'Everything the IDEM privacy policy says applies to iDeploy: the purposes, the durations, your rights, the deletion of your account. This addendum adds only what is specific to hosting.',
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
      id: 'roles',
      title: { fr: 'Qui est responsable de quoi', en: 'Who is responsible for what' },
      paragraphs: [
        {
          fr: 'Il faut distinguer deux choses, et cette distinction décide de tout le reste.',
          en: 'Two things must be distinguished, and that distinction decides everything else.',
        },
      ],
      table: {
        headers: [
          { fr: 'Les données', en: 'The data' },
          { fr: 'Vous êtes', en: 'You are' },
          { fr: 'Nous sommes', en: 'We are' },
        ],
        rows: [
          [
            {
              fr: 'Votre compte, vos applications, vos serveurs, votre facturation',
              en: 'Your account, your applications, your servers, your billing',
            },
            { fr: 'La personne concernée', en: 'The data subject' },
            { fr: 'Responsable du traitement', en: 'The controller' },
          ],
          [
            {
              fr: 'Ce que vos applications hébergées collectent de leurs visiteurs et de leurs utilisateurs',
              en: 'What your hosted applications collect from their visitors and users',
            },
            { fr: 'Responsable du traitement', en: 'The controller' },
            {
              fr: 'Sous-traitant, agissant sur vos instructions',
              en: 'The processor, acting on your instructions',
            },
          ],
        ],
      },
      warning: {
        type: 'warning',
        icon: '⚖️',
        title: {
          fr: 'Les données de vos visiteurs sont les vôtres, pas les nôtres',
          en: 'Your visitors’ data is yours, not ours',
        },
        content: {
          fr: 'Si votre application collecte des noms, des adresses, des commandes, des messages ou des paiements, c’est vous qui en répondez devant vos utilisateurs et devant votre autorité de contrôle. C’est à vous de publier votre propre politique de confidentialité, de recueillir les consentements nécessaires et de répondre aux demandes d’accès ou de suppression. Nous nous contentons d’héberger : nous n’ouvrons pas votre base de données, nous ne lisons pas vos enregistrements, et nous n’utilisons rien de ce que votre application stocke.',
          en: 'If your application collects names, addresses, orders, messages or payments, you answer for it to your users and to your supervisory authority. It is for you to publish your own privacy policy, collect the necessary consents and answer access or deletion requests. We merely host: we do not open your database, we do not read your records, and we use nothing of what your application stores.',
        },
      },
    },
    {
      id: 'what-we-hold',
      title: { fr: 'Ce que nous détenons pour vous', en: 'What we hold for you' },
      paragraphs: [
        {
          fr: 'Héberger une application suppose de détenir ce qui la fait tourner. Voici la liste, et le traitement de chaque élément.',
          en: 'Hosting an application means holding what makes it run. Here is the list, and how each item is handled.',
        },
      ],
      list: [
        {
          strong: { fr: 'Votre code et vos images', en: 'Your code and your images' },
          text: {
            fr: 'Le dépôt que vous reliez, ou l’archive que vous envoyez, et les images construites à partir de là. Stockés sur notre infrastructure, lisibles par vous seul et par nos processus de construction.',
            en: 'The repository you connect, or the archive you upload, and the images built from it. Stored on our infrastructure, readable by you alone and by our build processes.',
          },
        },
        {
          strong: { fr: 'Vos variables d’environnement', en: 'Your environment variables' },
          text: {
            fr: 'Clés d’API, mots de passe de base de données, jetons. Chiffrées en base. Nous ne les affichons qu’à vous, et elles sont injectées dans votre conteneur à l’exécution.',
            en: 'API keys, database passwords, tokens. Encrypted in the database. We display them to you only, and they are injected into your container at run time.',
          },
        },
        {
          strong: { fr: 'Vos clés et vos accès de serveur', en: 'Your keys and server access' },
          text: {
            fr: 'Les clés SSH nécessaires pour piloter vos serveurs, les identifiants de registre d’images, les jetons d’accès personnels que vous créez. Chiffrés, et révocables par vous à tout moment.',
            en: 'The SSH keys needed to drive your servers, image registry credentials, the personal access tokens you create. Encrypted, and revocable by you at any time.',
          },
        },
        {
          strong: { fr: 'Vos bases de données', en: 'Your databases' },
          text: {
            fr: 'Leur contenu nous est opaque. Nous en gérons les sauvegardes si vous les activez, et ces sauvegardes contiennent donc les données de vos utilisateurs — raison de plus pour que votre propre politique les couvre.',
            en: 'Their content is opaque to us. We manage their backups if you switch them on, and those backups therefore contain your users’ data — all the more reason for your own policy to cover them.',
          },
        },
        {
          strong: {
            fr: 'Vos journaux de déploiement et d’application',
            en: 'Your deployment and application logs',
          },
          text: {
            fr: 'La sortie de vos constructions et de vos conteneurs, telle que votre application l’écrit. Si votre code journalise une adresse e-mail ou un numéro, cette donnée se retrouve dans le journal : c’est votre code qui décide, pas nous.',
            en: 'The output of your builds and your containers, as your application writes it. If your code logs an e-mail address or a phone number, that data ends up in the log: your code decides, not us.',
          },
        },
        {
          strong: {
            fr: 'Vos noms de domaine et vos certificats',
            en: 'Your domain names and certificates',
          },
          text: {
            fr: 'Les domaines que vous branchez, les enregistrements DNS de vérification, et les certificats que nous obtenons pour vous. Un certificat public porte le nom de domaine : c’est une donnée publique par nature.',
            en: 'The domains you attach, the DNS verification records, and the certificates we obtain for you. A public certificate carries the domain name: that is public data by nature.',
          },
        },
        {
          strong: { fr: 'Vos mesures de consommation', en: 'Your usage meters' },
          text: {
            fr: 'Processeur, mémoire, disque, bande passante, nombre de requêtes, par application et par période. Ce sont des compteurs : ils servent à vous facturer et à dimensionner.',
            en: 'CPU, memory, disk, bandwidth, request counts, per application and per period. These are counters: they serve to bill you and to size the infrastructure.',
          },
        },
      ],
    },
    {
      id: 'firewall',
      title: {
        fr: 'Le pare-feu et les adresses IP de vos visiteurs',
        en: 'The firewall and your visitors’ IP addresses',
      },
      paragraphs: [
        {
          fr: 'Une application exposée sur Internet est attaquée en quelques heures. iDeploy intègre donc un pare-feu applicatif, qui observe le trafic entrant de vos applications pour bloquer les attaques connues, les saturations et les sondages automatisés.',
          en: 'An application exposed to the Internet is attacked within hours. iDeploy therefore embeds an application firewall, which watches your applications’ incoming traffic to block known attacks, floods and automated probing.',
        },
        {
          fr: 'Ce que cela implique concrètement : les adresses IP des visiteurs de vos applications sont examinées. Une adresse qui déclenche une décision de blocage est conservée le temps du blocage, avec le motif. Le reste du trafic n’est conservé que sous forme de compteurs agrégés par période — autorisé, bloqué — sans aucune adresse.',
          en: 'What that means concretely: the IP addresses of your applications’ visitors are examined. An address that triggers a blocking decision is kept for the duration of the block, with the reason. The rest of the traffic is kept only as counters aggregated per period — allowed, blocked — with no address at all.',
        },
        {
          fr: 'Vous pouvez aussi activer un blocage par pays. Dans ce cas, le pays d’origine de chaque requête est déduit de son adresse IP pour appliquer votre règle. Ce traitement est le vôtre : vous l’avez demandé, nous l’exécutons.',
          en: 'You can also switch on country-based blocking. In that case, each request’s country of origin is derived from its IP address to apply your rule. That processing is yours: you asked for it, we carry it out.',
        },
        {
          fr: 'Si votre application sert des utilisateurs européens, ou d’un pays qui traite l’adresse IP comme une donnée personnelle, mentionnez ce pare-feu dans votre propre politique de confidentialité : la sécurité du service est une base légitime, mais elle doit être déclarée.',
          en: 'If your application serves European users, or users of a country that treats an IP address as personal data, mention this firewall in your own privacy policy: securing the service is a legitimate basis, but it must be declared.',
        },
      ],
    },
    {
      id: 'where',
      title: { fr: 'Où vos applications tournent', en: 'Where your applications run' },
      paragraphs: [
        {
          fr: 'Vos applications tournent sur les serveurs que vous choisissez : les nôtres, dans la région que vous sélectionnez, ou les vôtres si vous en connectez un. La région que vous choisissez détermine où vos données et celles de vos utilisateurs résident physiquement.',
          en: 'Your applications run on the servers you choose: ours, in the region you select, or your own if you connect one. The region you choose determines where your data and your users’ data physically resides.',
        },
        {
          fr: 'Si la loi de votre pays, ou celle de vos utilisateurs, impose un stockage local, c’est à vous de choisir une région qui le respecte — et de nous dire si aucune ne convient. Nous ne déplaçons jamais une application d’une région à une autre sans vous le demander.',
          en: 'If your country’s law, or your users’ law, requires local storage, it is for you to choose a region that complies — and to tell us if none does. We never move an application from one region to another without asking you.',
        },
        {
          fr: 'Nos propres outils de supervision (métriques de serveur, alertes) ne regardent que l’état des machines : charge, mémoire, disque, disponibilité. Ils ne lisent pas le contenu de ce qui y tourne.',
          en: 'Our own monitoring tools (server metrics, alerts) look only at the state of the machines: load, memory, disk, availability. They do not read the content of what runs on them.',
        },
      ],
    },
    {
      id: 'access',
      title: { fr: 'Quand nous accédons à votre hébergement', en: 'When we access your hosting' },
      paragraphs: [
        {
          fr: 'Trois cas, et trois seulement : quand vous nous le demandez pour résoudre un incident ; quand une panne de l’infrastructure nous oblige à intervenir sur la machine ; quand la loi nous y contraint.',
          en: 'Three cases, and only three: when you ask us to, to resolve an incident; when an infrastructure failure forces us to act on the machine; when the law compels us.',
        },
        {
          fr: 'Dans les deux premiers cas, nous nous limitons à ce qui est nécessaire — l’état du conteneur, les journaux, la configuration — et nous ne lisons pas le contenu de vos bases. Chaque accès de l’équipe à un contenu utilisateur depuis le panneau d’administration est enregistré pendant un an.',
          en: 'In the first two cases, we limit ourselves to what is necessary — the container’s state, the logs, the configuration — and we do not read the content of your databases. Every team access to user content from the admin panel is recorded for one year.',
        },
      ],
    },
    {
      id: 'retention',
      title: { fr: 'Durées propres à iDeploy', en: 'Durations specific to iDeploy' },
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Application supprimée', en: 'Deleted application' },
            {
              fr: 'Conteneurs arrêtés et images retirées immédiatement ; volumes et sauvegardes effacés selon le délai annoncé dans l’interface avant confirmation',
              en: 'Containers stopped and images removed immediately; volumes and backups erased per the period announced in the interface before you confirm',
            },
          ],
          [
            { fr: 'Journaux de déploiement', en: 'Deployment logs' },
            {
              fr: 'Conservés avec l’application, effacés avec elle',
              en: 'Kept with the application, erased with it',
            },
          ],
          [
            { fr: 'Journaux d’application', en: 'Application logs' },
            {
              fr: 'Rotation par taille ; vous pouvez les purger depuis l’interface',
              en: 'Size-based rotation; you can purge them from the interface',
            },
          ],
          [
            { fr: 'Décisions du pare-feu', en: 'Firewall decisions' },
            {
              fr: 'Le temps du blocage, puis effacées',
              en: 'For the duration of the block, then erased',
            },
          ],
          [
            { fr: 'Compteurs de trafic', en: 'Traffic counters' },
            {
              fr: 'Agrégés par période, sans adresse IP',
              en: 'Aggregated per period, with no IP address',
            },
          ],
          [
            { fr: 'Variables d’environnement et clés', en: 'Environment variables and keys' },
            {
              fr: 'Effacées avec l’application ou le serveur',
              en: 'Erased with the application or the server',
            },
          ],
          [
            { fr: 'Compte supprimé', en: 'Deleted account' },
            {
              fr: 'Vos applications en production sont comptées dans le rapport de purge et arrêtées par l’équipe : nous refusons d’éteindre automatiquement un service en production',
              en: 'Your production applications are counted in the purge report and stopped by the team: we refuse to automatically shut down a production service',
            },
          ],
        ],
      },
    },
    {
      id: 'duties',
      title: { fr: 'Nos engagements comme sous-traitant', en: 'Our commitments as a processor' },
      paragraphs: [
        {
          fr: 'Pour les données de vos utilisateurs, nous agissons sur vos instructions. Nous nous engageons à :',
          en: 'For your users’ data, we act on your instructions. We undertake to:',
        },
      ],
      list: [
        {
          text: {
            fr: 'ne traiter ces données que pour vous fournir l’hébergement, et pour rien d’autre — jamais pour nos propres finalités, jamais pour entraîner un modèle ;',
            en: 'process that data only to provide you with hosting, and for nothing else — never for our own purposes, never to train a model;',
          },
        },
        {
          text: {
            fr: 'ne recourir qu’aux sous-traitants publiés, et vous informer avant d’en ajouter un qui toucherait à votre hébergement ;',
            en: 'use only the published sub-processors, and inform you before adding one that would touch your hosting;',
          },
        },
        {
          text: {
            fr: 'vous assister si l’un de vos utilisateurs exerce un droit d’accès ou de suppression, dans la mesure où cela dépend de l’infrastructure ;',
            en: 'assist you if one of your users exercises a right of access or deletion, to the extent it depends on the infrastructure;',
          },
        },
        {
          text: {
            fr: 'vous signaler sans délai tout incident de sécurité touchant votre hébergement, avec ce que nous savons, pour que vous puissiez notifier votre autorité dans vos propres délais ;',
            en: 'report to you without delay any security incident affecting your hosting, with what we know, so that you can notify your authority within your own deadlines;',
          },
        },
        {
          text: {
            fr: 'effacer ou vous restituer ces données à la fin du service, à votre choix.',
            en: 'erase or return that data to you at the end of the service, at your choice.',
          },
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Pour une question sur ce texte, un accord de sous-traitance signé, ou une demande d’un de vos utilisateurs que vous nous transmettez : legal@idem.africa. Pour un incident technique en cours : support@idem.africa.',
          en: 'For a question about this text, a signed data processing agreement, or a request from one of your users that you pass on to us: legal@idem.africa. For a technical incident in progress: support@idem.africa.',
        },
      ],
    },
  ],
};
