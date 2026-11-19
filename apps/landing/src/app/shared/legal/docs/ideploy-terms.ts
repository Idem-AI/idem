/**
 * Règles d’hébergement propres à iDeploy.
 *
 * Un hébergeur a besoin de règles que les conditions générales n’ont pas :
 * ce qui peut tourner sur nos machines, ce qui déclenche une suspension, ce
 * qu’il advient d’une application impayée, et comment une plainte d’un tiers
 * est traitée.
 */

import type { LegalDocContent } from '../content.model';

export const IDEPLOY_TERMS: LegalDocContent = {
  id: 'ideploy-terms',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Règles d’hébergement — iDeploy', en: 'Hosting rules — iDeploy' },
  subtitle: {
    fr: 'Ce qui peut tourner sur nos machines, ce qui ne peut pas, ce qui se passe en cas d’impayé ou de plainte, et ce que nous nous engageons à faire avant d’éteindre quoi que ce soit.',
    en: 'What may run on our machines, what may not, what happens on non-payment or a complaint, and what we undertake to do before switching anything off.',
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
          fr: 'Les conditions générales d’utilisation d’IDEM s’appliquent entièrement à iDeploy. Ces règles n’ajoutent que ce qui est propre à l’hébergement, et l’emportent pour iDeploy en cas de contradiction.',
          en: 'The IDEM terms of service apply to iDeploy in full. These rules add only what is specific to hosting, and prevail for iDeploy in the event of a conflict.',
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
          text: {
            fr: 'Et vos obligations sur les données de vos visiteurs.',
            en: 'And your obligations regarding your visitors’ data.',
          },
          link: {
            label: { fr: 'Confidentialité iDeploy', en: 'iDeploy privacy' },
            href: '/privacy/ideploy',
          },
        },
      ],
    },
    {
      id: 'responsibility',
      title: {
        fr: 'Vous êtes l’éditeur de ce que vous hébergez',
        en: 'You are the publisher of what you host',
      },
      paragraphs: [
        {
          fr: 'Nous fournissons des machines, un réseau et des outils. Ce qui tourne dessus est le vôtre : son code, son contenu, ses utilisateurs, ses obligations légales. Nous ne surveillons pas le contenu de vos applications, et nous ne le modérons pas a priori.',
          en: 'We provide machines, a network and tools. What runs on them is yours: its code, its content, its users, its legal obligations. We do not monitor your applications’ content, and we do not moderate it in advance.',
        },
        {
          fr: 'En contrepartie, c’est vous qui répondez de ce qui y est publié : respect du droit d’auteur, des marques, de la vie privée, de la réglementation de votre secteur, et des règles applicables dans les pays où votre service est accessible.',
          en: 'In return, you answer for what is published there: copyright, trade marks, privacy, your sector’s regulation, and the rules applicable in the countries where your service is reachable.',
        },
      ],
    },
    {
      id: 'forbidden',
      title: {
        fr: 'Ce qui ne peut pas tourner sur nos machines',
        en: 'What may not run on our machines',
      },
      paragraphs: [
        {
          fr: 'La liste suivante n’est pas négociable. Elle protège les autres clients, notre réseau, et la réputation des adresses IP que nous partageons.',
          en: 'The following list is not negotiable. It protects other customers, our network, and the reputation of the IP addresses we share.',
        },
      ],
      list: [
        {
          strong: { fr: 'Contenus illégaux', en: 'Illegal content' },
          text: {
            fr: 'Contenu pédopornographique, apologie du terrorisme, incitation à la haine, contrefaçon, vente de produits interdits, diffamation.',
            en: 'Child sexual abuse material, glorification of terrorism, incitement to hatred, counterfeiting, sale of prohibited goods, defamation.',
          },
        },
        {
          strong: { fr: 'Hameçonnage et fraude', en: 'Phishing and fraud' },
          text: {
            fr: 'Toute page qui se fait passer pour une banque, un opérateur, une administration ou une entreprise réelle, ou qui collecte des identifiants sous un faux prétexte. Suspension immédiate, sans préavis.',
            en: 'Any page that passes itself off as a bank, an operator, a public body or a real company, or that collects credentials under false pretences. Immediate suspension, without notice.',
          },
        },
        {
          strong: { fr: 'Minage et calcul abusif', en: 'Mining and abusive compute' },
          text: {
            fr: 'Minage de cryptomonnaie, entraînement de modèles, calcul distribué pour un tiers, et tout usage dont la consommation est sans rapport avec le service déclaré.',
            en: 'Cryptocurrency mining, model training, distributed computing for a third party, and any usage whose consumption bears no relation to the declared service.',
          },
        },
        {
          strong: { fr: 'Courrier en masse', en: 'Bulk mail' },
          text: {
            fr: 'Envoi de courrier non sollicité, relais ouvert, listes achetées. Les e-mails transactionnels de votre application sont évidemment permis.',
            en: 'Sending unsolicited mail, open relays, purchased lists. Your application’s transactional e-mails are of course allowed.',
          },
        },
        {
          strong: { fr: 'Attaques depuis nos adresses', en: 'Attacks from our addresses' },
          text: {
            fr: 'Scan de ports, force brute, saturation, intrusion, nœud de sortie anonymisant ouvert, proxy ouvert.',
            en: 'Port scanning, brute forcing, flooding, intrusion, open anonymising exit node, open proxy.',
          },
        },
        {
          strong: { fr: 'Contournement de nos limites', en: 'Circumventing our limits' },
          text: {
            fr: 'Fractionner un service en plusieurs comptes pour échapper aux compteurs, ou désactiver le pare-feu pour masquer un abus.',
            en: 'Splitting a service across several accounts to escape the meters, or switching off the firewall to hide abuse.',
          },
        },
      ],
    },
    {
      id: 'suspension',
      title: {
        fr: 'Suspension : ce que nous faisons, dans quel ordre',
        en: 'Suspension: what we do, in what order',
      },
      paragraphs: [
        {
          fr: 'Éteindre une application en production, c’est couper le revenu de quelqu’un. Nous ne le faisons pas à la légère, et nous suivons toujours le même ordre.',
          en: 'Switching off a production application cuts off someone’s income. We do not do it lightly, and we always follow the same order.',
        },
      ],
      list: [
        {
          strong: { fr: 'Un abus manifeste et en cours', en: 'Manifest, ongoing abuse' },
          text: {
            fr: 'Hameçonnage, contenu illégal, attaque partant de votre application : nous suspendons d’abord, et nous vous écrivons dans l’heure avec le motif et ce qu’il faut corriger.',
            en: 'Phishing, illegal content, an attack leaving your application: we suspend first, and we write to you within the hour with the reason and what to fix.',
          },
        },
        {
          strong: { fr: 'Un abus de ressources', en: 'Resource abuse' },
          text: {
            fr: 'Nous vous écrivons, nous limitons le débit si nécessaire, et nous vous laissons 72 heures pour corriger avant toute suspension.',
            en: 'We write to you, we throttle if necessary, and we give you 72 hours to fix it before any suspension.',
          },
        },
        {
          strong: { fr: 'Une plainte d’un tiers', en: 'A third-party complaint' },
          text: {
            fr: 'Nous vous la transmettons et nous vous laissons y répondre, sauf si le contenu signalé est manifestement illégal. Nous ne retirons rien sur simple allégation.',
            en: 'We forward it to you and let you answer, unless the reported content is manifestly illegal. We take nothing down on a mere allegation.',
          },
        },
        {
          strong: { fr: 'Une injonction', en: 'A court order' },
          text: {
            fr: 'Nous l’exécutons dans ses termes exacts, et nous vous en informons sauf interdiction.',
            en: 'We carry it out in its exact terms, and we inform you unless forbidden.',
          },
        },
        {
          strong: { fr: 'Dans tous les cas', en: 'In every case' },
          text: {
            fr: 'Une suspension n’est pas une suppression. Vos données restent, et vous pouvez les récupérer. Vous pouvez contester à legal@idem.africa, et nous réexaminons.',
            en: 'A suspension is not a deletion. Your data stays, and you can retrieve it. You can contest at legal@idem.africa, and we review it.',
          },
        },
      ],
    },
    {
      id: 'payment',
      title: { fr: 'Impayé : le calendrier', en: 'Non-payment: the timetable' },
      paragraphs: [
        {
          fr: 'L’hébergement est prélevé sur votre portefeuille par période. Un solde insuffisant ne coupe rien immédiatement.',
          en: 'Hosting is drawn from your wallet per period. An insufficient balance cuts nothing immediately.',
        },
        {
          fr: 'Nous vous écrivons dès que le solde ne couvre plus la période suivante. Vos applications continuent de tourner pendant le délai annoncé dans cet e-mail. Passé ce délai, elles sont suspendues, et vos données sont conservées. Elles ne sont supprimées qu’après un second avertissement, et jamais avant le délai que l’interface vous annonce.',
          en: 'We write to you as soon as the balance no longer covers the next period. Your applications keep running for the period announced in that e-mail. After that period, they are suspended, and your data is kept. It is deleted only after a second warning, and never before the period the interface announces to you.',
        },
        {
          fr: 'Vous pouvez à tout moment exporter votre code, vos volumes et vos sauvegardes — y compris pendant une suspension. Nous ne retenons pas vos données en gage d’un paiement.',
          en: 'You can at any time export your code, your volumes and your backups — including during a suspension. We do not hold your data hostage to a payment.',
        },
      ],
    },
    {
      id: 'availability',
      title: {
        fr: 'Disponibilité, maintenance et sauvegardes',
        en: 'Availability, maintenance and backups',
      },
      paragraphs: [
        {
          fr: 'Nous ne vous promettons pas de taux de disponibilité chiffré, et nous préférons le dire plutôt que d’afficher un chiffre que nous ne saurions pas tenir. Nous visons la continuité, nous surveillons les machines, et nous annonçons les maintenances prévisibles.',
          en: 'We do not promise you a figure for availability, and we prefer to say so rather than display a number we could not honour. We aim for continuity, we monitor the machines, and we announce foreseeable maintenance.',
        },
        {
          fr: 'Les sauvegardes de bases de données sont un service que vous activez, pas un filet automatique. Activez-les, et vérifiez de temps en temps qu’une restauration fonctionne — une sauvegarde jamais restaurée n’est pas une sauvegarde.',
          en: 'Database backups are a service you switch on, not an automatic safety net. Switch them on, and check from time to time that a restore works — a backup never restored is not a backup.',
        },
        {
          fr: 'La responsabilité de la sauvegarde de votre code reste la vôtre : reliez un dépôt, ou téléchargez vos archives.',
          en: 'Responsibility for backing up your code remains yours: connect a repository, or download your archives.',
        },
      ],
    },
    {
      id: 'domains',
      title: { fr: 'Domaines et certificats', en: 'Domains and certificates' },
      paragraphs: [
        {
          fr: 'Vos applications sont servies par défaut sur un sous-domaine d’idem.africa, qui reste à nous : nous pouvons le retirer si l’application est suspendue, et vous ne pouvez pas le revendre.',
          en: 'Your applications are served by default on a subdomain of idem.africa, which stays ours: we can withdraw it if the application is suspended, and you may not resell it.',
        },
        {
          fr: 'Si vous branchez votre propre domaine, il reste le vôtre, et nous obtenons les certificats nécessaires pour vous. Un certificat public fait apparaître votre nom de domaine dans les registres de transparence : c’est inhérent au protocole, pas une divulgation de notre part.',
          en: 'If you attach your own domain, it stays yours, and we obtain the necessary certificates for you. A public certificate makes your domain name appear in transparency logs: that is inherent to the protocol, not a disclosure on our part.',
        },
      ],
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Contester une suspension, répondre à une plainte, demander un accord de sous-traitance : legal@idem.africa. Signaler un abus hébergé chez nous : legal@idem.africa, avec l’adresse concernée. Incident technique : support@idem.africa.',
          en: 'To contest a suspension, answer a complaint, request a data processing agreement: legal@idem.africa. To report abuse hosted with us: legal@idem.africa, with the address concerned. A technical incident: support@idem.africa.',
        },
      ],
    },
  ],
};
