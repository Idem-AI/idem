/**
 * Les mots des recommandations, une seule fois pour toutes les applications (comme le parcours d'achat de
 * domaine : les mots vivent avec le composant). Une phrase qui dit ce que l'utilisateur y gagne, un bouton qui
 * dit où il va. Mots simples : on « fait connaître son site », on ne « lance pas une stratégie omnicanale ».
 */
import type { JourneyDestination } from './model';

export type JourneyLanguage = 'fr' | 'en';

export interface RecommendationText {
  title: string;
  body: string;
  cta: string;
}

const fr: Record<string, RecommendationText> = {
  'site-to-communication': {
    title: 'Faites connaître votre site',
    body: 'IDEM prépare vos publications pour Facebook, Instagram, WhatsApp et LinkedIn, aux couleurs de votre marque, avec un calendrier pour savoir quoi publier et quand.',
    cta: 'Gérer ma communication',
  },
  'app-to-communication': {
    title: 'Faites connaître votre application',
    body: 'Annoncez-la sur les réseaux : IDEM prépare les visuels et le calendrier de publication, à vos couleurs.',
    cta: 'Gérer ma communication',
  },
  'site-to-publish': {
    title: 'Mettez votre site en ligne',
    body: 'Il est prêt. En ligne, il a une adresse à partager avec vos clients, avec le HTTPS déjà réglé.',
    cta: 'Mettre en ligne',
  },
  'app-to-publish': {
    title: 'Mettez votre application en ligne',
    body: 'IDEM installe la base de données, le serveur et l’interface, et les relie entre eux.',
    cta: 'Mettre en ligne',
  },
  'published-to-domain': {
    title: 'Votre propre nom de domaine',
    body: 'Une adresse à votre nom (votre-entreprise.com) inspire confiance. IDEM l’achète et la relie pour vous.',
    cta: 'Choisir mon nom',
  },
  'published-to-legal': {
    title: 'Les mentions légales de votre site',
    body: 'Un site en ligne doit les afficher. IDEM les rédige à partir de votre projet, avec vos conditions de vente si vous vendez.',
    cta: 'Rédiger mes documents',
  },
  'brand-to-charter': {
    title: 'Votre charte graphique complète',
    body: 'Logo décliné, couleurs, typographies et règles d’usage dans un seul document : tout ce que vous créerez ensuite restera cohérent.',
    cta: 'Créer ma charte',
  },
  'charter-to-site': {
    title: 'Votre site, à votre image',
    body: 'IDEM écrit votre site vitrine à partir de votre projet et de votre charte. Vous le retouchez en parlant.',
    cta: 'Créer mon site',
  },
  'communication-to-video': {
    title: 'Une vidéo pour vos réseaux',
    body: 'Une courte vidéo animée à vos couleurs, prête à publier : c’est ce que les réseaux montrent le plus.',
    cta: 'Créer une vidéo',
  },
  'simulation-to-business-plan': {
    title: 'Votre business plan',
    body: 'Rédigé à partir de votre projet, avec vos chiffres : de quoi convaincre une banque ou un partenaire.',
    cta: 'Rédiger mon business plan',
  },
  'business-plan-to-pitch-deck': {
    title: 'Présentez votre projet',
    body: 'Votre business plan devient une présentation courte et claire, pour un investisseur ou un partenaire.',
    cta: 'Créer ma présentation',
  },
  'site-to-app': {
    title: 'Allez plus loin qu’une vitrine',
    body: 'Réservations, commandes, espace client : IDEM peut aussi construire l’application de votre activité.',
    cta: 'Créer mon application',
  },
};

