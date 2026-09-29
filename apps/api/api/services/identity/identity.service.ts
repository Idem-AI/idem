import mongoose from 'mongoose';
import logger from '../../config/logger';
import { UserModel } from '../../models/userModel';
import { cacheService } from '../cache.service';
import { userService } from '../user.service';
import { SupabaseAccessClaims, supabaseAdmin } from './supabaseAuth.client';

/**
 * Relie un compte du serveur d'authentification (Supabase) à l'utilisateur
 * IDEM correspondant.
 *
 * L'identifiant IDEM (`uid`) ne change jamais : projets, crédits, paiements et
 * iDeploy y sont rattachés. Un compte antérieur à Supabase garde donc son `uid`
 * d'origine, et le compte Supabase n'en est qu'un moyen d'accès (`authId`).
 *
 * Ordre de résolution :
 * 1. `authId` déjà connu → l'utilisateur rattaché ;
 * 2. `app_metadata.idem_uid` (posé par le script de reprise, non modifiable par
 *    l'utilisateur) → le compte repris ;
 * 3. adresse **vérifiée** par le serveur d'authentification → le compte
 *    existant de même adresse, encore sans `authId` ;
 * 4. sinon, un nouveau compte dont l'`uid` est l'identifiant Supabase.
 *
 * Le rattachement par adresse exige une adresse vérifiée : sans cela, il
 * suffirait de s'inscrire avec l'adresse d'un autre pour prendre son compte.
 */

export class IdentityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'email_required' | 'email_not_verified' | 'account_conflict' | 'unavailable'
  ) {
    super(message);
  }
}

/** Identité portée par `req.user` : remplace l'ancien jeton décodé du fournisseur. */
export interface IdemAuthUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  /** Compte du serveur d'authentification, quand il est connu. */
  authId?: string;
}

const users = () => mongoose.connection.collection('users');

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function invalidateUserCache(uid: string): Promise<void> {
  try {
    await cacheService.delete(cacheService.generateDBKey('users', 'system', uid), { prefix: 'db' });
  } catch {
    // Cache indisponible : la lecture suivante ira en base.
  }
}

function asUser(doc: any): UserModel {
  return { ...doc, uid: doc.uid ?? String(doc._id) } as UserModel;
}

function profileFromClaims(claims: SupabaseAccessClaims) {
  const meta = claims.user_metadata ?? {};
  const displayName = (meta.full_name || meta.name) as string | undefined;
  const photoURL = (meta.avatar_url || meta.picture) as string | undefined;
  const providers = claims.app_metadata?.providers ??
    (claims.app_metadata?.provider ? [claims.app_metadata.provider] : []);
  return { displayName, photoURL, providers };
}

/** Adresse confirmée côté serveur d'authentification (le jeton ne le dit pas). */
async function isEmailConfirmed(authId: string): Promise<boolean> {
  try {
    const user = await supabaseAdmin.getUser(authId);
    return !!user?.email_confirmed_at;
  } catch (error: any) {
    logger.error(`Could not read auth user ${authId}: ${error.message}`);
    throw new IdentityError('Authentication server unavailable', 503, 'unavailable');
  }
}

/** Réserve atomiquement un compte encore libre pour `authId`. */
async function claimAccount(
  filter: Record<string, unknown>,
  authId: string,
  linkedBy: 'import' | 'verified-email',
  set: Record<string, unknown>
): Promise<UserModel | null> {
  const now = new Date();
  const result = await users().findOneAndUpdate(
    { ...filter, authId: { $exists: false } },
    {
      $set: {
        ...set,
        authId,
        lastLogin: now,
        'authMigration.linkedAt': now,
        'authMigration.linkedBy': linkedBy,
      },
    },
    { returnDocument: 'after' }
  );
  const doc = (result as any)?.value !== undefined ? (result as any).value : result;
  if (!doc) return null;
  await invalidateUserCache(String(doc._id));
  logger.info(`Auth account ${authId} linked to IDEM user ${doc._id} (${linkedBy})`);
  return asUser(doc);
}

class IdentityService {
  /** authId → identité, pour les requêtes portant un Bearer Supabase. */
  private readonly userByAuthId = new Map<string, { user: IdemAuthUser; at: number }>();
  private static readonly USER_CACHE_TTL = 60_000;

