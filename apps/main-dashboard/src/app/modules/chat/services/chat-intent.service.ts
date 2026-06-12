import { Injectable } from '@angular/core';
import { DeliverableKind } from '../models/chat.model';

export type ChatIntentType = 'show' | 'download' | 'status' | 'export-all';

export interface ChatIntent {
  type: ChatIntentType;
  kind?: DeliverableKind;
}

const KIND_PATTERNS: Array<{ kind: DeliverableKind; pattern: RegExp }> = [
  { kind: 'businessPlan', pattern: /business\s*-?plan|plan\s*d['’]affaires?|étude de marché|etude de marche|market study/i },
  { kind: 'pitchDeck', pattern: /pitch\s*-?deck|\bpitch\b|deck investisseurs?/i },
  {
    kind: 'branding',
    pattern: /branding|image de marque|identit[ée] (visuelle|de marque)|charte graphique|\blogo\b|brand identity/i,
  },
  { kind: 'diagrams', pattern: /diagrammes?|architecture technique|\bdiagrams?\b|\buml\b/i },
  {
    kind: 'legalDocs',
    pattern: /juridiques?|l[ée]gal|legal docs?|statuts|\bcgu\b|\bcgv\b|\bnda\b|contrats?|mentions l[ée]gales/i,
  },
  {
    kind: 'finance',
    pattern: /financ(es?|ier|ière)|rapport financier|pr[ée]visionnel|tr[ée]sorerie|cash\s*-?flow|bilan/i,
  },
];

const SHOW_VERBS = /montre|affiche|voir|ouvr(e|ir)|consulter?|regarde|pr[ée]sente|show|display|open|view|see\b/i;
const DOWNLOAD_VERBS = /t[ée]l[ée]charge(r|z)?|\bdownload\b|exporte(r|z)?\b(?!.*notion)|\bpdf\b|\bexport\b(?!.*all)/i;
const STATUS_PATTERN =
  /o[ùu] en (est|sommes|suis)|statut|status|avancement|progression|progress\b|r[ée]sum[ée] (du|de mon) projet|project (status|summary)|qu'est-ce qui (manque|reste)/i;
const EXPORT_ALL_PATTERN =
  /tout (exporter|t[ée]l[ée]charger)|exporte(r)? tout|t[ée]l[ée]charge(r)? tout|export all|download (all|everything)/i;

/**
 * Détection locale des intentions du chat : afficher/télécharger un livrable,
 * statut du projet, export global. Les messages sans intention reconnue
 * partent vers l'IA (advisor) pour une réponse libre.
 */
@Injectable({ providedIn: 'root' })
export class ChatIntentService {
  detect(rawText: string): ChatIntent | null {
    const text = rawText.trim();
    if (!text) return null;

    if (EXPORT_ALL_PATTERN.test(text)) {
      return { type: 'export-all' };
    }

    const kind = KIND_PATTERNS.find((entry) => entry.pattern.test(text))?.kind;

    if (kind) {
      if (DOWNLOAD_VERBS.test(text)) {
        return { type: 'download', kind };
      }
      // Verbe d'affichage explicite, ou message court qui ne fait que nommer
      // le livrable ("mon business plan ?") : on affiche la carte.
      if (SHOW_VERBS.test(text) || text.length <= 45) {
        return { type: 'show', kind };
      }
    }

    if (STATUS_PATTERN.test(text)) {
      return { type: 'status' };
    }

    return null;
  }
}
