/**
 * LES CHOIX DANS LE CHAT — quand une décision revient à l'utilisateur, on la lui pose à cliquer, comme le font
 * les assistants : une question à la fois, chaque option dite en une ligne, la meilleure EN TÊTE et marquée
 * « Recommandé », « Choisir pour moi » pour aller vite. Une question peut aussi demander un mot (l'adresse d'un
 * site) ; la dernière peut demander l'accord aux politiques d'IDEM (jamais coché d'avance).
 *
 * Le serveur pose (marque `<!-- idem:choices {…} -->` dans sa réponse) ; l'atelier dessine et renvoie
 * `answers { purpose, values, consent, context }`, que `dispatch.ts` remet au bon déroulé.
 */
import type { Response } from 'express';
import { SiteStream } from '../siteEngine/stream.js';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
  /** Réglé sur place par l'atelier, sans repasser par le serveur (ouvrir la mise en ligne…). */
  clientAction?: 'publish' | 'domain' | 'communication';
  /** « Non, continuer » : la demande d'origine repart telle quelle, sans être réinterprétée. */
  passthrough?: boolean;
  /** « Pas maintenant » : rien n'est envoyé. */
  dismiss?: boolean;
}

export interface ChoiceQuestion {
  id: string;
  question: string;
  /** Une ligne sous la question, si elle aide à choisir. */
  help?: string;
  /** `choice` (par défaut) : des options à cliquer ; `text` : un mot à écrire (une adresse…). */
  kind?: 'choice' | 'text';
  options?: ChoiceOption[];
  placeholder?: string;
  /** Une option « Autre… » qui ouvre un champ libre. */
  allowOther?: boolean;
}

export interface ChatChoices {
  /** Le déroulé qui reprendra la réponse (`redesign`, `site`, `charter`, `confirm`…). */
  purpose: string;
  questions: ChoiceQuestion[];
  /** Un projet IDEM va naître de la réponse : l'accord aux politiques est demandé. */
  consent?: boolean;
  /** Renvoyé tel quel avec la réponse (adresse déjà connue, demande d'origine…). */
  context?: Record<string, string | boolean | undefined>;
  /** Ce que l'atelier prépare avant d'envoyer la réponse : un site neuf repart d'un espace vide. */
  prepare?: 'site-reset';
  /** Le libellé du bouton final quand plusieurs questions se suivent. */
  submitLabel?: string;
}

export interface ChoicesAnswer {
  purpose: string;
  values: Record<string, string>;
  consent?: boolean;
  context?: Record<string, string | boolean | undefined>;
}

/** La marque lue par l'atelier : JSON dans un commentaire, sans `--` qui le refermerait. */
export function marker(name: 'choices' | 'project' | 'journey' | 'open', payload: unknown): string {
  return `<!-- idem:${name} ${JSON.stringify(payload).replace(/--/g, '\\u002d\\u002d')} -->`;
}

/** Les options recommandées en tête (l'ordre que l'atelier affiche, posé dès le serveur). */
export function withRecommendedFirst(choices: ChatChoices): ChatChoices {
  return {
    ...choices,
    questions: choices.questions.map((q) =>
      q.options ? { ...q, options: [...q.options.filter((o) => o.recommended), ...q.options.filter((o) => !o.recommended)] } : q
    ),
  };
}

/** Une réponse sans modèle : une phrase, et éventuellement des choix à cliquer. Rien n'est facturé. */
export function createTextStream(text: string, choices?: ChatChoices) {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const stream = new SiteStream(res);
      stream.open('none');
      stream.text(text.trim() ? `${text.trim()}\n\n` : '');
      if (choices) stream.text(marker('choices', withRecommendedFirst(choices)));
      stream.close({ promptTokens: 0, completionTokens: 0 });
    },
  };
}

/** Marque invisible des messages envoyés par l'atelier lui-même (même valeur que `utils/stepLabels.ts` du client). */
export const INTERNAL_MARK = '⁣';
