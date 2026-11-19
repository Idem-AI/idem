/**
 * Les conditions générales d’utilisation d’IDEM.
 *
 * Elles remplacent la version en vigueur jusqu’au 19 novembre 2026, qui
 * portait encore deux marqueurs de rédaction en production — « [Jurisdiction] »
 * et « [Arbitration Organization] » — et ne disait rien du portefeuille, du
 * mobile money, ni des pays servis. Un contrat qui ne nomme pas son juge n’en
 * est pas un.
 */

import type { LegalDocContent } from '../content.model';
import { countryList } from '../countries';

export const GLOBAL_TERMS: LegalDocContent = {
  id: 'terms-of-service',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Conditions générales d’utilisation', en: 'Terms of Service' },
  subtitle: {
    fr: 'Le contrat entre vous et IDEM S.A.S. : ce que nous nous engageons à fournir, ce que vous vous engagez à faire, et ce qui se passe quand l’un des deux manque à sa parole.',
    en: 'The contract between you and IDEM S.A.S.: what we undertake to provide, what you undertake to do, and what happens when either of us falls short.',
  },
  sections: [
    {
      id: 'acceptance',
      title: { fr: 'Accepter ces conditions', en: 'Accepting these terms' },
      paragraphs: [
        {
          fr: 'En créant un compte IDEM, ou en utilisant l’un de nos services, vous acceptez ces conditions. Si vous ne les acceptez pas, n’utilisez pas le service.',
          en: 'By creating an IDEM account, or by using any of our services, you accept these terms. If you do not accept them, do not use the service.',
        },
        {
          fr: 'Votre acceptation est enregistrée avec sa date et la version du texte : c’est la preuve de ce que vous avez accepté, et elle vous protège autant que nous.',
          en: 'Your acceptance is recorded with its date and the version of the text: that is the proof of what you accepted, and it protects you as much as us.',
        },
        {
          fr: 'Si vous agissez pour une entreprise, vous déclarez avoir le pouvoir de l’engager, et « vous » désigne alors cette entreprise.',
          en: 'If you act for a company, you represent that you have authority to bind it, and “you” then means that company.',
        },
      ],
    },
    {
      id: 'service',
      title: { fr: 'Ce qu’IDEM fournit', en: 'What IDEM provides' },
      paragraphs: [
        {
          fr: 'IDEM est une plateforme qui met l’intelligence artificielle au service de la création d’entreprise : de l’idée au business plan, du business plan à la marque, de la marque au site, du site à sa mise en ligne.',
          en: 'IDEM is a platform that puts artificial intelligence to work for building a business: from the idea to the business plan, from the plan to the brand, from the brand to the site, from the site to going live.',
        },
      ],
      list: [
        {
          strong: { fr: 'IDEM', en: 'IDEM' },
          text: {
            fr: 'Projets, idées, business plans, chartes de marque, documents juridiques, conseiller, calendrier de communication.',
            en: 'Projects, ideas, business plans, brand charters, legal documents, advisor, communication calendar.',
          },
        },
        {
          strong: { fr: 'iCode', en: 'iCode' },
          text: {
            fr: 'Écriture du site ou de l’application d’un projet, aperçu exécutable, retouches, mise en ligne.',
            en: 'Writing a project’s site or application, runnable preview, edits, going live.',
          },
          link: { label: { fr: 'Règles iCode', en: 'iCode rules' }, href: '/terms/icode' },
        },
        {
          strong: { fr: 'iDeploy', en: 'iDeploy' },
          text: {
            fr: 'Hébergement d’applications, de bases de données et de serveurs, avec noms de domaine et certificats.',
            en: 'Hosting applications, databases and servers, with domain names and certificates.',
          },
          link: { label: { fr: 'Règles iDeploy', en: 'iDeploy rules' }, href: '/terms/ideploy' },
        },
        {
          strong: { fr: 'iVision', en: 'iVision' },
          text: {
            fr: 'Vidéos, visuels et sites produits à partir d’une demande écrite ou dictée.',
            en: 'Videos, visuals and sites produced from a written or dictated request.',
          },
          link: { label: { fr: 'Règles iVision', en: 'iVision rules' }, href: '/terms/ivision' },
        },
        {
          strong: { fr: 'iDomain', en: 'iDomain' },
          text: {
            fr: 'Achat et renouvellement de noms de domaine, payables en mobile money.',
            en: 'Buying and renewing domain names, payable by mobile money.',
          },
          link: { label: { fr: 'Règles iDomain', en: 'iDomain rules' }, href: '/terms/idomain' },
        },
        {
          strong: { fr: 'iSimulator', en: 'iSimulator' },
          text: {
            fr: 'Épreuve d’un business plan contre un marché simulé.',
            en: 'Stress-testing a business plan against a simulated market.',
          },
          link: {
            label: { fr: 'Conditions de la simulation', en: 'Simulation terms' },
            href: '/simulation-terms',
          },
        },
      ],
    },
    {
      id: 'eligibility',
      title: { fr: 'Qui peut utiliser IDEM', en: 'Who may use IDEM' },
      paragraphs: [
        {
          fr: 'Vous devez avoir 18 ans révolus, ou l’accord de la personne qui exerce l’autorité parentale, et la capacité juridique de conclure un contrat.',
          en: 'You must be 18 or over, or have the agreement of the person holding parental authority, and the legal capacity to enter into a contract.',
        },
        {
          fr:
            'Le service est aujourd’hui ouvert dans les pays suivants : ' +
            countryList('fr') +
            '. Cette liste est celle où nous savons vous tarifer et encaisser un paiement mobile money ; elle s’étendra. Vous pouvez créer un compte depuis un autre pays, mais nous ne garantissons alors ni le paiement, ni les prix affichés, ni la disponibilité des moyens de recharge.',
          en:
            'The service is today open in the following countries: ' +
            countryList('en') +
            '. That list is where we can both price you and collect a mobile money payment; it will grow. You may create an account from another country, but we then guarantee neither payment, nor the prices displayed, nor the availability of top-up methods.',
        },
        {
          fr: 'Vous ne pouvez pas utiliser IDEM si une mesure d’embargo ou de sanction vous l’interdit, ni si nous avons déjà fermé un compte à vous pour manquement à ces conditions.',
          en: 'You may not use IDEM if an embargo or sanctions measure forbids it, nor if we have already closed an account of yours for breach of these terms.',
        },
      ],
    },
    {
      id: 'account',
      title: { fr: 'Votre compte', en: 'Your account' },
      paragraphs: [
        {
          fr: 'Votre compte est personnel. Vous êtes responsable de ce qui est fait avec, et de la confidentialité de votre mot de passe.',
          en: 'Your account is personal. You are responsible for what is done with it, and for keeping your password confidential.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Donnez des informations exactes, et tenez-les à jour : une adresse e-mail erronée vous coupe de nos alertes de sécurité et de vos factures.',
            en: 'Give accurate information, and keep it up to date: a wrong e-mail address cuts you off from our security alerts and your invoices.',
          },
        },
        {
          text: {
            fr: 'Ne partagez pas vos identifiants. Vos sessions sont liées à l’appareil qui les ouvre : une connexion depuis un autre appareil est refusée et vous est signalée par e-mail.',
            en: 'Do not share your credentials. Your sessions are bound to the device that opens them: a sign-in from another device is refused and reported to you by e-mail.',
          },
        },
        {
          text: {
            fr: 'Prévenez-nous immédiatement si vous pensez que votre compte est compromis : support@idem.africa.',
            en: 'Tell us immediately if you believe your account is compromised: support@idem.africa.',
          },
        },
        {
          text: {
            fr: 'Un seul compte par personne. Créer plusieurs comptes pour contourner un quota, une promotion ou une suspension est un manquement.',
            en: 'One account per person. Creating several accounts to get around a quota, a promotion or a suspension is a breach.',
          },
        },
      ],
    },
    {
      id: 'acceptable-use',
      title: { fr: 'Ce que vous ne pouvez pas faire', en: 'What you may not do' },
      paragraphs: [
        {
          fr: 'IDEM produit des sites, des applications, des vidéos et des documents, et les met en ligne. Cette puissance a une contrepartie : ce que vous en faites vous engage.',
          en: 'IDEM produces sites, applications, videos and documents, and puts them online. That power has a counterpart: what you do with it binds you.',
        },
      ],
      list: [
        {
          strong: { fr: 'Rien d’illégal', en: 'Nothing illegal' },
          text: {
            fr: 'Ni fraude, ni escroquerie, ni blanchiment, ni vente de produits interdits, ni contenu pédopornographique, ni incitation à la haine ou à la violence.',
            en: 'No fraud, no scams, no money laundering, no sale of prohibited goods, no child sexual abuse material, no incitement to hatred or violence.',
          },
        },
        {
          strong: { fr: 'Rien qui usurpe', en: 'Nothing that impersonates' },
          text: {
            fr: 'Ne produisez pas de site, de marque, de facture, d’avis ou de document qui se fait passer pour une personne ou une organisation réelle, ni de page qui collecte des identifiants ou des coordonnées de paiement sous un faux prétexte.',
            en: 'Do not produce a site, brand, invoice, review or document that passes itself off as a real person or organisation, nor a page that collects credentials or payment details under false pretences.',
          },
        },
        {
          strong: { fr: 'Rien qui vole', en: 'Nothing that steals' },
          text: {
            fr: 'Ne reproduisez pas le travail d’autrui sans droit : marque, logo, texte, photographie, code sous licence incompatible.',
            en: 'Do not reproduce someone else’s work without the right to: trade mark, logo, text, photograph, code under an incompatible licence.',
          },
        },
        {
          strong: { fr: 'Rien qui attaque', en: 'Nothing that attacks' },
          text: {
            fr: 'N’utilisez pas nos services, ni l’hébergement iDeploy, pour scanner, saturer, intruder ou miner quoi que ce soit, ni pour relayer du courrier non sollicité.',
            en: 'Do not use our services, or iDeploy hosting, to scan, flood, intrude on or mine anything, nor to relay unsolicited mail.',
          },
        },
        {
          strong: {
            fr: 'Rien qui détourne la plateforme',
            en: 'Nothing that diverts the platform',
          },
          text: {
            fr: 'N’utilisez pas IDEM comme une passerelle d’accès à des modèles d’IA pour un usage étranger à vos projets, ni pour revendre nos générations comme un service concurrent.',
            en: 'Do not use IDEM as a gateway to AI models for purposes unrelated to your projects, nor to resell our generations as a competing service.',
          },
        },
        {
          strong: { fr: 'Rien qui force nos limites', en: 'Nothing that forces our limits' },
          text: {
            fr: 'Pas de rétro-ingénierie de nos protections, pas de contournement de quota, pas d’automatisation massive de l’interface, pas d’exploitation d’une faille sans nous la signaler d’abord.',
            en: 'No reverse engineering of our protections, no quota circumvention, no mass automation of the interface, no exploitation of a flaw without reporting it to us first.',
          },
        },
      ],
      warning: {
        type: 'warning',
        icon: '⚠️',
        title: {
          fr: 'Ce que nous faisons en cas de manquement',
          en: 'What we do in the event of a breach',
        },
        content: {
          fr: 'Selon la gravité : nous vous écrivons, nous retirons le contenu en cause, nous suspendons la fonction concernée, ou nous fermons le compte. Pour un contenu manifestement illégal, ou une attaque en cours, nous agissons d’abord et nous vous écrivons ensuite. Vous pouvez contester toute mesure à legal@idem.africa, et nous réexaminons.',
          en: 'Depending on severity: we write to you, we take down the content at issue, we suspend the feature concerned, or we close the account. For manifestly illegal content, or an attack in progress, we act first and write to you afterwards. You can contest any measure at legal@idem.africa, and we review it.',
        },
      },
    },
    {
      id: 'your-content',
      title: { fr: 'Ce que vous créez vous appartient', en: 'What you create belongs to you' },
      paragraphs: [
        {
          fr: 'Vos projets, vos textes, vos images, vos business plans, le code et les sites produits pour vous : tout cela est à vous. Nous ne revendiquons aucun droit de propriété sur votre contenu, et nous ne l’utilisons pas pour nous promouvoir sans votre accord écrit.',
          en: 'Your projects, your texts, your images, your business plans, the code and sites produced for you: all of it is yours. We claim no ownership over your content, and we do not use it to promote ourselves without your written agreement.',
        },
        {
          fr: 'Pour pouvoir vous servir, vous nous accordez une licence strictement technique et limitée : stocker votre contenu, l’afficher dans votre compte, le transmettre aux modèles nécessaires à la génération que vous demandez, le publier là où vous demandez qu’il soit publié, et le sauvegarder. Cette licence ne sert à rien d’autre, et elle s’éteint quand vous supprimez le contenu.',
          en: 'So that we can serve you, you grant us a strictly technical and limited licence: to store your content, display it in your account, transmit it to the models needed for the generation you request, publish it where you ask it to be published, and back it up. That licence serves nothing else, and it ends when you delete the content.',
        },
        {
          fr: 'Vous nous garantissez que vous avez le droit de nous confier ce que vous déposez — notamment les images, les polices, les marques et les textes d’un tiers.',
          en: 'You warrant to us that you have the right to entrust us with what you upload — in particular a third party’s images, fonts, trade marks and texts.',
        },
      ],
    },
    {
      id: 'ai-content',
      title: { fr: 'Ce que l’IA produit pour vous', en: 'What the AI produces for you' },
      paragraphs: [
        {
          fr: 'Ce qui est généré à partir de votre demande vous est cédé : vous pouvez l’utiliser, le modifier, le publier et l’exploiter commercialement, sans redevance.',
          en: 'What is generated from your request is assigned to you: you may use it, modify it, publish it and exploit it commercially, royalty-free.',
        },
        {
          fr: 'Deux réserves, qui tiennent à la nature même de ces outils. D’une part, un modèle peut produire, pour deux utilisateurs différents, des résultats très proches : nous ne pouvons donc pas vous garantir l’exclusivité d’un texte, d’un visuel ou d’un logo. D’autre part, le droit de la propriété intellectuelle applicable à une création générée par machine n’est pas tranché partout de la même façon : nous ne pouvons pas vous garantir qu’elle sera protégeable comme une création humaine.',
          en: 'Two reservations, inherent to these tools. First, a model can produce very similar results for two different users: we therefore cannot guarantee you exclusivity over a text, a visual or a logo. Second, intellectual property law applied to a machine-generated work is not settled the same way everywhere: we cannot guarantee it will be protectable like a human creation.',
        },
        {
          fr: 'Vérifiez avant de publier. Un contenu généré peut comporter des erreurs de fait, des chiffres faux, une référence inventée, ou ressembler involontairement à une œuvre existante. Vous êtes responsable de ce que vous publiez sous votre nom.',
          en: 'Check before publishing. Generated content can contain factual errors, wrong figures, an invented reference, or unintentionally resemble an existing work. You are responsible for what you publish under your own name.',
        },
        {
          fr: 'Les documents juridiques générés ne sont pas un conseil juridique, les plans financiers ne sont pas un conseil en investissement, et un indice de viabilité n’est pas une prévision. Faites relire ce qui vous engage.',
          en: 'Generated legal documents are not legal advice, financial plans are not investment advice, and a viability index is not a forecast. Have anything that binds you reviewed.',
        },
      ],
    },
    {
      id: 'our-content',
      title: { fr: 'Ce qui nous appartient', en: 'What belongs to us' },
      paragraphs: [
        {
          fr: 'La plateforme, ses moteurs, ses catalogues de gabarits, son design, ses marques et ses logos nous appartiennent. Les utiliser suppose notre autorisation, sauf dans la mesure où notre licence open source vous y autorise.',
          en: 'The platform, its engines, its template catalogues, its design, its trade marks and its logos belong to us. Using them requires our authorisation, except to the extent our open source licence allows it.',
        },
        {
          fr: 'Le code d’IDEM est publié sous licence Apache 2.0 assortie d’une Commons Clause : vous pouvez le lire, l’exécuter, le modifier et le réutiliser, mais pas vendre le logiciel ni un service dont la valeur tient essentiellement à ce code. Le texte de la licence est la référence, et il prime sur ce résumé.',
          en: 'IDEM’s code is published under the Apache 2.0 licence with a Commons Clause: you may read it, run it, modify it and reuse it, but you may not sell the software nor a service whose value derives substantially from this code. The licence text is the reference, and it prevails over this summary.',
        },
      ],
    },
    {
      id: 'wallet',
      title: {
        fr: 'Le portefeuille, les prix et les paiements',
        en: 'The wallet, prices and payments',
      },
      paragraphs: [
        {
          fr: 'IDEM fonctionne au portefeuille : vous le rechargez, et chaque génération, chaque hébergement et chaque domaine le débitent au prix affiché avant l’action. Le prix est affiché dans la monnaie de votre pays, et nous vous disons ce qui va être débité avant de le débiter.',
          en: 'IDEM runs on a wallet: you top it up, and each generation, each hosting plan and each domain debits it at the price shown before the action. The price is shown in your country’s currency, and we tell you what is about to be debited before debiting it.',
        },
      ],
      list: [
        {
          strong: { fr: 'Recharge', en: 'Top-up' },
          text: {
            fr: 'Par mobile money, via notre prestataire de paiement, dans les pays servis. Une recharge est encaissée par l’opérateur : nous ne voyons jamais votre code PIN.',
            en: 'By mobile money, through our payment provider, in the countries served. A top-up is collected by the operator: we never see your PIN.',
          },
        },
        {
          strong: { fr: 'Prix', en: 'Prices' },
          text: {
            fr: 'Fixés pays par pays. Nous pouvons les faire évoluer ; le nouveau prix ne s’applique qu’aux actions postérieures, jamais à ce que vous avez déjà payé.',
            en: 'Set country by country. We may change them; the new price applies only to later actions, never to what you have already paid.',
          },
        },
        {
          strong: { fr: 'Remboursement', en: 'Refunds' },
          text: {
            fr: 'Une recharge non consommée vous est remboursée sur demande dans les 14 jours, sur le même numéro. Une génération réussie est due. Une génération échouée de notre fait n’est pas débitée, et si elle l’a été, elle vous est recréditée.',
            en: 'An unused top-up is refunded on request within 14 days, to the same number. A successful generation is payable. A generation that failed through our fault is not debited, and if it was, it is credited back to you.',
          },
        },
        {
          strong: { fr: 'Hébergement et domaines', en: 'Hosting and domains' },
          text: {
            fr: 'Facturés par période. Un nom de domaine, une fois enregistré auprès du registre, n’est pas remboursable : c’est une règle du registre, pas la nôtre.',
            en: 'Billed per period. A domain name, once registered with the registry, is not refundable: that is a registry rule, not ours.',
          },
        },
        {
          strong: { fr: 'Solde insuffisant', en: 'Insufficient balance' },
          text: {
            fr: 'Les générations s’arrêtent, et vos applications hébergées sont suspendues après un délai que nous vous annonçons par e-mail. Nous ne supprimons rien sans vous avoir prévenu.',
            en: 'Generations stop, and your hosted applications are suspended after a period we announce to you by e-mail. We delete nothing without having warned you.',
          },
        },
        {
          strong: { fr: 'Factures et impôts', en: 'Invoices and taxes' },
          text: {
            fr: 'Vos factures sont disponibles dans votre compte. Les prix sont indiqués hors taxes applicables dans votre pays, qui restent à votre charge sauf mention contraire.',
            en: 'Your invoices are available in your account. Prices are stated excluding taxes applicable in your country, which remain your responsibility unless stated otherwise.',
          },
        },
      ],
    },
    {
      id: 'quotas',
      title: { fr: 'Les quotas et les limites', en: 'Quotas and limits' },
      paragraphs: [
        {
          fr: 'Chaque fonction a des limites par jour, par semaine et par mois, et chaque génération a un budget maximal. Ces limites existent pour que le service reste disponible et abordable pour tous, et pour qu’une boucle qui déraille ne vide pas votre portefeuille.',
          en: 'Each feature has limits per day, per week and per month, and each generation has a maximum budget. Those limits exist so that the service stays available and affordable for everyone, and so that a runaway loop does not empty your wallet.',
        },
        {
          fr: 'Nous pouvons les ajuster. Si un ajustement vous est défavorable, nous vous l’annonçons avant. Un usage qui dégrade le service pour les autres peut être ralenti ou suspendu, et nous vous en donnons la raison.',
          en: 'We may adjust them. If an adjustment is unfavourable to you, we announce it beforehand. Usage that degrades the service for others may be throttled or suspended, and we give you the reason.',
        },
      ],
    },
    {
      id: 'availability',
      title: { fr: 'La disponibilité du service', en: 'Service availability' },
      paragraphs: [
        {
          fr: 'Nous faisons fonctionner IDEM du mieux que nous pouvons, sans vous garantir une disponibilité chiffrée. Le service dépend de modèles d’IA tiers, d’opérateurs mobile money, de registres de domaines et de réseaux que nous n’opérons pas.',
          en: 'We run IDEM as well as we can, without guaranteeing you a figure for availability. The service depends on third-party AI models, mobile money operators, domain registries and networks we do not operate.',
        },
        {
          fr: 'Nous pouvons interrompre le service pour maintenance, et nous l’annonçons quand c’est prévisible. Nous pouvons retirer une fonction ; si elle est payante, nous vous laissons le temps d’en sortir et nous vous remboursons ce qui reste.',
          en: 'We may interrupt the service for maintenance, and we announce it when it is foreseeable. We may withdraw a feature; if it is paid for, we give you time to move off it and we refund what remains.',
        },
        {
          fr: 'Le service est fourni en l’état. Nous ne garantissons pas qu’il sera exempt d’erreurs, ni que ce qu’il produit répondra à votre besoin particulier.',
          en: 'The service is provided as is. We do not warrant that it will be free of errors, nor that what it produces will meet your particular need.',
        },
      ],
    },
    {
      id: 'liability',
      title: { fr: 'Notre responsabilité', en: 'Our liability' },
      paragraphs: [
        {
          fr: 'Nous répondons des dommages directs que nous causons par notre faute. Dans la limite de ce que la loi autorise, notre responsabilité totale est plafonnée au montant que vous nous avez payé au cours des douze mois précédant le fait générateur.',
          en: 'We answer for direct damage we cause through our fault. To the extent the law allows, our total liability is capped at the amount you paid us in the twelve months before the triggering event.',
        },
        {
          fr: 'Nous ne répondons pas de votre manque à gagner, de la perte d’une occasion d’affaires, du préjudice d’image, ni des conséquences d’un contenu généré que vous avez publié sans le vérifier.',
          en: 'We do not answer for your lost profits, a lost business opportunity, reputational harm, or the consequences of generated content you published without checking it.',
        },
        {
          fr: 'Rien ici ne limite notre responsabilité en cas de dol, de faute lourde, de dommage corporel, ni dans les cas où la loi applicable interdit une telle limitation.',
          en: 'Nothing here limits our liability for wilful misconduct, gross negligence, personal injury, or in cases where the applicable law forbids such a limitation.',
        },
        {
          fr: 'Vous nous garantissez contre les réclamations de tiers nées de ce que vous avez publié, hébergé ou diffusé avec nos services en violation de ces conditions.',
          en: 'You indemnify us against third-party claims arising from what you published, hosted or distributed with our services in breach of these terms.',
        },
      ],
    },
    {
      id: 'privacy',
      title: { fr: 'Vos données', en: 'Your data' },
      paragraphs: [
        {
          fr: 'Le traitement de vos données personnelles est décrit dans notre politique de confidentialité, qui fait partie de ce contrat. L’essentiel : vos projets sont à vous, ils n’entraînent aucun modèle, et la suppression de votre compte est réellement exécutée.',
          en: 'The processing of your personal data is described in our privacy policy, which forms part of this contract. The essentials: your projects are yours, they train no model, and deleting your account is actually carried out.',
        },
      ],
      list: [
        {
          text: {
            fr: 'Le texte complet, et les compléments par service.',
            en: 'The full text, and the per-service addenda.',
          },
          link: {
            label: { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
            href: '/privacy-policy',
          },
        },
      ],
    },
    {
      id: 'termination',
      title: { fr: 'Mettre fin au contrat', en: 'Ending the contract' },
      paragraphs: [
        {
          fr: 'Vous pouvez partir quand vous voulez : supprimez votre compte depuis votre espace. Le délai de grâce de 180 jours décrit dans la politique de confidentialité s’applique, et vous reconnecter l’annule.',
          en: 'You can leave whenever you want: delete your account from your space. The 180-day grace period described in the privacy policy applies, and signing in again cancels it.',
        },
        {
          fr: 'Nous pouvons fermer votre compte en cas de manquement grave à ces conditions, d’impayé persistant, ou d’obligation légale. Nous vous écrivons avant, sauf lorsque l’urgence ou la loi l’interdit, et nous vous laissons récupérer votre contenu.',
          en: 'We may close your account for a serious breach of these terms, persistent non-payment, or a legal obligation. We write to you beforehand, except where urgency or the law forbids it, and we let you retrieve your content.',
        },
        {
          fr: 'Après la fin du contrat : les clauses sur la propriété intellectuelle, la responsabilité, les données et le droit applicable survivent.',
          en: 'After the contract ends: the clauses on intellectual property, liability, data and applicable law survive.',
        },
      ],
    },
    {
      id: 'law',
      title: { fr: 'Le droit applicable et le juge', en: 'Applicable law and the court' },
      paragraphs: [
        {
          fr: 'Ce contrat est régi par le droit camerounais.',
          en: 'This contract is governed by Cameroonian law.',
        },
        {
          fr: 'Avant toute action, écrivez-nous à legal@idem.africa : nous nous engageons à chercher une solution amiable pendant trente jours. Passé ce délai, les tribunaux compétents de Douala, au Cameroun, sont seuls compétents.',
          en: 'Before any action, write to us at legal@idem.africa: we undertake to seek an amicable solution for thirty days. After that period, the competent courts of Douala, Cameroon, have exclusive jurisdiction.',
        },
        {
          fr: 'Si vous êtes consommateur et que la loi de votre pays de résidence vous donne le droit de saisir le juge de ce pays, ou vous accorde une protection à laquelle vous ne pouvez pas renoncer, ce droit et cette protection s’appliquent malgré ce qui précède.',
          en: 'If you are a consumer and the law of your country of residence gives you the right to bring proceedings there, or grants you protection you cannot waive, that right and that protection apply notwithstanding the above.',
        },
      ],
    },
    {
      id: 'changes',
      title: { fr: 'Les modifications de ces conditions', en: 'Changes to these terms' },
      paragraphs: [
        {
          fr: 'Ces conditions portent une date d’effet et un numéro de version. Toute modification de fond fait l’objet d’une nouvelle version, annoncée par e-mail au moins trente jours avant son entrée en vigueur.',
          en: 'These terms carry an effective date and a version number. Any substantive change results in a new version, announced by e-mail at least thirty days before it takes effect.',
        },
        {
          fr: 'Continuer d’utiliser le service après cette date vaut acceptation. Si la modification ne vous convient pas, supprimez votre compte avant : nous vous remboursons le solde non consommé de votre portefeuille.',
          en: 'Continuing to use the service after that date counts as acceptance. If the change does not suit you, delete your account beforehand: we refund the unused balance of your wallet.',
        },
      ],
    },
    {
      id: 'misc',
      title: { fr: 'Divers', en: 'Miscellaneous' },
      paragraphs: [
        {
          fr: 'Si une clause de ce contrat est jugée nulle, les autres restent en vigueur. Notre tolérance ponctuelle à un manquement ne vaut pas renonciation. Vous ne pouvez pas céder ce contrat sans notre accord ; nous pouvons le céder à un repreneur de l’activité, en vous en informant.',
          en: 'If a clause of this contract is held void, the others remain in force. Our occasional tolerance of a breach is not a waiver. You may not assign this contract without our agreement; we may assign it to a transferee of the business, informing you of it.',
        },
        {
          fr: 'Ces conditions, la politique de confidentialité et les compléments par service forment l’ensemble de notre accord. En cas de contradiction, le complément du service concerné l’emporte pour ce service.',
          en: 'These terms, the privacy policy and the per-service addenda form the whole of our agreement. In the event of a conflict, the addendum of the service concerned prevails for that service.',
        },
        {
          fr: 'Ce texte existe en français et en anglais. En cas de divergence d’interprétation, la version française prévaut.',
          en: 'This text exists in French and English. In the event of a divergence of interpretation, the French version prevails.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'IDEM S.A.S., Douala, Cameroun. Questions juridiques et contestations : legal@idem.africa. Problème technique : support@idem.africa. Reste : contact@idem.africa.',
          en: 'IDEM S.A.S., Douala, Cameroon. Legal questions and disputes: legal@idem.africa. Technical problem: support@idem.africa. Anything else: contact@idem.africa.',
        },
      ],
    },
  ],
};
