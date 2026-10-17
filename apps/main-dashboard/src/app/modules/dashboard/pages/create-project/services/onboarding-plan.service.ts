import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';

import { OnboardingAiService } from './onboarding-ai.service';
import { OnboardingFieldKey, OnboardingPlanQuestion } from '../models/chat.model';

/** Fondations minimales pour amorcer les questions contextuelles. */
export interface OnboardingPlanInput {
  description: string;
  name?: string;
  type?: string;
  language: 'fr' | 'en';
  /** Réponses déjà connues (évite de re-poser des champs remplis). */
  knownAnswers?: Record<string, unknown>;
}

/** Une réponse résolue à une question du plan (chip ou texte libre). */
export interface OnboardingResolvedAnswer {
  field: OnboardingFieldKey;
  /** Code d'option (choice) ou texte libre (open). */
  value: string;
  /** Libellé lisible affiché à l'utilisateur. */
  display: string;
  /** Texte de la question — nécessaire pour formater les contraintes « Q: R ». */
  prompt?: string;
}

const MIN_CONTEXTUAL = 3;
const MAX_CONTEXTUAL = 5;

/**
 * Cerveau partagé de l'onboarding de création de projet.
 *
 * Deux familles de questions :
 *  - COEUR (déterministe, immédiat, sans appel IA) : devise, cible, portée,
 *    équipe — `buildFixedCoreQuestions`. Le nom et le type s'y ajoutent en chat
 *    via `injectIdentityQuestions`.
 *  - CONTEXTUELLES (IA, 3 à 5) : adaptées au projet, chargées à part avec un
 *    loader — `getContextualQuestions` (cache par description).
 *
 * Centralise aussi le mapping réponses → champs projet (contrat unique chat +
 * formulaire), pour que les deux modes restent synchronisés.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingPlanService {
  private readonly aiService = inject(OnboardingAiService);

  /** Cache des questions contextuelles, clé = description normalisée. */
  private cacheKey: string | null = null;
  private cachedContextual: OnboardingPlanQuestion[] | null = null;

  // ─────────────────────────────────────────────── Questions cœur (fixes)

  /**
   * Questions cœur, déterministes et affichées immédiatement (aucun appel IA).
   * Ordre : devise → cible → portée → équipe. Le budget a été retiré.
   */
  buildFixedCoreQuestions(language: 'fr' | 'en'): OnboardingPlanQuestion[] {
    const en = language === 'en';
    return [
      {
        id: 'currency',
        field: 'currency',
        kind: 'choice',
        optional: false,
        prompt: en
          ? 'Which currency should your project use?'
          : 'Quelle devise votre projet doit-il utiliser ?',
        chips: [
          { label: 'FCFA (XAF)', value: 'XAF' },
          { label: 'Euro (€)', value: 'EUR' },
          { label: en ? 'US Dollar ($)' : 'Dollar US ($)', value: 'USD' },
          { label: 'Naira (₦)', value: 'NGN' },
          { label: en ? 'Other (specify)' : 'Autre (préciser)', value: 'other' },
        ],
      },
      {
        id: 'targets',
        field: 'targets',
        kind: 'choice',
        optional: false,
        prompt: en ? 'Who is your main target audience?' : 'Qui est votre public cible principal ?',
        chips: [
          { label: en ? 'Companies' : 'Entreprises', value: 'business' },
          { label: en ? 'Students' : 'Étudiants', value: 'students' },
          { label: en ? 'General Public' : 'Grand public', value: 'general-public' },
          { label: en ? 'Administrations' : 'Administrations', value: 'government' },
          { label: en ? 'Healthcare Professionals' : 'Professionnels de santé', value: 'healthcare' },
        ],
      },
      {
        id: 'scope',
        field: 'scope',
        kind: 'choice',
        optional: true,
        prompt: en
          ? 'What geographic reach do you envision?'
          : 'Quelle portée géographique visez-vous ?',
        chips: [
          { label: en ? 'Local' : 'Locale', value: 'local' },
          { label: en ? 'Departmental' : 'Départementale', value: 'departmental' },
          { label: en ? 'Regional' : 'Régionale', value: 'regional' },
          { label: en ? 'National' : 'Nationale', value: 'national' },
          { label: en ? 'International' : 'Internationale', value: 'international' },
        ],
      },
      {
        id: 'teamSize',
        field: 'teamSize',
        kind: 'choice',
        optional: true,
        prompt: en
          ? 'How many people are on your core team?'
          : 'Combien de personnes composent votre équipe ?',
        chips: [
          { label: 'Solo', value: '1' },
          { label: en ? '2 to 5' : '2 à 5', value: '2-5' },
          { label: en ? '6 to 10' : '6 à 10', value: '6-10' },
          { label: en ? 'More than 10' : 'Plus de 10', value: '10+' },
        ],
      },
    ];
  }

  // ─────────────────────────────────────────────── Questions contextuelles (IA)

  /**
   * Questions contextuelles générées par l'IA (3 à 5), adaptées au projet.
   * Cache par description. Repli local si l'IA échoue.
   */
  async getContextualQuestions(input: OnboardingPlanInput): Promise<OnboardingPlanQuestion[]> {
    const key = this.normalize(input.description);
    if (this.cachedContextual && this.cacheKey === key) {
      return this.cachedContextual;
    }

    let questions: OnboardingPlanQuestion[];
    try {
      const res = await firstValueFrom(
        this.aiService.generateQuestions({
          description: input.description,
          name: input.name || undefined,
          type: input.type || undefined,
          language: input.language,
          knownAnswers: input.knownAnswers,
        }),
      );
      const contextual = (res?.questions ?? []).filter((q) => q.field === 'constraints');
      questions = this.normalizeContextual(contextual, input.language);
    } catch (error) {
      console.error('OnboardingPlanService.getContextualQuestions failed', error);
      questions = this.fallbackContextual(input.language);
    }

    this.cacheKey = key;
    this.cachedContextual = questions;
    return questions;
  }

  /** Borne les questions contextuelles à [3, 5], en complétant si nécessaire. */
  private normalizeContextual(
    questions: OnboardingPlanQuestion[],
    language: 'fr' | 'en',
  ): OnboardingPlanQuestion[] {
    const out = questions.slice(0, MAX_CONTEXTUAL);
    if (out.length < MIN_CONTEXTUAL) {
      for (const fb of this.fallbackContextual(language)) {
        if (out.length >= MIN_CONTEXTUAL) break;
        if (!out.some((q) => q.prompt === fb.prompt)) out.push(fb);
      }
    }
    return out;
  }

  /** Invalide le cache (ex. redémarrage du flux). */
  clearCache(): void {
    this.cacheKey = null;
    this.cachedContextual = null;
  }

  // ─────────────────────────────────────────────── Identité (nom / type)

  /**
   * Préfixe la liste avec les questions d'identité (nom puis type) manquantes.
   * Utilisé par le mode chat, où nom/type sont posés dans la conversation.
   * Si le champ est déjà connu (rempli en formulaire), il n'est pas re-posé.
   */
  injectIdentityQuestions(
    questions: OnboardingPlanQuestion[],
    foundations: { name?: string; type?: string; projectId?: string | null },
    language: 'fr' | 'en',
  ): OnboardingPlanQuestion[] {
    const out = [...questions];
    const en = language === 'en';

    if (!foundations.type) {
      out.unshift(this.buildTypeQuestion(language));
    }

    if (!foundations.name) {
      out.unshift({
        id: 'name',
        field: 'name',
        kind: 'open',
        optional: false,
        prompt: en
          ? 'First, what is the name of your project?'
          : 'Pour commencer, quel est le nom de votre projet ?',
      });
    }

    return out;
  }

  /**
   * Question « type de projet » recontextualisée pour l'entrepreneuriat, avec
   * une option « Autres » qui ouvre la saisie manuelle. Les valeurs
   * correspondent à l'enum `ProjectType`.
   */
  buildTypeQuestion(language: 'fr' | 'en'): OnboardingPlanQuestion {
    const en = language === 'en';
    return {
      id: 'type',
      field: 'type',
      kind: 'choice',
      optional: false,
      prompt: en
        ? 'What kind of project do you want to launch?'
        : 'Quel type de projet souhaitez-vous lancer ?',
      chips: [
        { label: en ? 'Business creation' : "Création d'entreprise", value: 'enterprise' },
        { label: 'Commerce / E-commerce', value: 'ecommerce' },
        { label: en ? 'Web app / SaaS' : 'Application web / SaaS', value: 'web' },
        { label: en ? 'Mobile app' : 'Application mobile', value: 'mobile' },
        { label: en ? 'Other (specify)' : 'Autres (à préciser)', value: 'other' },
      ],
    };
  }

  // ─────────────────────────────────────────────── Mapping réponses → projet

  /**
   * Convertit une liste de réponses résolues en champs de projet.
   * Contrat de persistance unique pour les deux modes :
   *  - champs cœur → colonnes dédiées ;
   *  - réponses contextuelles (`constraints`) → tableau `constraints[]`
   *    au format « Question: Réponse » (directement exploitable par les
   *    générateurs qui lisent `project.constraints`).
   */
  buildProjectFieldsFromAnswers(answers: OnboardingResolvedAnswer[]): Partial<ProjectModel> {
    const fields: Partial<ProjectModel> = {};
    const constraints: string[] = [];

    for (const a of answers) {
      const value = (a.value ?? '').trim();
      switch (a.field) {
        case 'name':
          if (value) fields.name = value;
          break;
        case 'type':
          if (value) fields.type = value as ProjectModel['type'];
          break;
        case 'targets':
          fields.targets = value;
          break;
        case 'scope':
          fields.scope = value;
          break;
        case 'teamSize':
          fields.teamSize = value;
          break;
        case 'currency':
          // 'other' → on garde le libellé saisi (devise libre) plutôt que le code.
          fields.currency = value === 'other' ? (a.display || '').trim() : value;
          break;
        case 'constraints': {
          const answerText = (a.display || a.value || '').trim();
          if (answerText) {
            constraints.push(a.prompt ? `${a.prompt.trim()}: ${answerText}` : answerText);
          }
          break;
        }
      }
    }

    fields.constraints = constraints;
    return fields;
  }

  // ─────────────────────────────────────────────── Helpers

  private normalize(description: string): string {
    return (description || '').trim().toLowerCase();
  }

  /** Repli local : 3 questions contextuelles simples si l'IA est injoignable. */
  private fallbackContextual(language: 'fr' | 'en'): OnboardingPlanQuestion[] {
    const en = language === 'en';
    const make = (id: string, prompt: string): OnboardingPlanQuestion => ({
      id,
      field: 'constraints',
      kind: 'open',
      optional: true,
      prompt,
    });
    return [
      make(
        'ctx_1',
        en
          ? 'What is the main problem your project solves?'
          : 'Quel est le principal problème que votre projet résout ?',
      ),
      make(
        'ctx_2',
        en
          ? 'What makes your project different from what already exists?'
          : "Qu'est-ce qui distingue votre projet de l'existant ?",
      ),
      make(
        'ctx_3',
        en
          ? 'What would success look like for you in one year?'
          : 'À quoi ressemblerait le succès dans un an ?',
      ),
    ];
  }
}
