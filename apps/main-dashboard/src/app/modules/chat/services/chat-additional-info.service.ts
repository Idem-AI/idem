import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { AdvisorService } from '../../dashboard/services/ai-agents/advisor.service';

export type AdditionalInfos = NonNullable<ProjectModel['additionalInfos']>;

const FORMAT_PROMPT = `Tu es un assistant de saisie. L'utilisateur fournit des informations de contact et d'équipe pour son business plan.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans bloc de code, au format exact :
{"email":"","phone":"","address":"","city":"","country":"","zipCode":"","teamMembers":[{"name":"","role":"","email":"","bio":""}]}
Laisse vides les champs absents. N'invente rien. Voici les informations à formater :
`;

/**
 * Collecte des informations supplémentaires du business plan depuis le chat :
 * soit via le mini-formulaire affiché dans le fil, soit en texte libre que
 * l'IA reformate en données structurées (via l'API Advisor existante).
 */
@Injectable({ providedIn: 'root' })
export class ChatAdditionalInfoService {
  private readonly advisorService = inject(AdvisorService);

  /** Reformate un texte libre en AdditionalInfos via l'IA. null si échec. */
  async formatViaAI(projectId: string, rawText: string): Promise<AdditionalInfos | null> {
    try {
      const result = await firstValueFrom(
        this.advisorService.sendMessage(projectId, `${FORMAT_PROMPT}"""${rawText}"""`),
      );
      const parsed = this.extractJson(result.assistantMessage?.content ?? '');
      return parsed ? this.sanitize(parsed) : null;
    } catch (error) {
      console.error('ChatAdditionalInfo: AI formatting failed', error);
      return null;
    }
  }

  /** Extrait le premier objet JSON d'un texte (tolère les blocs de code). */
  private extractJson(text: string): Record<string, unknown> | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Normalise la sortie IA vers le modèle AdditionalInfos attendu. */
  private sanitize(raw: Record<string, unknown>): AdditionalInfos {
    const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
    const members = Array.isArray(raw['teamMembers']) ? raw['teamMembers'] : [];
    return {
      email: str(raw['email']),
      phone: str(raw['phone']),
      address: str(raw['address']),
      city: str(raw['city']),
      country: str(raw['country']),
      zipCode: str(raw['zipCode']),
      teamMembers: members
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => ({
          name: str(m['name']),
          role: str(m['role']) || str(m['position']),
          // Le backend business plan lit `position` : on renseigne les deux
          position: str(m['position']) || str(m['role']),
          email: str(m['email']),
          bio: str(m['bio']),
          socialLinks: {},
        }))
        .filter((m) => m.name) as AdditionalInfos['teamMembers'],
    };
  }

  /** Au moins une information exploitable ? */
  hasContent(infos: AdditionalInfos | null): boolean {
    if (!infos) return false;
    return !!(
      infos.email ||
      infos.phone ||
      infos.address ||
      infos.city ||
      infos.country ||
      (infos.teamMembers?.length ?? 0) > 0
    );
  }
}
