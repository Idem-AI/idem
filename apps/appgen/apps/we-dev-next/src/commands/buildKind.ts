/**
 * SITE OU APPLICATION — ce que construit une demande écrite sur la page d'accueil d'iCode, sans projet ni produit
 * dans l'adresse.
 *
 * Sans réponse, iCode construisait une application complète (`web-app` : interface, serveur, base de données) pour
 * « un site pour mon restaurant » : un projet lourd, sans le moteur des sites vitrines ni l'aperçu instantané, qui
 * démarrait mal (19/11/2026). Un modèle rapide lit la demande — aucune liste de mots — et dit ce qu'elle décrit. En
 * dessous du seuil de confiance, ou sans réponse dans les 4 s, rien ne change : le chemin habituel décide.
 */
import { modelForCreativity } from '../config/modelConfig.js';
import { ChatLogger } from '../utils/logger.js';
import { ModelCaller, type Verdict } from '../siteEngine/modelCaller.js';
import type { ProjectModel } from '../types/project.js';

export interface BuildKind {
  product: 'site' | 'app' | null;
  platform: 'web' | 'mobile' | null;
  confidence: number;
}

export const BUILD_KIND_THRESHOLD = 0.65;
const TIMEOUT_MS = 4_000;

const SYSTEM = `You read ONE request written to iCode, a tool that builds websites and apps by chat, and say what it asks to build. Answer ONLY JSON: {"product": "site" | "app", "platform": "web" | "mobile", "confidence": 0..1}.
- "site": a showcase website that PRESENTS something — a business, a person, an event, a product, an association, a portfolio: pages of text and images, offers, contact, a form at most. "Un site pour mon restaurant", "a landing page for my app", "site vitrine", "portfolio", "website for my clinic".
- "app": software people USE to do things — accounts and logins, data they create or manage, dashboards, bookings with availability, payments, marketplaces, internal tools, games. "Une application de gestion de stock", "a booking app for my salon", "a CRM".
"platform": "mobile" only when the request asks for a phone application; otherwise "web".
"confidence": how sure you are. A request that could be either gets a low confidence.`;

/** La réponse du modèle, lue et bornée (exportée pour le contrôle sans modèle). */
export function readBuildKind(raw: unknown): BuildKind | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!o || (o.product !== 'site' && o.product !== 'app')) return null;
  return {
    product: o.product,
    platform: o.product === 'app' && o.platform === 'mobile' ? 'mobile' : o.product === 'app' ? 'web' : null,
    confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0)),
  };
}

/**
 * LE PROJET D'UN SITE DEMANDÉ DEPUIS LA PAGE D'ACCUEIL — sans projet IDEM, le moteur des sites vitrines (architecture,
 * design system, catalogue, aperçu section par section) ne tournait pas : le site était écrit au fil de l'eau par le
 * modèle générique. Un appel court tire de la demande ce que le moteur lit d'un projet : le nom (celui donné, sinon
 * un nom court qui convient), une description, le public, et la ville, le pays, les coordonnées s'ils sont écrits.
 * Rien d'inventé au-delà du nom : le contrôle des faits du moteur s'appuie sur ces champs ET sur la demande.
 */
export async function draftSiteProject(options: { text: string; userId: string | null; language: string }): Promise<ProjectModel | null> {
  const text = options.text.trim();
  if (text.length < 4) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const model = process.env.ICODE_INTENT_MODEL?.trim() || modelForCreativity('low');
    const caller = new ModelCaller(model, options.userId, controller.signal);
    const fr = options.language === 'fr';
    const outcome = await caller.json<Record<string, string>>(
      'site-project',
      'You extract, from a request for a showcase website, what the site builder needs. Answer ONLY JSON.',
      `Request: """${text.slice(0, 3000)}"""
Answer: {"name": the business or project name given in the request, else a short fitting name (2-3 words, no quotes), "description": one or two sentences saying what it is and offers (${fr ? 'in French' : 'in English'}), "audience": who it is for (or ""), "city": "" unless written, "country": "" unless written, "phone": "" unless written, "email": "" unless written, "address": "" unless written}
Never invent a price, a figure, a date, a phone number or an address.`,
      (raw) => {
        const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
        const name = typeof o?.name === 'string' ? o.name.trim().replace(/^["«]|["»]$/g, '').slice(0, 60) : '';
        const description = typeof o?.description === 'string' ? o.description.trim().slice(0, 600) : '';
        if (!name || !description) return { problem: 'Answer ONLY the JSON object, with "name" and "description".' };
        const field = (key: string, max: number) => (typeof o?.[key] === 'string' ? (o[key] as string).trim().slice(0, max) : '');
        return { value: { name, description, audience: field('audience', 400), city: field('city', 80), country: field('country', 80), phone: field('phone', 40), email: field('email', 120), address: field('address', 160) } };
      },
      400
    );
    const draft = outcome.value;
    if (!draft) return null;
    ChatLogger.info('INTENT', 'Projet tiré de la demande pour le moteur des sites', { name: draft.name });
    return {
      name: draft.name,
      description: draft.description,
      type: 'web',
      // La demande entière sert d'histoire : le moteur la lit comme un fait du projet.
      longDescription: text.slice(0, 1200),
      targets: draft.audience,
      additionalInfos: { city: draft.city, country: draft.country, phone: draft.phone, email: draft.email, address: draft.address },
    } as unknown as ProjectModel;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeBuildKind(options: { text: string; userId: string | null }): Promise<BuildKind> {
  const none: BuildKind = { product: null, platform: null, confidence: 0 };
  if ((process.env.ICODE_KIND_AGENT ?? 'on').toLowerCase() === 'off') return none;
  const text = options.text.trim();
  if (text.length < 4) return none;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const model = process.env.ICODE_INTENT_MODEL?.trim() || modelForCreativity('low');
    const caller = new ModelCaller(model, options.userId, controller.signal, { hedge: false });
    const outcome = await caller.call(
      'build-kind',
      SYSTEM,
      `Request: """${text.slice(0, 2000)}"""`,
      (answer): Verdict<BuildKind> => {
        const match = answer.replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
        try {
          const parsed = readBuildKind(match ? JSON.parse(match[0]) : null);
          return parsed ? { value: parsed } : { problem: 'Answer ONLY the JSON object.' };
        } catch {
          return { problem: 'Answer ONLY the JSON object.' };
        }
      },
      80,
      0,
      2
    );
    const result = outcome.value ?? none;
    const kept = result.confidence >= BUILD_KIND_THRESHOLD ? result : none;
    ChatLogger.info('INTENT', 'Site ou application : demande lue', { product: result.product, platform: result.platform, confidence: result.confidence, kept: kept.product, ms: Date.now() - started });
    return kept;
  } catch (error) {
    ChatLogger.warn('INTENT', 'Site ou application : agent indisponible, chemin habituel', { message: (error as Error).message });
    return none;
  } finally {
    clearTimeout(timer);
  }
}
