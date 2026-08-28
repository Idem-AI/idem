import { SocialNetwork } from '../../models/communication.model';

/**
 * Result of preparing an "assisted" share: everything the frontend needs to let
 * the user publish manually in one guided step — a deep link to the network
 * composer, the caption to paste, and the visual to attach.
 */
export interface AssistedShare {
  network: SocialNetwork;
  /** Caption ready to paste (already includes hashtags). */
  caption: string;
  /** Deep link opening the network composer (possibly pre-filled). */
  shareUrl: string;
  /** Rendered visual to attach, when available. */
  imageUrl?: string;
  /**
   * True when the network cannot pre-attach the image via the deep link, so the
   * user must attach the downloaded visual manually. Always true in phase 1.
   */
  requiresManualImage: boolean;
}

export interface AssistedShareInput {
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  /** Optional public URL to reference (e.g. brand website). */
  linkUrl?: string;
}

/**
 * A social network connector. Phase 1 implements assisted publishing only
 * (`buildAssistedShare`). Real OAuth publishing (`publish`, `schedule`,
 * `getAuthStatus`) is intentionally left for phase 2 — kept optional here so the
 * registry and callers never change when it lands.
 */
export interface SocialConnector {
  network: SocialNetwork;
  displayName: string;
  /** Whether real API publishing is wired (false in phase 1). */
  supportsDirectPublish: boolean;
  /** Max caption length the network accepts (used to warn/trim). */
  maxCaptionLength: number;
  buildAssistedShare(input: AssistedShareInput): AssistedShare;
}
