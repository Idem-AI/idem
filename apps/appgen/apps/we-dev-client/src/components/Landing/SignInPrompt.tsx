import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SignInIllustration } from '@/components/ui/Illustrations';

interface SignInPromptProps {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
  /** La demande déjà saisie, rappelée pour montrer qu'elle n'est pas perdue. */
  prompt?: string;
}

/**
 * Demande de connexion avant génération.
 *
 * Auparavant, cliquer sur « Générer » sans compte redirigeait immédiatement
 * vers la page de connexion : la phrase qu'on venait d'écrire disparaissait de
 * l'écran sans explication, et rien ne disait qu'elle était conservée.
 *
 * La modale rend la redirection volontaire, et surtout elle **montre la demande
 * saisie** — c'est la seule preuve que le travail n'est pas perdu.
 */
export function SignInPrompt({ open, onClose, onSignIn, prompt }: SignInPromptProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      centered
      destroyOnClose
      styles={{
        content: {
          backgroundColor: 'var(--idem-surface-1)',
          padding: 0,
          borderRadius: 16,
          border: '1px solid var(--glass-border)',
        },
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div className="p-6 text-center">
        <div className="grid place-items-center mb-5">
          <SignInIllustration size={112} />
        </div>

        <h3 className="text-lg font-semibold text-text-primary text-balance">
          {t('signIn.title')}
        </h3>
        <p className="mt-2 text-sm text-text-secondary text-pretty">{t('signIn.body')}</p>

        {prompt && (
          <figure className="mt-4 px-3.5 py-3 rounded-xl border border-[var(--glass-border)] bg-surface-2 text-left">
            <figcaption className="text-[11px] uppercase tracking-wide text-text-disabled">
              {t('signIn.savedPrompt')}
            </figcaption>
            <blockquote className="mt-1 text-sm text-text-secondary line-clamp-3">
              {prompt}
            </blockquote>
          </figure>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('signIn.later')}
          </Button>
          <Button variant="primary" size="sm" onClick={onSignIn}>
            {t('signIn.cta')}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="mt-4 text-xs text-text-disabled">{t('signIn.free')}</p>
      </div>
    </Modal>
  );
}

export default SignInPrompt;
