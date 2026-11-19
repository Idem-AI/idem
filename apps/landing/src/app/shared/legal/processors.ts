/**
 * Les sous-traitants d'IDEM, en version publique.
 *
 * La version qui *engage le code* vit dans l'API :
 * `apps/api/api/config/data-governance.ts`. Le Privacy Guard refuse tout envoi
 * à un destinataire qui n'y figure pas. Cette liste-ci est la même, écrite pour
 * être lue : à qui, pour quoi, où, et avec quelle conséquence sur les données.
 *
 * Les deux listes doivent porter les mêmes identifiants : `npm run check:legal`
 * échoue sinon. Un sous-traitant ajouté au code sans être publié ici est
 * exactement le manquement qu'une politique de confidentialité est censée
 * empêcher.
 */

import type { T } from './content.model';

export interface PublicProcessor {
  /** La clé de `PROCESSORS` dans `data-governance.ts`. Le lien est vérifié. */
  readonly id: string;
  readonly name: string;
  readonly role: T;
  /** Où le traitement a lieu, du point de vue de l'utilisateur. */
  readonly location: T;
  /** Ce qui lui est transmis, en clair. */
  readonly data: T;
  /** Si le sous-traitant peut réutiliser les données pour entraîner un modèle. */
  readonly training: T;
}

const NO_TRAINING: T = { fr: 'Non', en: 'No' };
const NO_TRAINING_CONTRACT: T = {
  fr: 'Non — interdit par la politique posée à chaque requête',
  en: 'No — forbidden by the policy set on every request',
};
const USER_CHOICE: T = {
  fr: "Selon les conditions du service, que l'utilisateur accepte en le reliant",
  en: 'Per that service’s own terms, accepted by the user when connecting it',
};

