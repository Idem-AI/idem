import logger from '../../config/logger';
import { WhatsappLink } from '../../schemas/whatsapp.schema';
import { CommunicationService } from '../Communication/communication.service';
import { PromptService } from '../prompt.service';
import { whatsappAccess } from './whatsapp-access';
import { WhatsappApprovalService } from './whatsapp-approval.service';

/** Propositions par jour et par compte : borne le coût et le bruit. */
const MAX_PROPOSALS_PER_DAY = 3;
const OPEN_STATUSES = new Set(['idea', 'approved', 'scheduled']);

/**
 * Les propositions du jour : pour chaque compte lié qui a CONSENTI (`dailyProposals`), le contenu du
 * calendrier daté d'aujourd'hui est fabriqué puis envoyé pour validation. Passage toutes les
 * quelques minutes ; l'heure d'envoi est celle du fuseau de l'utilisateur, et un index unique
 * (compte, projet, contenu, jour) rend chaque proposition idempotente.
 */
export class WhatsappDailyService {
  private readonly communication = new CommunicationService(new PromptService());

  constructor(private readonly approvals: WhatsappApprovalService) {}

  async run(now = new Date()): Promise<{ proposed: number; expired: number }> {
    const expired = await this.approvals.expireOverdue(now);
    let proposed = 0;

    const links = await WhatsappLink.find({ status: 'active', dailyProposals: true, defaultProjectId: { $exists: true } }).limit(2000);
    for (const link of links) {
      try {
        const local = new Date(now.getTime() + link.utcOffsetMinutes * 60_000);
        if (local.getUTCHours() < link.sendHour) continue;
        const day = local.toISOString().slice(0, 10);

        // Forfait expiré : plus aucune proposition, sans attendre que l'utilisateur écrive.
        if (!(await whatsappAccess(link.userId, now)).allowed) continue;

        const plans = await this.communication.listPlans(link.userId, link.defaultProjectId!);
        const todays = plans
          .filter((plan) => plan.status !== 'archived')
          .flatMap((plan) => plan.items)
          .filter((item) => item.scheduledFor === day && OPEN_STATUSES.has(item.status))
          .slice(0, MAX_PROPOSALS_PER_DAY);

        for (const item of todays) {
          const approval = await this.approvals.proposePlanned(link, link.defaultProjectId!, item.id, day);
          if (approval) proposed += 1;
        }
      } catch (error: any) {
        logger.error('whatsapp.daily_failed', { event: 'whatsapp.daily_failed', userId: link.userId, error: error?.message });
      }
    }
    if (proposed || expired) logger.info('whatsapp.daily', { event: 'whatsapp.daily', proposed, expired });
    return { proposed, expired };
  }
}
