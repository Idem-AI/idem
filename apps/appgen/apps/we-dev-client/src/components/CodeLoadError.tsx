import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { LoadFailedIllustration } from '@/components/ui/Illustrations';

interface CodeLoadErrorProps {
  open: boolean;
  retrying?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Échec de récupération du code enregistré.
 *
 * Le succès ne se raconte pas : quand le code arrive, l'utilisateur le voit à
 * l'écran, un message de confirmation n'ajoute rien et parle d'un détail
 * d'implémentation (le stockage) dont il n'a pas à connaître l'existence.
 *
 * L'échec, lui, doit se dire — sinon l'espace de travail s'ouvre vide et rien
 * n'explique pourquoi — et doit surtout offrir la seule action utile :
 * réessayer.
 */
export function CodeLoadError({ open, retrying, onRetry, onDismiss }: CodeLoadErrorProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onDismiss}
      footer={null}
      width={440}
      centered
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
        <div className="grid place-items-center mb-4">
          <LoadFailedIllustration size={110} />
        </div>

        <h3 className="text-base font-semibold text-text-primary">{t('codeLoad.failedTitle')}</h3>
        <p className="mt-2 text-sm text-text-secondary text-pretty">{t('codeLoad.failedBody')}</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t('codeLoad.continue')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            loading={retrying}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {t('codeLoad.retry')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CodeLoadError;
