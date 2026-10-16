import axios from 'axios';
import crypto from 'crypto';
import logger from '../../config/logger';
import { decryptValue, encryptValue } from '../../utils/crypto.util';
import { SocialAccount, SocialAccountDocument } from '../../schemas/whatsapp.schema';
import { PUBLISH_NETWORKS, PublishNetwork } from './social-types';

/**
 * Comptes de réseaux sociaux connectés (OAuth 2.0).
 *
 * Sécurité :
 *  - **jetons chiffrés au repos** (AES-GCM, AAD = utilisateur + réseau : un jeton copié d'une ligne à
 *    une autre ne se déchiffre pas), jamais renvoyés au client ni journalisés ;
 *  - **état OAuth chiffré et authentifié**, à usage borné dans le temps (10 min), qui porte le
 *    vérificateur PKCE : la redirection ne peut ni être forgée ni rejouée sur un autre compte ;
 *  - **portées minimales** : publier, rien d'autre ;
 *  - un utilisateur ne connecte un compte QU'À son propre projet (vérifié par l'appelant).
 */
interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  pkce: boolean;
}

const META = {
  authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
  clientIdEnv: 'META_APP_ID',
  clientSecretEnv: 'META_APP_SECRET',
  pkce: false,
};

const PROVIDERS: Record<PublishNetwork, ProviderConfig> = {
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    pkce: false,
  },
  facebook: META,
  instagram: META,
  x: {
    authUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    pkce: true,
  },
};

const STATE_TTL_MS = 10 * 60_000;
const STATE_AAD = 'idem-social-oauth-state';

export const isPublishNetwork = (value: string): value is PublishNetwork => (PUBLISH_NETWORKS as readonly string[]).includes(value);

interface OAuthState {
  u: string;
  p: string;
  n: PublishNetwork;
  v?: string;
  exp: number;
  nonce: string;
}

export class SocialAccountService {
  private redirectUri(network: PublishNetwork): string {
    // Facebook et Instagram partagent la connexion Meta : une seule adresse de retour.
    const slug = network === 'instagram' ? 'facebook' : network;
    return `${process.env.API_PUBLIC_URL || 'http://localhost:3001'}/social/${slug}/callback`;
  }

  isConfigured(network: PublishNetwork): boolean {
    const config = PROVIDERS[network];
    return Boolean(process.env[config.clientIdEnv] && process.env[config.clientSecretEnv]);
  }

