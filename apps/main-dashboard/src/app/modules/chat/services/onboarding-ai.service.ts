import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OnboardingPlanQuestion } from '../models/chat.model';

interface GenerateQuestionsBody {
  description: string;
  name?: string;
  type?: string;
  language?: string;
  knownAnswers?: Record<string, unknown>;
}

interface ParseAnswerBody {
  field: string;
  question: string;
  answerText: string;
  options?: Array<{ label: string; value: string }>;
  language?: string;
}

export interface ParseAnswerResult {
  value: string | null;
  display: string;
}

/**
 * Client HTTP des endpoints d'onboarding IA (stateless) :
 *  - plan de questions adapté au projet décrit ;
 *  - analyse d'une réponse en texte libre → valeur de champ.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingAiService {
  private readonly apiUrl = `${environment.services.api.url}/project/onboarding`;
  private readonly http = inject(HttpClient);

  generateQuestions(body: GenerateQuestionsBody): Observable<{ questions: OnboardingPlanQuestion[] }> {
    return this.http.post<{ questions: OnboardingPlanQuestion[] }>(
      `${this.apiUrl}/questions`,
      body,
    );
  }

  parseAnswer(body: ParseAnswerBody): Observable<ParseAnswerResult> {
    return this.http.post<ParseAnswerResult>(`${this.apiUrl}/parse`, body);
  }
}
