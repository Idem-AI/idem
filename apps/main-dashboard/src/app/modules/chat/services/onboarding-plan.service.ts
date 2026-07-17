import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';

import { OnboardingAiService } from './onboarding-ai.service';
import { OnboardingFieldKey, OnboardingPlanQuestion } from '../models/chat.model';

/** Fondations minimales pour amorcer un plan de questions. */
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

/**
 * Cerveau partagé de l'onboarding IA de création de projet.
 *
 * Centralise ce qui doit rester identique entre le mode chat
 * (`onboarding-chat`) et le mode formulaire (`dynamic-details-form`) :
 *  - récupération + cache du plan de questions adapté au projet ;
 *  - injection des questions d'identité (nom/type) quand elles manquent ;
 *  - mapping des réponses → champs du projet (dont les contraintes « Q: R »).
 *
 * Aucun état de conversation : uniquement un cache de plan par description.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingPlanService {
  private readonly aiService = inject(OnboardingAiService);

  /** Cache du dernier plan généré, clé = description normalisée. */
  private cacheKey: string | null = null;
  private cachedQuestions: OnboardingPlanQuestion[] | null = null;

  /**
   * Récupère le plan de questions adapté au projet décrit.
   * Met en cache par description : une bascule de mode ou un retour arrière
   * ne re-sollicite pas le LLM.
   */
  async getPlan(input: OnboardingPlanInput): Promise<OnboardingPlanQuestion[]> {
    const key = this.normalize(input.description);
    if (this.cachedQuestions && this.cacheKey === key) {
      return this.cachedQuestions;
    }

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
      const base = res?.questions?.length ? res.questions : this.localFallbackQuestions(input.language);
      const questions = this.withCurrency(base, input.language);
      this.cacheKey = key;
      this.cachedQuestions = questions;
      return questions;
    } catch (error) {
      // Échec HTTP total : plan de repli local pour ne jamais bloquer la création.
      console.error('OnboardingPlanService.getPlan failed', error);
      const questions = this.withCurrency(this.localFallbackQuestions(input.language), input.language);
      this.cacheKey = key;
      this.cachedQuestions = questions;
      return questions;
    }
  }

  /**
   * Insère la question « devise » en tête des questions cœur (juste avant
   * targets). Déterministe (options fixes), donc gérée côté client plutôt que
   * par l'IA. Présente dans les deux modes (chat + formulaire).
   */
  private withCurrency(
    questions: OnboardingPlanQuestion[],
    language: 'fr' | 'en',
  ): OnboardingPlanQuestion[] {
    if (questions.some((q) => q.field === 'currency')) return questions;
    return [this.buildCurrencyQuestion(language), ...questions];
  }

  /** Question « devise du projet » — options courantes + « Autre » (saisie libre en chat). */
  buildCurrencyQuestion(language: 'fr' | 'en'): OnboardingPlanQuestion {
    const en = language === 'en';
    return {
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
        { label: en ? 'Naira (₦)' : 'Naira (₦)', value: 'NGN' },
        { label: en ? 'Other (specify)' : 'Autre (préciser)', value: 'other' },
      ],
    };
  }

  /** Invalide le cache (ex. redémarrage du flux). */
  clearCache(): void {
    this.cacheKey = null;
    this.cachedQuestions = null;
  }

  /**
   * Préfixe le plan avec les questions d'identité (nom puis type).
   * Utilisé par le mode chat, où nom/type sont posés dans la conversation.
   *
   * Pour un NOUVEAU projet (pas encore d'`projectId`), le nom et le type sont
   * toujours demandés (exigence produit : « toujours demander le nom »). Pour un
   * projet existant, on ne demande que ce qui manque.
   */
  injectIdentityQuestions(
    questions: OnboardingPlanQuestion[],
    foundations: { name?: string; type?: string; projectId?: string | null },
    language: 'fr' | 'en',
  ): OnboardingPlanQuestion[] {
    const out = [...questions];
    const en = language === 'en';
    const isNew = !foundations.projectId;

    if (isNew || !foundations.type) {
      out.unshift(this.buildTypeQuestion(language));
    }

    if (isNew || !foundations.name) {
      out.unshift({
        id: 'name',
        field: 'name',
        kind: 'open',
        optional: false,
        prompt: en
          ? 'First, what is the name of your project?'
          : "Pour commencer, quel est le nom de votre projet ?",
      });
    }

    return out;
  }

  /**
   * Question « type de projet » recontextualisée pour l'entrepreneuriat
   * (création d'entreprise, commerce…), avec une option « Autres » qui ouvre
   * la saisie manuelle. Les valeurs correspondent à l'enum `ProjectType`.
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
        { label: en ? 'Commerce / E-commerce' : 'Commerce / E-commerce', value: 'ecommerce' },
        { label: en ? 'Web app / SaaS' : 'Application web / SaaS', value: 'web' },
        { label: en ? 'Mobile app' : 'Application mobile', value: 'mobile' },
        { label: en ? 'Other (specify)' : 'Autres (à préciser)', value: 'other' },
      ],
    };
  }

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
        case 'budgetIntervals':
          fields.budgetIntervals = value;
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

  /** Plan de repli local (4 questions cœur) si l'IA est totalement injoignable. */
  private localFallbackQuestions(language: 'fr' | 'en'): OnboardingPlanQuestion[] {
    const en = language === 'en';
    return [
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
        prompt: en ? 'What is the target geographic scope?' : 'Quelle est la portée géographique visée ?',
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
        prompt: en ? 'How many people are on your team?' : 'Combien de personnes composent votre équipe ?',
        chips: [
          { label: 'Solo', value: '1' },
          { label: en ? '2 to 5' : '2 à 5', value: '2-5' },
          { label: en ? '6 to 10' : '6 à 10', value: '6-10' },
          { label: en ? 'More than 10' : 'Plus de 10', value: '10+' },
        ],
      },
      {
        id: 'budget',
        field: 'budgetIntervals',
        kind: 'choice',
        optional: true,
        prompt: en ? 'What is your budget range?' : 'Quelle est votre fourchette de budget ?',
        chips: [
          { label: en ? 'Less than €5,000' : 'Moins de 5 000 €', value: 'lt-5k' },
          { label: '5 000 € - 20 000 €', value: '5k-20k' },
          { label: '20 000 € - 50 000 €', value: '20k-50k' },
          { label: en ? 'More than €50,000' : 'Plus de 50 000 €', value: 'gt-50k' },
        ],
      },
    ];
  }
}
