import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import useUserStore from '@/stores/userSlice';
import useBillingStore from '@/stores/billingSlice';

/**
 * Compteur de crédits iCode.
 *
 * Il vivait dans Réglages → Quota, c'est-à-dire à deux clics et hors du champ
 * de vision. Une génération consomme ; savoir ce qu'il reste ne devrait pas
 * demander d'aller le chercher.
 *
 * La source est désormais la facturation IDEM (`/billing/me`) et non le quota
 * local : c'est elle qui décide, et afficher un chiffre différent de celui qui
 * sera débité serait pire que ne rien afficher.
 */
export function CreditsBadge() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { me, loadMe } = useBillingStore();

  useEffect(() => {
    if (user?.id && !me) void loadMe();
  }, [user?.id, me, loadMe]);

  // Tant que les droits ne sont pas connus, on n'affiche rien : un « 0 » par
  // défaut ferait croire à un compte vide.
  if (!user?.id || !me) return null;

  const credits = me.credits?.appgen ?? 0;
  const complimentary = me.subscriptions?.some((subscription) => subscription.complimentary);

  // Seuils absolus : une action premium coûte 3 crédits, un message 1. En
  // dessous de 5, il ne reste littéralement plus de quoi travailler.
  const tone =
    credits <= 5 ? 'text-danger' : credits <= 20 ? 'text-warning' : 'text-text-tertiary';

  return (
    <span
      className={`h-8 px-2.5 hidden lg:flex items-center gap-1.5 rounded-lg text-xs tabular-nums ${tone}`}
      title={`${credits} ${t('billing.credits')}`}
    >
      <Coins className="w-3.5 h-3.5" />
      {credits}
      {complimentary && <span className="text-[10px] text-accent">bêta</span>}
    </span>
  );
}

export default CreditsBadge;