const en: Record<string, RecommendationText> = {
  'site-to-communication': {
    title: 'Get your website seen',
    body: 'IDEM prepares your posts for Facebook, Instagram, WhatsApp and LinkedIn, in your brand colours, with a calendar of what to post and when.',
    cta: 'Manage my communication',
  },
  'app-to-communication': {
    title: 'Get your app seen',
    body: 'Announce it on social media: IDEM prepares the visuals and the posting calendar, in your colours.',
    cta: 'Manage my communication',
  },
  'site-to-publish': {
    title: 'Put your website online',
    body: 'It is ready. Online, it gets an address to share with your customers, HTTPS included.',
    cta: 'Go live',
  },
  'app-to-publish': {
    title: 'Put your app online',
    body: 'IDEM sets up the database, the server and the interface, and wires them together.',
    cta: 'Go live',
  },
  'published-to-domain': {
    title: 'Your own domain name',
    body: 'An address in your name (your-company.com) builds trust. IDEM buys it and connects it for you.',
    cta: 'Choose my name',
  },
  'published-to-legal': {
    title: 'Your website’s legal notice',
    body: 'A live website must display it. IDEM writes it from your project, with your terms of sale if you sell.',
    cta: 'Write my documents',
  },
  'brand-to-charter': {
    title: 'Your complete brand guidelines',
    body: 'Logo variations, colours, typefaces and usage rules in one document: everything you create next stays consistent.',
    cta: 'Create my guidelines',
  },
  'charter-to-site': {
    title: 'A website that looks like you',
    body: 'IDEM writes your website from your project and your brand. You edit it by talking.',
    cta: 'Create my website',
  },
  'communication-to-video': {
    title: 'A video for your social media',
    body: 'A short animated video in your colours, ready to post: it is what social media shows most.',
    cta: 'Create a video',
  },
  'simulation-to-business-plan': {
    title: 'Your business plan',
    body: 'Written from your project, with your numbers: enough to convince a bank or a partner.',
    cta: 'Write my business plan',
  },
  'business-plan-to-pitch-deck': {
    title: 'Present your project',
    body: 'Your business plan becomes a short, clear deck for an investor or a partner.',
    cta: 'Create my deck',
  },
  'site-to-app': {
    title: 'Go beyond a showcase',
    body: 'Bookings, orders, a customer area: IDEM can also build your business application.',
    cta: 'Create my app',
  },
};

/** Le mot d'attente pour une destination dont la règle n'a pas (encore) de texte propre. */
const generic: Record<JourneyLanguage, Record<JourneyDestination, string>> = {
  fr: {
    communication: 'Gérer ma communication',
    video: 'Créer une vidéo',
    charter: 'Créer ma charte',
    site: 'Créer mon site',
    app: 'Créer mon application',
    'publish-site': 'Mettre en ligne',
    'publish-app': 'Mettre en ligne',
    domain: 'Choisir mon nom',
    'business-plan': 'Rédiger mon business plan',
    'pitch-deck': 'Créer ma présentation',
    legal: 'Rédiger mes documents',
  },
  en: {
    communication: 'Manage my communication',
    video: 'Create a video',
    charter: 'Create my guidelines',
    site: 'Create my website',
    app: 'Create my app',
    'publish-site': 'Go live',
    'publish-app': 'Go live',
    domain: 'Choose my name',
    'business-plan': 'Write my business plan',
    'pitch-deck': 'Create my deck',
    legal: 'Write my documents',
  },
};

const ui = {
  fr: { dismiss: 'Plus tard', label: 'Prochaine étape', newTab: 's’ouvre dans IDEM' },
  en: { dismiss: 'Later', label: 'Next step', newTab: 'opens in IDEM' },
};

export function normalizeJourneyLanguage(language: string | null | undefined): JourneyLanguage {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function recommendationText(id: string, destination: JourneyDestination, language: string | null | undefined): RecommendationText {
  const lang = normalizeJourneyLanguage(language);
  const table = lang === 'en' ? en : fr;
  return table[id] ?? { title: generic[lang][destination], body: '', cta: generic[lang][destination] };
}

export function journeyUiText(language: string | null | undefined): (typeof ui)['fr'] {
  return ui[normalizeJourneyLanguage(language)];
}
