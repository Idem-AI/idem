import { SocialNetwork } from '../../models/communication.model';
import { SocialConnector } from './social-connector.interface';
import { linkedinConnector } from './linkedin.connector';
import { xConnector } from './x.connector';

/**
 * Registry of social connectors, mirroring the AI provider registry pattern.
 * Adding a network (or upgrading one to real OAuth publishing) happens here and
 * in the connector file only — callers resolve connectors through this map.
 */
export const socialConnectors: Record<SocialNetwork, SocialConnector> = {
  linkedin: linkedinConnector,
  x: xConnector,
};

export const SUPPORTED_NETWORKS: SocialNetwork[] = Object.keys(
  socialConnectors
) as SocialNetwork[];

export function getSocialConnector(network: SocialNetwork): SocialConnector {
  const connector = socialConnectors[network];
  if (!connector) {
    throw new Error(`Unsupported social network: ${network}`);
  }
  return connector;
}
