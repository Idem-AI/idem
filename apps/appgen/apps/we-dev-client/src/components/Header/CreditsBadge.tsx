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

  // Les modifications incluses d'abord (Pass Projet, pack, forfait) ; à défaut, le portefeuille,
  // qui paie chaque modification 25 F.
  const modifications = me.offer?.modifications ?? me.credits?.appgen ?? 0;
  const walletXaf = me.offer?.walletXaf ?? me.walletXaf ?? 0;
  const complimentary = me.subscriptions?.some((subscription) => subscription.complimentary);
  const showModifications = modifications > 0;

  const tone =
    !showModifications && walletXaf < 25 ? 'text-danger' : !showModifications && walletXaf < 250 ? 'text-warning' : 'text-text-tertiary';

  return (
    <span
      className={`h-8 px-2.5 hidden lg:flex items-center gap-1.5 rounded-lg text-xs tabular-nums ${tone}`}
      title={showModifications ? t('billing.modifications', { count: modifications }) : t('billing.wallet', { amount: walletXaf })}
    >
      <Coins className="w-3.5 h-3.5" />
      {showModifications ? t('billing.modificationsShort', { count: modifications }) : `${walletXaf} F`}
      {complimentary && <span className="text-[10px] text-accent">bêta</span>}
    </span>
  );
}

export default CreditsBadge;
