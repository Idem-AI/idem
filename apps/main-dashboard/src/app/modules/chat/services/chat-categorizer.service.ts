import { Injectable } from '@angular/core';
import { ChatConversationCategory } from '../models/chat.model';

/** Ordre d'affichage des catégories dans la sidebar */
export const CATEGORY_ORDER: ChatConversationCategory[] = [
  'business',
  'marketing',
  'finance',
  'legal',
  'branding',
  'tech',
  'general',
];

export const CATEGORY_ICONS: Record<ChatConversationCategory, string> = {
  business: 'pi pi-briefcase',
  marketing: 'pi pi-megaphone',
  finance: 'pi pi-chart-pie',
  legal: 'pi pi-book',
  branding: 'pi pi-palette',
  tech: 'pi pi-code',
  general: 'pi pi-comments',
};

/** Du plus spécifique au plus générique : la première correspondance gagne */
const CATEGORY_PATTERNS: Array<{ category: ChatConversationCategory; pattern: RegExp }> = [
  {
    category: 'legal',
    pattern:
      /juridique|l[ée]gal|statuts|\bcgu\b|\bcgv\b|\bnda\b|\brgpd\b|contrat|mentions l[ée]gales|conformit[ée]|\bsarl\b|\bsas\b|pacte d'associ[ée]s|legal/i,
  },
  {
    category: 'finance',
    pattern:
      /financ|budget|tr[ée]sorerie|bilan|pr[ée]visionnel|cash\s*-?flow|revenus?|charges?|imp[ôo]ts?|invest|rentabilit[ée]|chiffre d'affaires|lev[ée]e de fonds|funding|amortissement/i,
  },
  {
    category: 'branding',
    pattern:
      /\blogo\b|identit[ée] (visuelle|de marque)|branding|charte graphique|couleurs?|typographie|palette|brand identity/i,
  },
  {
    category: 'marketing',
    pattern:
      /marketing|communication|r[ée]seaux sociaux|campagne|publicit[ée]|\bflyer\b|calendrier [ée]ditorial|\bseo\b|audience|acquisition|social media|newsletter/i,
  },
  {
    category: 'tech',
    pattern:
      /architecture|diagrammes?|d[ée]ploiement|\bcode\b|d[ée]veloppement|\bapi\b|base de donn[ée]es|tests?|serveur|docker|infrastructure|\bbug\b|technique|deploy/i,
  },
  {
    category: 'business',
    pattern:
      /business|plan d'affaires|[ée]tude de march[ée]|strat[ée]gie|mod[èe]le [ée]conomique|pitch|concurrents?|clients?|march[ée]|croissance|vision|offre commerciale/i,
  },
];

/**
 * Catégorisation des conversations par mots-clés FR/EN : le premier message
 * utilisateur range la conversation dans la bonne section de la sidebar.
 */
@Injectable({ providedIn: 'root' })
export class ChatCategorizerService {
  categorize(text: string): ChatConversationCategory {
    const trimmed = (text || '').trim();
    if (!trimmed) return 'general';
    return CATEGORY_PATTERNS.find((entry) => entry.pattern.test(trimmed))?.category ?? 'general';
  }
}
