import axios, { AxiosInstance } from 'axios';
import logger from '../../config/logger';
import { maskPhone } from './whatsapp-phone';

/**
 * Émission de messages WhatsApp (API Cloud de Meta).
 *
 * `WhatsappTransport` est l'interface que le reste du code utilise ; la vraie implémentation
 * (`CloudApiTransport`) n'est qu'un client HTTP. Les contrôles (`check:whatsapp`) injectent un
 * transport factice : on teste toute la logique sans envoyer un seul message.
 *
 * Deux régimes de WhatsApp à respecter :
 *  - dans les 24 h qui suivent un message de l'utilisateur, tout texte libre est permis ;
 *  - au-delà, seul un MODÈLE approuvé par Meta peut ouvrir la conversation (`sendTemplate`). C'est
 *    le cas de la proposition du matin : le modèle porte les boutons « Valider / Modifier ».
 */
export interface OutboundButton {
  id: string;
  /** 20 caractères au plus (limite WhatsApp). */
  title: string;
}

export interface SendResult {
  messageId?: string;
}

export interface WhatsappTransport {
  readonly configured: boolean;
  sendText(to: string, text: string): Promise<SendResult>;
  /** Message avec jusqu'à 3 boutons de réponse (fenêtre de 24 h ouverte). */
  sendButtons(to: string, body: string, buttons: OutboundButton[]): Promise<SendResult>;
  sendImage(to: string, media: { buffer?: Buffer; link?: string; mimeType?: string }, caption?: string): Promise<SendResult>;
  sendVideo(to: string, media: { buffer?: Buffer; link?: string; mimeType?: string }, caption?: string): Promise<SendResult>;
  /** Modèle approuvé (hors fenêtre de 24 h) : `params` remplit les variables {{1}}, {{2}}… du corps. */
  sendTemplate(to: string, name: string, language: string, params: string[], buttonPayloads?: string[]): Promise<SendResult>;
}

export interface WhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
}

export function whatsappConfig(): WhatsappConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken, apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0' };
}

export class CloudApiTransport implements WhatsappTransport {
  private readonly http: AxiosInstance;
  readonly configured: boolean;

  constructor(private readonly config: WhatsappConfig | null = whatsappConfig()) {
    this.configured = Boolean(config);
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${config?.apiVersion ?? 'v21.0'}/${config?.phoneNumberId ?? ''}`,
      headers: { Authorization: `Bearer ${config?.accessToken ?? ''}` },
      timeout: 30_000,
    });
  }

  private async post(to: string, payload: Record<string, unknown>): Promise<SendResult> {
    if (!this.configured) throw new Error('whatsapp_unconfigured');
    try {
      const { data } = await this.http.post('/messages', { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload });
      return { messageId: data?.messages?.[0]?.id };
    } catch (error: any) {
      // Le corps de l'erreur de Meta ne contient pas le numéro ; on masque le destinataire par principe.
      logger.error('whatsapp.send_failed', {
        event: 'whatsapp.send_failed',
        to: maskPhone(to),
        status: error?.response?.status,
        code: error?.response?.data?.error?.code,
        message: error?.response?.data?.error?.message ?? error?.message,
      });
      throw new Error('whatsapp_send_failed');
    }
  }

  /** Téléverse un média (WhatsApp l'héberge) : plus robuste qu'un lien public, et rien n'est exposé. */
  private async upload(buffer: Buffer, mimeType: string): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), mimeType.startsWith('video') ? 'idem.mp4' : 'idem.png');
    const { data } = await this.http.post('/media', form);
    if (!data?.id) throw new Error('whatsapp_upload_failed');
    return data.id as string;
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    return this.post(to, { type: 'text', text: { body: text.slice(0, 4000), preview_url: false } });
  }

  async sendButtons(to: string, body: string, buttons: OutboundButton[]): Promise<SendResult> {
    return this.post(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    });
  }

  private async media(kind: 'image' | 'video', to: string, media: { buffer?: Buffer; link?: string; mimeType?: string }, caption?: string): Promise<SendResult> {
    const mimeType = media.mimeType ?? (kind === 'image' ? 'image/png' : 'video/mp4');
    const ref = media.buffer ? { id: await this.upload(media.buffer, mimeType) } : { link: media.link };
    return this.post(to, { type: kind, [kind]: { ...ref, ...(caption ? { caption: caption.slice(0, 1024) } : {}) } });
  }

  sendImage(to: string, media: { buffer?: Buffer; link?: string; mimeType?: string }, caption?: string): Promise<SendResult> {
    return this.media('image', to, media, caption);
  }

  sendVideo(to: string, media: { buffer?: Buffer; link?: string; mimeType?: string }, caption?: string): Promise<SendResult> {
    return this.media('video', to, media, caption);
  }

  sendTemplate(to: string, name: string, language: string, params: string[], buttonPayloads: string[] = []): Promise<SendResult> {
    return this.post(to, {
      type: 'template',
      template: {
        name,
        language: { code: language },
        components: [
          ...(params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: text.slice(0, 1000) })) }] : []),
          ...buttonPayloads.map((payload, index) => ({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] })),
        ],
      },
    });
  }
}
