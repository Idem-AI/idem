import axios, { AxiosInstance } from 'axios';
import { JwtError, JwtPayload, signHs256, verifyHs256 } from '../../utils/jwt-hs256.util';

/**
 * Client du serveur d'authentification Supabase auto-hébergé (GoTrue).
 *
 * L'API n'en attend que deux choses :
 * - vérifier un jeton d'accès présenté par un front (signature HS256 avec le
 *   secret partagé `SUPABASE_JWT_SECRET`) ;
 * - l'API d'administration (`/admin/users`), pour la reprise des comptes
 *   existants et la vérification d'une adresse avant rattachement.
 *
 * GoTrue est joint directement, sans passerelle Kong : les chemins n'ont donc
 * pas de préfixe `/auth/v1`.
 */

/** Revendications d'un jeton d'accès Supabase utiles à IDEM. */
export interface SupabaseAccessClaims extends JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  is_anonymous?: boolean;
  session_id?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
    /** Identifiant IDEM d'un compte repris de l'ancien système (script de migration). */
    idem_uid?: string;
    [key: string]: unknown;
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    email_verified?: boolean;
    [key: string]: unknown;
  };
}

/** Utilisateur tel que le renvoie l'API d'administration de GoTrue. */
export interface SupabaseUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: SupabaseAccessClaims['app_metadata'];
  user_metadata?: SupabaseAccessClaims['user_metadata'];
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }>;
}

export interface CreateSupabaseUserInput {
  email: string;
  role?: string;
  email_confirm?: boolean;
  password?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export class SupabaseAuthConfigError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new SupabaseAuthConfigError(`${name} is not configured`);
  return value;
}

/** Secret partagé avec GoTrue (`GOTRUE_JWT_SECRET`). */
export function supabaseJwtSecret(): string {
  const secret = requireEnv('SUPABASE_JWT_SECRET');
  if (secret.length < 32) {
    throw new SupabaseAuthConfigError('SUPABASE_JWT_SECRET must be at least 32 characters');
  }
  return secret;
}

/**
 * Vérifie un jeton d'accès Supabase. Seuls les jetons d'un utilisateur
 * authentifié sont admis : un jeton `service_role` ou anonyme présenté par un
 * navigateur n'est pas une identité. Un rôle vide (compte créé par l'API
 * d'administration sans rôle par défaut) reste un utilisateur.
 */
export function verifySupabaseAccessToken(token: string): SupabaseAccessClaims {
  const claims = verifyHs256<SupabaseAccessClaims>(token, supabaseJwtSecret(), {
    audience: 'authenticated',
  });
  const role = claims.role ?? '';
  if (!claims.sub || (role !== 'authenticated' && role !== '') || claims.is_anonymous === true) {
    throw new JwtError('Not an authenticated user token', 'claims');
  }
  return claims;
}

/** Jeton `service_role` à durée très courte, signé à la demande pour l'API d'administration. */
function serviceRoleToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    { role: 'service_role', iss: 'idem-api', aud: 'authenticated', iat: now, exp: now + 60 },
    supabaseJwtSecret()
  );
}

class SupabaseAdminClient {
  private http(): AxiosInstance {
    const baseURL = requireEnv('SUPABASE_AUTH_URL').replace(/\/+$/, '');
    const token = serviceRoleToken();
    return axios.create({
      baseURL,
      timeout: 10_000,
      headers: { Authorization: `Bearer ${token}`, apikey: token },
    });
  }

  async getUser(id: string): Promise<SupabaseUser | null> {
    try {
      const { data } = await this.http().get<SupabaseUser>(`/admin/users/${encodeURIComponent(id)}`);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  async createUser(input: CreateSupabaseUserInput): Promise<SupabaseUser> {
    const { data } = await this.http().post<SupabaseUser>('/admin/users', input);
    return data;
  }

  async updateUser(id: string, patch: Partial<CreateSupabaseUserInput>): Promise<SupabaseUser> {
    const { data } = await this.http().put<SupabaseUser>(
      `/admin/users/${encodeURIComponent(id)}`,
      patch
    );
    return data;
  }

  /** Une page d'utilisateurs (pagination de GoTrue, `page` à partir de 1). */
  async listUsers(page: number, perPage = 500): Promise<SupabaseUser[]> {
    const { data } = await this.http().get<{ users: SupabaseUser[] }>('/admin/users', {
      params: { page, per_page: perPage },
    });
    return data.users ?? [];
  }

  async health(): Promise<boolean> {
    try {
      const baseURL = requireEnv('SUPABASE_AUTH_URL').replace(/\/+$/, '');
      await axios.get(`${baseURL}/health`, { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const supabaseAdmin = new SupabaseAdminClient();