  /**
   * Utilisateur IDEM d'un jeton Supabase vérifié ; le crée ou le rattache au
   * besoin. Appelé à la connexion (`/auth/sessionLogin`).
   */
  async resolveUser(claims: SupabaseAccessClaims): Promise<UserModel> {
    const authId = claims.sub;
    const email = claims.email?.trim().toLowerCase();
    const { displayName, photoURL, providers } = profileFromClaims(claims);
    const now = new Date();

    // 1. Compte déjà rattaché.
    const linked = await users().findOne({ authId });
    if (linked) {
      const set: Record<string, unknown> = { lastLogin: now, authProviders: providers };
      if (linked.emailVerified !== true && (await isEmailConfirmed(authId))) {
        set.emailVerified = true;
      }
      if (!linked.displayName && displayName) set.displayName = displayName;
      if (!linked.photoURL && photoURL) set.photoURL = photoURL;
      await users().updateOne({ _id: linked._id }, { $set: set });
      await invalidateUserCache(String(linked._id));
      return asUser({ ...linked, ...set });
    }

    if (!email) {
      throw new IdentityError('An email address is required', 400, 'email_required');
    }

    const emailVerified = await isEmailConfirmed(authId);
    const profileSet = {
      emailVerified,
      authProviders: providers,
      ...(displayName && { displayName }),
      ...(photoURL && { photoURL }),
    };

    // 2. Compte repris par le script d'import (identifiant IDEM explicite).
    const importedUid = claims.app_metadata?.idem_uid;
    if (typeof importedUid === 'string' && importedUid) {
      const claimed = await claimAccount({ _id: importedUid as any }, authId, 'import', {
        emailVerified,
        authProviders: providers,
      });
      if (claimed) return claimed;
      const current = await users().findOne({ _id: importedUid as any });
      if (current?.authId === authId) return asUser(current);
      if (current) {
        logger.error(`Imported account ${importedUid} already linked to another auth account`);
        throw new IdentityError('This account is already linked', 409, 'account_conflict');
      }
      // Compte supprimé entre l'import et la connexion : on retombe sur le cas général.
    }

    // 3. Compte existant de même adresse.
    const emailFilter = { email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } };
    const sameEmail = await users().findOne(emailFilter);
    if (sameEmail) {
      if (sameEmail.authId && sameEmail.authId !== authId) {
        throw new IdentityError('This email is linked to another account', 409, 'account_conflict');
      }
      if (!emailVerified) {
        // Le compte existe mais l'adresse n'est pas prouvée : on ne rattache
        // pas, et on ne crée pas de doublon (l'adresse est unique).
        throw new IdentityError('Email address not verified', 403, 'email_not_verified');
      }
      const claimed = await claimAccount({ _id: sameEmail._id }, authId, 'verified-email', {
        emailVerified: true,
        authProviders: providers,
      });
      if (claimed) return claimed;
      const current = await users().findOne({ _id: sameEmail._id });
      if (current?.authId === authId) return asUser(current);
      throw new IdentityError('This email is linked to another account', 409, 'account_conflict');
    }

    // 4. Nouveau compte : l'identifiant Supabase devient l'identifiant IDEM.
    try {
      const created = await userService.createUser({
        uid: authId,
        email,
        subscription: 'free',
        createdAt: now,
        lastLogin: now,
        quota: {},
        roles: ['user'],
        authId,
        ...profileSet,
      } as UserModel);
      logger.info(`New IDEM user created from auth account ${authId}`);
      return created;
    } catch (error: any) {
      // Deux connexions simultanées du même nouveau compte : la seconde
      // trouve le document créé par la première.
      if (error?.code === 11000 || /E11000/.test(error?.message ?? '')) {
        const existing = await users().findOne({ authId });
        if (existing) return asUser(existing);
      }
      throw error;
    }
  }

  /**
   * Identité IDEM d'un compte Supabase déjà rattaché (Bearer sur une requête
   * d'API). Ne crée ni ne rattache rien : c'est le rôle de la connexion.
   */
  async authUserForAuthId(authId: string): Promise<IdemAuthUser | null> {
    const cached = this.userByAuthId.get(authId);
    if (cached && Date.now() - cached.at < IdentityService.USER_CACHE_TTL) return cached.user;

    const doc = await users().findOne(
      { authId },
      { projection: { _id: 1, email: 1, emailVerified: 1, displayName: 1, photoURL: 1 } }
    );
    if (!doc) return null;
    const user = this.toAuthUser(asUser({ ...doc, authId }));
    if (this.userByAuthId.size > 10_000) this.userByAuthId.clear();
    this.userByAuthId.set(authId, { user, at: Date.now() });
    return user;
  }

  toAuthUser(user: UserModel): IdemAuthUser {
    return {
      uid: user.uid,
      email: user.email,
      email_verified: user.emailVerified === true,
      name: user.displayName || undefined,
      picture: user.photoURL || undefined,
      authId: user.authId,
    };
  }
}

export const identityService = new IdentityService();