  /** Adresse d'autorisation, avec un état qui lie la redirection à CE compte et CE projet. */
  authorizeUrl(userId: string, projectId: string, network: PublishNetwork): string {
    const config = PROVIDERS[network];
    if (!this.isConfigured(network)) throw new Error('network_unconfigured');
    const verifier = config.pkce ? crypto.randomBytes(32).toString('base64url') : undefined;
    const state = encryptValue(
      JSON.stringify({ u: userId, p: projectId, n: network === 'instagram' ? 'facebook' : network, v: verifier, exp: Date.now() + STATE_TTL_MS, nonce: crypto.randomBytes(8).toString('hex') } satisfies OAuthState),
      STATE_AAD
    );
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env[config.clientIdEnv]!,
      redirect_uri: this.redirectUri(network),
      scope: config.scopes.join(network === 'x' || network === 'linkedin' ? ' ' : ','),
      state,
    });
    if (verifier) {
      params.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
      params.set('code_challenge_method', 'S256');
    }
    return `${config.authUrl}?${params.toString()}`;
  }

  readState(state: string): OAuthState | null {
    const plain = decryptValue(state, STATE_AAD);
    if (!plain) return null;
    try {
      const parsed = JSON.parse(plain) as OAuthState;
      return parsed.exp > Date.now() && isPublishNetwork(parsed.n) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Échange le code, repère le compte sur lequel publier et l'enregistre (jetons chiffrés). */
  async completeAuthorization(state: OAuthState, code: string): Promise<PublishNetwork[]> {
    const network = state.n;
    const config = PROVIDERS[network];
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(network),
      client_id: process.env[config.clientIdEnv]!,
      client_secret: process.env[config.clientSecretEnv]!,
      ...(state.v ? { code_verifier: state.v } : {}),
    });
    const token = (await axios.post(config.tokenUrl, body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 })).data as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined;
    const saved: PublishNetwork[] = [];

    const save = async (net: PublishNetwork, account: { accountId: string; accountName?: string; accessToken: string; refreshToken?: string; meta?: Record<string, string> }) => {
      await SocialAccount.updateOne(
        { userId: state.u, projectId: state.p, network: net },
        {
          $set: {
            status: 'active',
            accountId: account.accountId,
            accountName: account.accountName,
            accessTokenEnc: encryptValue(account.accessToken, `social:${state.u}:${net}`),
            ...(account.refreshToken ? { refreshTokenEnc: encryptValue(account.refreshToken, `social:${state.u}:${net}`) } : {}),
            expiresAt,
            scopes: config.scopes,
            meta: account.meta,
          },
        },
        { upsert: true }
      );
      saved.push(net);
    };

    if (network === 'linkedin') {
      const me = (await axios.get('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, timeout: 20_000 })).data;
      await save('linkedin', { accountId: `urn:li:person:${me.sub}`, accountName: me.name, accessToken: token.access_token });
    } else if (network === 'x') {
      const me = (await axios.get('https://api.x.com/2/users/me', { headers: { Authorization: `Bearer ${token.access_token}` }, timeout: 20_000 })).data?.data;
      await save('x', { accountId: me.id, accountName: `@${me.username}`, accessToken: token.access_token, refreshToken: token.refresh_token });
    } else {
      // Meta : jeton long (60 j) puis jeton de page, qui lui n'expire pas.
      const long = (
        await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
          params: { grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, fb_exchange_token: token.access_token },
          timeout: 20_000,
        })
      ).data.access_token as string;
      const pages = (
        await axios.get('https://graph.facebook.com/v21.0/me/accounts', { params: { access_token: long, fields: 'id,name,access_token,instagram_business_account{id,username}' }, timeout: 20_000 })
      ).data?.data as { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
      const page = pages?.[0];
      if (!page) throw new Error('no_page');
      await save('facebook', { accountId: page.id, accountName: page.name, accessToken: page.access_token });
      if (page.instagram_business_account) {
        await save('instagram', { accountId: page.instagram_business_account.id, accountName: page.instagram_business_account.username, accessToken: page.access_token, meta: { pageId: page.id } });
      }
    }
    logger.info('social.connected', { event: 'social.connected', userId: state.u, projectId: state.p, networks: saved });
    return saved;
  }

  async list(userId: string, projectId: string): Promise<SocialAccountDocument[]> {
    return SocialAccount.find({ userId, projectId, status: 'active' });
  }

  async get(userId: string, projectId: string, network: PublishNetwork): Promise<SocialAccountDocument | null> {
    return SocialAccount.findOne({ userId, projectId, network, status: 'active' });
  }

  async revoke(userId: string, projectId: string, network: PublishNetwork): Promise<void> {
    await SocialAccount.updateOne({ userId, projectId, network }, { $set: { status: 'revoked' }, $unset: { accessTokenEnc: '', refreshTokenEnc: '' } });
  }

  /** Jeton d'accès valide (rafraîchi si possible). `null` : il faut se reconnecter. */
  async accessToken(account: SocialAccountDocument): Promise<string | null> {
    const aad = `social:${account.userId}:${account.network}`;
    const expired = account.expiresAt && account.expiresAt.getTime() < Date.now() + 60_000;
    if (!expired) return decryptValue(account.accessTokenEnc, aad);

    if (account.network === 'x' && account.refreshTokenEnc) {
      const refresh = decryptValue(account.refreshTokenEnc, aad);
      if (refresh) {
        try {
          const config = PROVIDERS.x;
          const basic = Buffer.from(`${process.env[config.clientIdEnv]}:${process.env[config.clientSecretEnv]}`).toString('base64');
          const data = (
            await axios.post(config.tokenUrl, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: process.env[config.clientIdEnv]! }).toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
              timeout: 20_000,
            })
          ).data;
          await SocialAccount.updateOne(
            { _id: account._id },
            { $set: { accessTokenEnc: encryptValue(data.access_token, aad), refreshTokenEnc: encryptValue(data.refresh_token ?? refresh, aad), expiresAt: new Date(Date.now() + (data.expires_in ?? 7200) * 1000) } }
          );
          return data.access_token as string;
        } catch {
          // retombe sur « expiré » ci-dessous
        }
      }
    }
    await SocialAccount.updateOne({ _id: account._id }, { $set: { status: 'expired' } });
    return null;
  }
}

export const socialAccountService = new SocialAccountService();
