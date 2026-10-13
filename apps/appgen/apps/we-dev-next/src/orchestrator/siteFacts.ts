/**
 * Ce que le projet affirme, relevé par le code.
 *
 * Un site vitrine affiche des faits : des prix, des noms, un téléphone. Ce ne
 * sont pas des choses à faire écrire à un modèle — il les invente, et une
 * section Tarifs aux prix inventés est pire qu'aucune section Tarifs. On lit
 * donc ici ce que l'atelier IDEM connaît déjà (finance, infos du projet,
 * équipe, business plan), et le reste du site s'appuie dessus.
 *
 * `projectData` arrive tel que le client l'a chargé depuis l'API : bien plus
 * riche que le type déclaré côté appgen, mais sans garantie de forme. Tout est
 * donc lu défensivement.
 */

import { ProjectModel } from '../types/project.js';

export interface SiteOffer {
  name: string;
  /** Prix affiché, devise comprise. */
  price: string;
  notes: string;
}

export interface SiteTeamMember {
  name: string;
  role: string;
  bio: string;
  photo?: string;
}

export interface SiteChannel {
  label: string;
  value: string;
  href?: string;
}

export interface SiteFacts {
  name: string;
  description: string;
  /** Description longue, quand l'atelier en a une. */
  story: string;
  /** À qui s'adresse le produit, tel que décrit à la création du projet. */
  audience: string;
  city: string;
  country: string;
  offers: SiteOffer[];
  team: SiteTeamMember[];
  channels: SiteChannel[];
  email: string;
  phone: string;
  /** Extraits du business plan : le contexte, pas des chiffres à recopier. */
  background: string;
}

const text = (value: unknown, max = 600): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Les symboles et codes que l'on affiche tels quels. */
const CURRENCY_LABEL: Record<string, string> = {
  XAF: 'F CFA',
  XOF: 'F CFA',
  EUR: '€',
  USD: '$',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  MAD: 'MAD',
  ZAR: 'R',
};

function formatPrice(amount: number, currency: string, language: string): string {
  const label = CURRENCY_LABEL[currency] ?? currency;
  const number = new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })
    .format(amount)
    // L'espace fine insécable de `fr-FR` passe mal dans certaines polices.
    .replace(/ /g, ' ');

  // « 25 000 F CFA », « 12 € » en français ; « $12 », « €12 » en anglais.
  const prefix = label === '$' || (label === '€' && language !== 'fr');
  return prefix ? `${label}${number}` : `${number} ${label}`;
}

/** Un numéro de téléphone réduit à ce qu'accepte `tel:`. */
const dialable = (phone: string): string => phone.replace(/[^\d+]/g, '');

/** Les business plans, dans leurs deux emplacements (ancien et actuel). */
function businessPlanSections(analysis: Record<string, unknown>): Array<Record<string, unknown>> {
  const plans = Array.isArray(analysis.businessPlans) ? analysis.businessPlans : [];
  const first = record(plans[0] ?? analysis.businessPlan);
  return Array.isArray(first.sections) ? (first.sections as Array<Record<string, unknown>>) : [];
}

