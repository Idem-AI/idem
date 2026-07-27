import { AssistedShare, AssistedShareInput, SocialConnector } from './social-connector.interface';

/**
 * X (Twitter) connector — assisted publishing.
 *
 * X exposes a reliable Web Intent that pre-fills the composer text:
 *   https://twitter.com/intent/tweet?text=...
 * Images cannot be pre-attached via the intent, so the user attaches the
 * downloaded visual manually (requiresManualImage = true).
 */
const MAX_LEN = 280;

export const xConnector: SocialConnector = {
  network: 'x',
  displayName: 'X (Twitter)',
  supportsDirectPublish: false,
  maxCaptionLength: MAX_LEN,

  buildAssistedShare(input: AssistedShareInput): AssistedShare {
    // Keep the intent text within X's limit (the caption already contains
    // hashtags). Leave room when a link is appended.
    const reserve = input.linkUrl ? 24 : 0;
    let text = (input.caption || '').trim();
    if (text.length > MAX_LEN - reserve) {
      text = text.slice(0, MAX_LEN - reserve - 1).trimEnd() + '…';
    }
    const params = new URLSearchParams();
    params.set('text', text);
    if (input.linkUrl) params.set('url', input.linkUrl);

    return {
      network: 'x',
      caption: input.caption,
      shareUrl: `https://twitter.com/intent/tweet?${params.toString()}`,
      imageUrl: input.imageUrl,
      requiresManualImage: true,
    };
  },
};
