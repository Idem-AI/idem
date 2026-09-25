/**
 * Super users : les comptes listés dans `ADMIN_EMAILS`.
 *
 * Une seule définition pour toute la plateforme. Les applications satellites
 * (iDeploy, AppGen, simulateur) ne lisent pas cette variable : elles reçoivent
 * `isSuperUser` dans la réponse de `/auth/profile`. Retirer un email ici retire
 * donc le statut partout, sans redéploiement ailleurs.
 */
export function isSuperUser(email: string | null | undefined): boolean {
  if (!email) return false;

  const superUsers = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return superUsers.includes(email.trim().toLowerCase());
}