export function readSiteFacts(projectData: ProjectModel, language: string): SiteFacts {
  const project = record(projectData);
  const analysis = record(project.analysisResultModel);
  const infos = record(project.additionalInfos);
  const finance = record(analysis.finance);
  const currency =
    text(record(finance.meta).currency, 8) || text(project.currency, 8) || 'XAF';

  // Offres : celles de la finance, avec le prix de la première année. Un prix
  // nul ou absent n'est pas un prix : l'offre est écartée plutôt qu'affichée
  // « 0 F CFA ».
  const offers: SiteOffer[] = (Array.isArray(finance.products) ? finance.products : [])
    .map((item) => {
      const product = record(item);
      const prices = Array.isArray(product.prices) ? product.prices : [];
      const amount = Number(prices[0]);
      const name = text(product.name, 80);
      if (!name || !Number.isFinite(amount) || amount <= 0) return null;
      return { name, price: formatPrice(amount, currency, language), notes: text(product.notes, 300) };
    })
    .filter((offer): offer is SiteOffer => offer !== null)
    .slice(0, 4);

  const team: SiteTeamMember[] = (Array.isArray(infos.teamMembers) ? infos.teamMembers : [])
    .map((item) => {
      const member = record(item);
      const name = text(member.name, 80);
      const role = text(member.role, 80);
      if (!name || !role) return null;
      const photo = text(member.pictureUrl, 500);
      return {
        name,
        role,
        bio: text(member.bio, 240),
        ...(/^https:\/\//.test(photo) ? { photo } : {}),
      };
    })
    .filter((member): member is SiteTeamMember => member !== null)
    .slice(0, 6);

  const email = text(infos.email, 120);
  const phone = text(infos.phone, 40);
  const address = [text(infos.address, 160), text(infos.zipCode, 16), text(infos.city, 80)]
    .filter(Boolean)
    .join(', ');

  const fr = language === 'fr';
  const channels: SiteChannel[] = [];
  if (phone && dialable(phone).length >= 6) {
    channels.push({ label: fr ? 'Téléphone' : 'Phone', value: phone, href: `tel:${dialable(phone)}` });
    channels.push({
      label: 'WhatsApp',
      value: phone,
      href: `https://wa.me/${dialable(phone).replace(/^\+/, '')}`,
    });
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    channels.push({ label: fr ? 'E-mail' : 'Email', value: email, href: `mailto:${email}` });
  }
  if (address) {
    channels.push({
      label: fr ? 'Adresse' : 'Address',
      value: address,
      // L'adresse ouvre la carte : depuis un téléphone, c'est l'itinéraire.
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [address, text(infos.country, 80)].filter(Boolean).join(', ')
      )}`,
    });
  }

  // Le business plan sert de toile de fond : ce que fait l'entreprise, son
  // marché, sa clientèle. Les résumés suffisent ; le corps des sections est
  // trop long et chiffré pour être confié tel quel.
  const background = businessPlanSections(analysis)
    .map((section) => {
      const name = text(section.name, 80);
      const summary = text(section.summary, 400);
      return name && summary ? `${name} : ${summary}` : '';
    })
    .filter(Boolean)
    .slice(0, 6)
    .join('\n')
    .slice(0, 2000);

  return {
    name: text(project.name, 80) || 'Projet',
    description: text(project.description, 600),
    story: text(project.longDescription, 1200),
    audience: text(project.targets, 400),
    city: text(infos.city, 80),
    country: text(infos.country, 80),
    offers,
    team,
    channels,
    email: channels.some((channel) => channel.href?.startsWith('mailto:')) ? email : '',
    phone: channels.some((channel) => channel.href?.startsWith('tel:')) ? phone : '',
    background,
  };
}

/** Les faits, rédigés pour un modèle : ce qu'il peut citer, et rien d'autre. */
export function renderFacts(facts: SiteFacts, language: string): string {
  const fr = language === 'fr';
  const lines = [
    `${fr ? 'Nom' : 'Name'} : ${facts.name}`,
    facts.description && `${fr ? 'Ce que fait le projet' : 'What it does'} : ${facts.description}`,
    facts.story && `${fr ? 'Histoire et détails' : 'Story and details'} : ${facts.story}`,
    facts.audience && `${fr ? 'Clientèle visée' : 'Audience'} : ${facts.audience}`,
    (facts.city || facts.country) &&
      `${fr ? 'Lieu' : 'Location'} : ${[facts.city, facts.country].filter(Boolean).join(', ')}`,
    facts.offers.length > 0 &&
      `${fr ? 'Offres (prix réels)' : 'Offers (real prices)'} : ${facts.offers
        .map((offer) => `${offer.name} (${offer.price})${offer.notes ? ` : ${offer.notes}` : ''}`)
        .join(' ; ')}`,
    facts.channels.length > 0 &&
      `${fr ? 'Moyens de contact (les seuls qui existent)' : 'Contact channels (the only ones that exist)'} : ${facts.channels
        .map((channel) => `${channel.label} (${channel.value})`)
        .join(', ')}`,
    facts.background && `${fr ? 'Contexte (business plan)' : 'Background (business plan)'} :\n${facts.background}`,
  ];

  return lines.filter(Boolean).join('\n');
}
