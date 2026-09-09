import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import useUserStore from '@/stores/userSlice';

/**
 * Compteur de crédits.
 *
 * Il vivait dans Réglages → Quota, c'est-à-dire à deux clics et hors du champ
 * de vision. Une génération consomme ; savoir ce qu'il reste ne devrait pas
 * demander d'aller le chercher.
 */
export function CreditsBadge() {
  const { t } = useTranslation();
  const { user, fetchUser } = useUserStore();

  useEffect(() => {
    if (!user?.id) fetchUser();
  }, [user?.id, fetchUser]);

  const quota = user?.userQuota;
  if (!user?.id || !quota || !quota.quotaTotal) return null;

  const remaining = Math.max(0, quota.quotaTotal - (quota.usedQuota ?? 0));
  const ratio = remaining / quota.quotaTotal;

  // Le seuil d'alerte n'est pas décoratif : il ne se déclenche qu'au moment où
  // il reste de quoi faire deux ou trois générations.
  const tone =
    ratio <= 0.1
      ? 'text-danger'
      : ratio <= 0.25
        ? 'text-warning'
        : 'text-text-tertiary';

  return (
    <span
      className={`h-8 px-2.5 hidden lg:flex items-center gap-1.5 rounded-lg text-xs tabular-nums ${tone}`}
      title={t('header.creditsTitle', { used: quota.usedQuota ?? 0, total: quota.quotaTotal })}
    >
      <Coins className="w-3.5 h-3.5" />
      {remaining}
    </span>
  );
}

export default CreditsBadge;
