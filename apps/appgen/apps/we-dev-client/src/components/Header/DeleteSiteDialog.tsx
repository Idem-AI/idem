import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { IdemLoader } from '@idem/shared-loader/react';
import Button from '@/components/ui/Button';
import type { AppDeployment } from '@/api/persistence/db';
import { deleteSite, SiteDeletionError } from '@/utils/siteDeletion';
import { currentProduct } from '@/utils/product';

/**
 * « Supprimer le site » — trois temps, parce que rien ne se rattrape :
 *
 *   1. êtes-vous sûr ?          ce qui disparaît (le code, la conversation) et ce qui reste (le projet IDEM)
 *   2. le nom du projet         saisi à la main, à l'identique : pas de suppression par un clic distrait
 *   3. la mise en ligne aussi   l'adresse `monapp.idem.africa` et ses réglages DNS, l'application iDeploy ; un nom de
 *                               domaine acheté reste à l'utilisateur
 *
 * L'exécution est dans `utils/siteDeletion.ts` : la mise en ligne d'abord, puis le code ; une étape qui échoue
 * arrête les suivantes.
 */
type Step = 'confirm' | 'name' | 'deployment' | 'deleting';

export function DeleteSiteDialog({
  open,
  onClose,
  onDeleted,
  projectId,
  projectName,
  deployment,
  draftId,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  projectId: string;
  projectName: string;
  deployment: AppDeployment | null;
  draftId?: string | null;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('confirm');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const kind = currentProduct() === 'app' ? 'app' : 'site';
  // Le nom à recopier : celui du projet ; sans lui (projet illisible), le mot « supprimer ».
  const expected = projectName.trim() || t('header.deleteSite.fallbackWord');
  const matches = typed.trim() === expected;
  const host = (() => {
    try {
      return deployment?.url ? new URL(deployment.url).host : '';
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    if (!open) return;
    setStep('confirm');
    setTyped('');
    setError(null);
  }, [open]);

  const run = async () => {
    setStep('deleting');
    setError(null);
    try {
      await deleteSite(projectId, deployment, draftId);
      toast.success(t(`header.deleteSite.done.${kind}`));
      onDeleted();
      onClose();
    } catch (raw) {
      const failure = raw as SiteDeletionError & { step?: string };
      const reason =
        failure.step === 'busy'
          ? t('header.deleteSite.error.busy')
          : failure.step === 'deployment'
            ? failure.message === 'in_progress'
              ? t('header.deleteSite.error.inProgress')
              : t('header.deleteSite.error.deployment', { detail: failure.message })
            : t('header.deleteSite.error.code', { detail: failure.message });
      setError(reason);
      setStep('deployment');
    }
  };

  const close = () => {
    if (step !== 'deleting') onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      width={480}
      centered
      maskClosable={step !== 'deleting'}
      closable={step !== 'deleting'}
      styles={{
        content: { backgroundColor: 'var(--idem-surface-1)', padding: 0, borderRadius: 16, border: '1px solid var(--glass-border)' },
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div className="p-6">
        {step === 'confirm' && (
          <>
            <h3 className="text-lg font-semibold text-text-primary">{t(`header.deleteSite.confirm.title.${kind}`)}</h3>
            <p className="mt-2 text-sm text-text-secondary">{t(`header.deleteSite.confirm.body.${kind}`)}</p>
            <p className="mt-2 text-sm text-text-secondary">{t('header.deleteSite.confirm.kept')}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button variant="secondary" size="sm" className="!text-danger" onClick={() => setStep('name')}>
                {t('header.deleteSite.confirm.cta')}
              </Button>
            </div>
          </>
        )}

        {step === 'name' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (matches) setStep('deployment');
            }}
          >
            <h3 className="text-lg font-semibold text-text-primary">{t('header.deleteSite.name.title')}</h3>
            <label htmlFor="delete-site-name" className="mt-2 block text-sm text-text-secondary">
              {t('header.deleteSite.name.label')} <strong className="font-semibold text-text-primary select-all">{expected}</strong>
            </label>
            <input
              id="delete-site-name"
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={expected}
              className="mt-3 w-full"
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="secondary" size="sm" className="!text-danger" disabled={!matches}>
                {t('header.deleteSite.name.cta')}
              </Button>
            </div>
          </form>
        )}

        {step === 'deployment' && (
          <>
            <h3 className="text-lg font-semibold text-text-primary">
              {deployment ? t('header.deleteSite.deployment.title') : t(`header.deleteSite.deployment.none.title.${kind}`)}
            </h3>
            {deployment ? (
              <>
                <p className="mt-2 text-sm text-text-secondary">{t(`header.deleteSite.deployment.body.${kind}`)}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-text-secondary list-disc pl-5">
                  {host && (
                    <li>
                      {t('header.deleteSite.deployment.address')} <strong className="font-semibold text-text-primary">{host}</strong>
                    </li>
                  )}
                  <li>{t('header.deleteSite.deployment.dns')}</li>
                  <li>{t(`header.deleteSite.deployment.ideploy.${deployment.ideploy?.mode === 'fullstack' ? 'fullstack' : 'static'}`)}</li>
                  <li>{t('header.deleteSite.deployment.domain')}</li>
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">{t(`header.deleteSite.deployment.none.body.${kind}`)}</p>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-danger/12 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button variant="secondary" size="sm" className="!text-danger" onClick={run}>
                {error ? t('header.deleteSite.retry') : t('header.deleteSite.final')}
              </Button>
            </div>
          </>
        )}

        {step === 'deleting' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center" aria-live="polite">
            <IdemLoader size="md" />
            <p className="text-sm text-text-secondary">{t(deployment ? 'header.deleteSite.deleting.withDeployment' : 'header.deleteSite.deleting.code')}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