export const PUBLIC_PROCESSORS: readonly PublicProcessor[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter, et les hébergeurs de modèles qu’il route',
    role: {
      fr: 'Passerelle de tous les modèles d’IA : texte, image, vidéo, voix',
      en: 'Gateway for every AI model: text, image, video, speech',
    },
    location: {
      fr: 'États-Unis, et les pays de ses hébergeurs',
      en: 'United States, and its hosts’ countries',
    },
    data: {
      fr: 'La demande envoyée au modèle : votre description de projet, vos textes, vos images, vos consignes',
      en: 'The request sent to the model: your project description, your texts, your images, your instructions',
    },
    training: NO_TRAINING_CONTRACT,
  },
  {
    id: 'idem_selfhosted',
    name: 'Serveurs d’inférence IDEM',
    role: {
      fr: 'Modèles exécutés sur nos propres machines',
      en: 'Models running on our own machines',
    },
    location: { fr: 'Infrastructure IDEM', en: 'IDEM infrastructure' },
    data: { fr: 'La demande envoyée au modèle', en: 'The request sent to the model' },
    training: NO_TRAINING,
  },
  {
    id: 'supabase_selfhosted',
    name: 'Supabase GoTrue (auto-hébergé)',
    role: {
      fr: 'Authentification : comptes, mots de passe, sessions',
      en: 'Authentication: accounts, passwords, sessions',
    },
    location: { fr: 'Infrastructure IDEM', en: 'IDEM infrastructure' },
    data: {
      fr: 'Adresse e-mail, empreinte du mot de passe, jetons de session',
      en: 'E-mail address, password hash, session tokens',
    },
    training: NO_TRAINING,
  },
  {
    id: 'minio_selfhosted',
    name: 'MinIO (auto-hébergé)',
    role: {
      fr: 'Les fichiers de vos projets : visuels, vidéos, documents',
      en: 'Your projects’ files: visuals, videos, documents',
    },
    location: { fr: 'Infrastructure IDEM', en: 'IDEM infrastructure' },
    data: {
      fr: 'Les fichiers que vous déposez et ceux que nous produisons',
      en: 'The files you upload and those we produce',
    },
    training: NO_TRAINING,
  },
  {
    id: 'pawapay',
    name: 'pawaPay',
    role: {
      fr: 'Encaissement mobile money dans les pays servis',
      en: 'Mobile money collection in the countries served',
    },
    location: {
      fr: 'Europe, et les opérateurs mobiles du pays de paiement',
      en: 'Europe, and the mobile operators of the paying country',
    },
    data: {
      fr: 'Numéro de téléphone, montant, pays, référence de la transaction',
      en: 'Phone number, amount, country, transaction reference',
    },
    training: NO_TRAINING,
  },
  {
    id: 'smtp',
    name: 'Notre prestataire d’envoi d’e-mails',
    role: {
      fr: 'E-mails de service : confirmation, alerte, facture',
      en: 'Service e-mails: confirmation, alert, invoice',
    },
    location: { fr: 'Hors Cameroun', en: 'Outside Cameroon' },
    data: {
      fr: 'Adresse e-mail et contenu du message envoyé',
      en: 'E-mail address and the content of the message sent',
    },
    training: { fr: 'Non prévu', en: 'Not envisaged' },
  },
  {
    id: 'meta_whatsapp',
    name: 'Meta (WhatsApp Cloud API, Facebook)',
    role: {
      fr: 'Propositions et validations par WhatsApp, publication sur Facebook — seulement si vous reliez le compte',
      en: 'WhatsApp proposals and approvals, Facebook publishing — only if you connect the account',
    },
    location: { fr: 'États-Unis et Irlande', en: 'United States and Ireland' },
    data: {
      fr: 'Numéro WhatsApp, messages échangés, contenus publiés',
      en: 'WhatsApp number, messages exchanged, published content',
    },
    training: USER_CHOICE,
  },
  {
    id: 'social_networks',
    name: 'LinkedIn, X',
    role: {
      fr: 'Publication des visuels que vous choisissez de publier',
      en: 'Publishing the visuals you choose to publish',
    },
    location: { fr: 'États-Unis', en: 'United States' },
    data: {
      fr: 'Le contenu publié, et le jeton du compte relié',
      en: 'The published content, and the connected account’s token',
    },
    training: USER_CHOICE,
  },
  {
    id: 'github',
    name: 'GitHub',
    role: {
      fr: 'Dépôts de code, si vous reliez votre compte',
      en: 'Code repositories, if you connect your account',
    },
    location: { fr: 'États-Unis', en: 'United States' },
    data: {
      fr: 'Le code de vos projets, et le jeton d’accès que vous donnez',
      en: 'Your projects’ code, and the access token you grant',
    },
    training: USER_CHOICE,
  },
  {
    id: 'pexels',
    name: 'Pexels',
    role: {
      fr: 'Photos d’illustration quand la génération échoue',
      en: 'Stock photos when generation fails',
    },
    location: { fr: 'Allemagne', en: 'Germany' },
    data: {
      fr: 'Des mots-clés de recherche. Jamais votre projet, jamais vos fichiers',
      en: 'Search keywords. Never your project, never your files',
    },
    training: NO_TRAINING,
  },
  {
    id: 'domain_registrar',
    name: 'Notre registraire de noms de domaine',
    role: {
      fr: 'Enregistrement et renouvellement des noms achetés via iDomain',
      en: 'Registering and renewing names bought through iDomain',
    },
    location: {
      fr: 'Union européenne, et les registres de chaque extension',
      en: 'European Union, and each extension’s registry',
    },
    data: {
      fr: 'Les coordonnées exigées par le registre : nom, adresse, e-mail, téléphone du titulaire',
      en: 'The contact details the registry requires: holder’s name, address, e-mail, phone',
    },
    training: NO_TRAINING,
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    role: {
      fr: 'Mesure d’audience du site public idem.africa uniquement',
      en: 'Audience measurement on the public idem.africa site only',
    },
    location: { fr: 'États-Unis', en: 'United States' },
    data: {
      fr: 'Pages vues, provenance, appareil, adresse IP tronquée. Jamais le contenu d’un projet',
      en: 'Page views, referrer, device, truncated IP address. Never a project’s content',
    },
    training: { fr: 'Selon les conditions de Google', en: 'Per Google’s own terms' },
  },
];

/** Le tableau publié : qui, pour quoi, où, quoi, entraînement. */
export function processorTable() {
  return {
    headers: [
      { fr: 'Sous-traitant', en: 'Sub-processor' },
      { fr: 'Rôle', en: 'Role' },
      { fr: 'Lieu du traitement', en: 'Place of processing' },
      { fr: 'Ce qui lui est transmis', en: 'What it receives' },
      { fr: 'Entraînement de modèles', en: 'Model training' },
    ] satisfies T[],
    rows: PUBLIC_PROCESSORS.map((processor) => [
      { fr: processor.name, en: processor.name } satisfies T,
      processor.role,
      processor.location,
      processor.data,
      processor.training,
    ]),
  };
}
