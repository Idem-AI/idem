import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, LogOut, Coins } from 'lucide-react';
import type { UserModel } from '../../api/persistence/userModel';
import useUserStore from '@/stores/userSlice';
import Popover from '@/components/ui/Popover';

interface UserProfileProps {
  user: UserModel;
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  promax: 'Pro Max',
  enterprise: 'Enterprise',
};

/**
 * Identité de l'utilisateur dans l'en-tête.
 *
 * Seule la photo est visible. Le nom, l'adresse et le plan étaient répétés dans
 * la barre *et* dans le menu ; la barre n'a que quelques centaines de pixels à
 * distribuer entre le nom du projet, le mode de travail et la publication, et
 * l'identité de la personne connectée est la dernière information dont elle a
 * besoin en permanence — elle sait qui elle est.
 */
export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const { t } = useTranslation();
  const { logout, user: storeUser } = useUserStore();

  const mainAppUrl = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';
  const displayName = user.displayName || user.email;

  const initials =
    displayName
      ?.split(/[\s@.]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  // Le plan vient du quota quand il est chargé (source vivante), sinon du
  // profil : les deux existent, et n'être d'accord qu'à moitié serait pire que
  // de n'en afficher qu'un.
  const tier = storeUser?.userQuota?.tierType ?? user.subscription;
  const planLabel = PLAN_LABEL[String(tier).toLowerCase()] ?? String(tier);
  const quota = storeUser?.userQuota;

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <Popover
      label={t('header.account')}
      className="w-64"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          title={displayName}
          aria-label={t('header.account')}
          className="w-8 h-8 rounded-full overflow-hidden shrink-0 grid place-items-center text-[11px] font-semibold text-white bg-primary ring-1 ring-[var(--glass-border)] hover:ring-primary transition-shadow"
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-4 py-3 border-b border-[var(--glass-border)]">
            <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
            <p className="text-xs text-text-tertiary truncate">{user.email}</p>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/12 text-primary text-[11px] font-medium">
                {t('header.plan', { plan: planLabel })}
              </span>
              {quota?.quotaTotal ? (
                <span className="flex items-center gap-1 text-[11px] text-text-tertiary tabular-nums">
                  <Coins className="w-3 h-3" />
                  {Math.max(0, quota.quotaTotal - (quota.usedQuota ?? 0))}
                </span>
              ) : null}
            </div>
          </div>

          <a
            href={`${mainAppUrl}/console`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            {t('header.idemDashboard')}
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('header.signOut')}
          </button>
        </div>
      )}
    </Popover>
  );
};

export default UserProfile;
