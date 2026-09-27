import { UserModel } from '../models/userModel';

/**
 * Profil renvoyé aux navigateurs et aux services satellites.
 *
 * Le document utilisateur porte des secrets qui ne doivent jamais quitter le
 * serveur : les refresh tokens (qui ouvrent une session de 14 jours) et le
 * jeton d'accès GitHub. On garde seulement le fait que GitHub est connecté.
 */
export function toPublicProfile(user: UserModel): Omit<UserModel, 'refreshTokens'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { refreshTokens, githubIntegration, ...rest } = user as UserModel & Record<string, unknown>;

  if (!githubIntegration) return rest as Omit<UserModel, 'refreshTokens'>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accessToken, ...githubPublic } = githubIntegration as unknown as Record<string, unknown>;
  return { ...rest, githubIntegration: githubPublic } as unknown as Omit<UserModel, 'refreshTokens'>;
}
