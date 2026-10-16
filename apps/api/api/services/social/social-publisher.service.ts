import axios from 'axios';
import logger from '../../config/logger';
import { SocialAccountDocument } from '../../schemas/whatsapp.schema';
import { socialAccountService } from './social-account.service';
import { PublishNetwork, PublishOutcome, PublishPayload, fullText } from './social-types';

/** Ce réseau ne sait pas publier ce type de média : l'utilisateur le fera à la main. */
export class UnsupportedMediaError extends Error {
  constructor(readonly network: string) {
    super('unsupported_media');
  }
}
/** Le compte n'est pas connecté, ou son autorisation a expiré. */
export class NotConnectedError extends Error {
  constructor(readonly network: string) {
    super('not_connected');
  }
}

/** Contrat des publieurs : un par réseau, interchangeables (et remplaçables dans les contrôles). */
export interface SocialPublisher {
  publish(account: SocialAccountDocument, token: string, payload: PublishPayload): Promise<PublishOutcome>;
}

const GRAPH = 'https://graph.facebook.com/v21.0';
const t = { timeout: 60_000 };

const linkedin: SocialPublisher = {
  async publish(account, token, payload) {
    if (payload.mediaKind !== 'image' || !payload.buffer) throw new UnsupportedMediaError('linkedin');
    const headers = { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202405', 'X-Restli-Protocol-Version': '2.0.0' };
    const init = (await axios.post('https://api.linkedin.com/rest/images?action=initializeUpload', { initializeUploadRequest: { owner: account.accountId } }, { headers, ...t })).data.value;
    await axios.put(init.uploadUrl, payload.buffer, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': payload.mimeType ?? 'image/png' }, ...t });
    // Les caractères réservés de LinkedIn sont échappés, sauf « # » (les hashtags).
    const commentary = fullText(payload).replace(/([\\(){}\[\]<>@|~_*])/g, '\\$1');
    const response = await axios.post(
      'https://api.linkedin.com/rest/posts',
      {
        author: account.accountId,
        commentary,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { id: init.image } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      },
      { headers, ...t }
    );
    const id = String(response.headers['x-restli-id'] ?? '');
    return { externalId: id, externalUrl: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
  },
};

const facebook: SocialPublisher = {
  async publish(account, token, payload) {
    const text = fullText(payload);
    if (payload.mediaKind === 'video') {
      if (!payload.publicUrl) throw new UnsupportedMediaError('facebook');
      const data = (await axios.post(`${GRAPH}/${account.accountId}/videos`, new URLSearchParams({ file_url: payload.publicUrl, description: text, access_token: token }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, ...t })).data;
      return { externalId: data.id, externalUrl: `https://www.facebook.com/${data.id}` };
    }
    if (!payload.buffer) throw new UnsupportedMediaError('facebook');
    const form = new FormData();
    form.append('access_token', token);
    form.append('caption', text);
    form.append('source', new Blob([new Uint8Array(payload.buffer)], { type: payload.mimeType ?? 'image/png' }), 'idem.png');
    const data = (await axios.post(`${GRAPH}/${account.accountId}/photos`, form, t)).data;
    return { externalId: data.post_id ?? data.id, externalUrl: `https://www.facebook.com/${data.post_id ?? data.id}` };
  },
};

const instagram: SocialPublisher = {
  async publish(account, token, payload) {
    // Instagram exige une ADRESSE publique du média, pas un fichier.
    if (!payload.publicUrl) throw new UnsupportedMediaError('instagram');
    const text = fullText(payload);
    const params: Record<string, string> = { caption: text, access_token: token };
    if (payload.mediaKind === 'video') {
      params.media_type = 'REELS';
      params.video_url = payload.publicUrl;
    } else {
      params.image_url = payload.publicUrl;
    }
    const container = (await axios.post(`${GRAPH}/${account.accountId}/media`, new URLSearchParams(params).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, ...t })).data.id as string;
    // Une vidéo se traite côté Instagram avant de pouvoir être publiée.
    for (let i = 0; i < 30; i += 1) {
      const status = (await axios.get(`${GRAPH}/${container}`, { params: { fields: 'status_code', access_token: token }, ...t })).data.status_code as string;
      if (status === 'FINISHED') break;
      if (status === 'ERROR' || status === 'EXPIRED') throw new Error('instagram_container_failed');
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
    const published = (await axios.post(`${GRAPH}/${account.accountId}/media_publish`, new URLSearchParams({ creation_id: container, access_token: token }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, ...t })).data.id as string;
    const permalink = (await axios.get(`${GRAPH}/${published}`, { params: { fields: 'permalink', access_token: token }, ...t }).catch(() => null))?.data?.permalink as string | undefined;
    return { externalId: published, externalUrl: permalink };
  },
};

const x: SocialPublisher = {
  async publish(account, token, payload) {
    if (payload.mediaKind !== 'image' || !payload.buffer) throw new UnsupportedMediaError('x');
    const form = new FormData();
    form.append('media', new Blob([new Uint8Array(payload.buffer)], { type: payload.mimeType ?? 'image/png' }), 'idem.png');
    form.append('media_category', 'tweet_image');
    const media = (await axios.post('https://api.x.com/2/media/upload', form, { headers: { Authorization: `Bearer ${token}` }, ...t })).data?.data;
    // 280 caractères : on coupe la légende, jamais au milieu d'un mot.
    let text = fullText(payload);
    if (text.length > 280) text = `${text.slice(0, 277).replace(/\s+\S*$/, '')}…`;
    const tweet = (await axios.post('https://api.x.com/2/tweets', { text, media: { media_ids: [String(media.id)] } }, { headers: { Authorization: `Bearer ${token}` }, ...t })).data?.data;
    return { externalId: tweet.id, externalUrl: `https://x.com/i/status/${tweet.id}` };
  },
};

export const defaultPublishers: Record<PublishNetwork, SocialPublisher> = { linkedin, facebook, instagram, x };

export class SocialPublisherService {
  constructor(private readonly publishers: Record<PublishNetwork, SocialPublisher> = defaultPublishers) {}

  async publish(userId: string, projectId: string, network: PublishNetwork, payload: PublishPayload): Promise<PublishOutcome> {
    const account = await socialAccountService.get(userId, projectId, network);
    if (!account) throw new NotConnectedError(network);
    const token = await socialAccountService.accessToken(account);
    if (!token) throw new NotConnectedError(network);
    try {
      return await this.publishers[network].publish(account, token, payload);
    } catch (error: any) {
      if (error instanceof UnsupportedMediaError) throw error;
      // Les messages d'erreur des réseaux ne contiennent pas le jeton ; on garde le code et le statut.
      logger.error('social.publish_failed', { event: 'social.publish_failed', network, status: error?.response?.status, detail: error?.response?.data?.error?.message ?? error?.response?.data?.detail ?? error?.message });
      throw new Error('publish_failed');
    }
  }
}

export const socialPublisherService = new SocialPublisherService();
