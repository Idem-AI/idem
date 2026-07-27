import { AssistedShare, AssistedShareInput, SocialConnector } from './social-connector.interface';

/**
 * LinkedIn connector — assisted publishing.
 *
 * LinkedIn has no reliable public deep link that pre-fills a post body with a
 * custom caption AND an attached image, so assisted mode opens the share
 * composer and the user pastes the (copied) caption and attaches the downloaded
 * visual. When a public link is available we use the official share-offsite URL.
 */
const MAX_LEN = 3000;

export const linkedinConnector: SocialConnector = {
  network: 'linkedin',
  displayName: 'LinkedIn',
  supportsDirectPublish: false,
  maxCaptionLength: MAX_LEN,

  buildAssistedShare(input: AssistedShareInput): AssistedShare {
    // Prefer the official offsite share when a URL is provided; otherwise open
    // the composer so the user can paste the caption + attach the visual.
    const shareUrl = input.linkUrl
      ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(input.linkUrl)}`
      : 'https://www.linkedin.com/feed/?shareActive=true';

    return {
      network: 'linkedin',
      caption: input.caption,
      shareUrl,
      imageUrl: input.imageUrl,
      requiresManualImage: true,
    };
  },
};
