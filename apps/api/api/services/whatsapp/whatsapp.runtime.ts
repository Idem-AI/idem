import { CloudApiTransport } from './whatsapp.client';
import { WhatsappApprovalService } from './whatsapp-approval.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappDailyService } from './whatsapp-daily.service';

/** Les services câblés avec le vrai transport. Les contrôles construisent les leurs avec un transport factice. */
export const whatsappTransport = new CloudApiTransport();
export const whatsappApprovals = new WhatsappApprovalService(whatsappTransport);
export const whatsappConversation = new WhatsappConversationService(whatsappTransport, whatsappApprovals);
export const whatsappDaily = new WhatsappDailyService(whatsappApprovals);
