import { useCallback, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Copy, ExternalLink, Loader2, RotateCcw, Wand2, X } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { PublishQuickIllustration } from '@/components/ui/Illustrations';
import { useFileStore } from '@/components/WeIde/stores/fileStore';
import { redirectToLogin } from '@/hooks/useAuth';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';
import type { AppDeployment } from '@/api/persistence/db';
import {
  PublishError,
  buildStaticSite,
  collectSourceFiles,
  detectPublishMode,
  publishToIdeploy,
  toDeploymentRecord,
  waitForDeployment,
  type PublishMode,
} from '@/utils/ideployPublish';

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  /** Le site déjà publié, s'il y en a un : la publication le met à jour, à la même adresse. */
  deployment: AppDeployment | null;
  /** Nom proposé pour l'application (celui du projet). */
  defaultName: string;
  onPublished: (deployment: AppDeployment) => void | Promise<void>;
}

const IDEPLOY_URL = process.env.REACT_APP_IDEPLOY_URL || 'http://localhost:4202';

type StepId = 'prepare' | 'send' | 'live' | 'database' | 'server' | 'interface';
type StepState = 'pending' | 'active' | 'done' | 'failed';
type Phase = 'ready' | 'working' | 'done' | 'error';

const STEPS: Record<PublishMode, StepId[]> = {
  static: ['prepare', 'send', 'live'],
  fullstack: ['prepare', 'database', 'server', 'interface'],
};

/**
 * Mettre en ligne depuis iCode, par iDeploy, sans le quitter.
 *
 * Pensé pour qui ne sait pas ce qu'est un serveur : un bouton, des étapes dites
 * avec des mots simples, une adresse à la fin. Ce qui est technique (ce qui est
 * créé, l'adresse de l'API, la gestion dans iDeploy) vit dans « Options
 * avancées », replié.
 */
export function DeployModal({ open, onClose, deployment, defaultName, onPublished }: DeployModalProps) {
  const { t } = useTranslation();
  const files = useFileStore((state) => state.files);
  const mode = useMemo(() => detectPublishMode(files as Record<string, string>), [files]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [steps, setSteps] = useState<Record<StepId, StepState>>({} as Record<StepId, StepState>);
  const [error, setError] = useState<PublishError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [copied, setCopied] = useState(false);

  const existing = deployment?.provider === 'ideploy' ? deployment.ideploy ?? null : null;
  const liveUrl = deployment?.url || null;

  const mark = (id: StepId, state: StepState) => setSteps((current) => ({ ...current, [id]: state }));

  const publish = useCallback(async () => {
    setPhase('working');
    setError(null);
    setShowDetails(false);
    setSteps(Object.fromEntries(STEPS[mode].map((id) => [id, 'pending'])) as Record<StepId, StepState>);
    let current: StepId = 'prepare';

    try {
      mark('prepare', 'active');
      const payload = mode === 'fullstack' ? collectSourceFiles() : await buildStaticSite();
      mark('prepare', 'done');

      current = mode === 'fullstack' ? 'database' : 'send';
      mark(current, 'active');
      const result = await publishToIdeploy({ name: name.trim() || defaultName, mode, files: payload, existing });

      if (mode === 'static') {
        mark('send', 'done');
        current = 'live';
        mark('live', 'active');
        const { status, log } = await waitForDeployment(result.deployments[0].deploymentUuid);
        if (status !== 'finished') throw new PublishError('deploy_failed', undefined, 'deploy', log);
        mark('live', 'done');
      } else {
        // La base est créée et démarrée par iDeploy avant même la réponse.
        mark('database', 'done');
        const backend = result.deployments.find((d) => d.role === 'backend')!;
        const frontend = result.deployments.find((d) => d.role === 'frontend')!;
        current = 'server';
        mark('server', 'active');
        mark('interface', 'active');
        const [server, ui] = await Promise.all([
          waitForDeployment(backend.deploymentUuid).then((r) => {
            mark('server', r.status === 'finished' ? 'done' : 'failed');
            return r;
          }),
          waitForDeployment(frontend.deploymentUuid).then((r) => {
            mark('interface', r.status === 'finished' ? 'done' : 'failed');
            return r;
          }),
        ]);
        if (server.status !== 'finished') throw new PublishError('deploy_failed', undefined, 'server', server.log);
        if (ui.status !== 'finished') throw new PublishError('deploy_failed', undefined, 'interface', ui.log);
      }

      const record = toDeploymentRecord(result, name.trim() || defaultName);
      await onPublished(record);
      setPhase('done');
    } catch (raw) {
      const failure = raw instanceof PublishError ? raw : new PublishError((raw as Error)?.message || 'publish_failed');
      mark(current, 'failed');
      setError(failure);
      setPhase('error');
    }
  }, [mode, name, defaultName, existing, onPublished]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé : l'adresse reste affichée */
    }
  };

  const fixBuild = () => {
    if (!error?.details) return;
    eventEmitter.emit(
      'chat:fixError',
      [t('preview.fix.prompt', { summary: t('deployModal.errors.build') }), '', '```', error.details, '```'].join('\n')
    );
    onClose();
  };

  const errorMessage = (failure: PublishError): string => {
    if (failure.status === 401) return t('deployModal.errors.login');
    if (failure.message === 'build_failed') return t('deployModal.errors.build');
    if (failure.message === 'preview_unavailable') return t('deployModal.errors.preview');
    if (failure.message === 'deploy_failed') return t(`deployModal.errors.deploy_${failure.code ?? 'deploy'}`);
    if (failure.status && failure.status < 500 && failure.message) return failure.message;
    return t('deployModal.errors.generic');
  };

  const manageUrl = existing
    ? `${IDEPLOY_URL}/applications/${existing.applicationUuid ?? existing.frontendUuid}`
    : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
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
      <div className="p-6">
        <header className="flex items-start gap-4">
          <PublishQuickIllustration size={72} />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-text-primary">
              {t(phase === 'done' ? 'deployModal.done.title' : liveUrl ? 'deployModal.update.title' : 'deployModal.publish.title')}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t(phase === 'done' ? 'deployModal.done.body' : `deployModal.lead.${mode}`)}
            </p>
          </div>
        </header>

        {/* L'adresse : celle d'avant pendant qu'on prépare, la nouvelle à la fin. */}
        {(phase === 'done' || (phase === 'ready' && liveUrl)) && (phase === 'done' ? deployment?.url : liveUrl) && (
          <UrlField
            url={(phase === 'done' ? deployment?.url : liveUrl) as string}
            copied={copied}
            onCopy={copy}
            label={t('deployModal.live')}
            openLabel={t('deployModal.open')}
            copyLabel={copied ? t('header.copied_link') : t('header.copy')}
          />
        )}

        {(phase === 'working' || phase === 'error') && (
          <ol className="mt-5 grid gap-2.5" aria-live="polite">
            {STEPS[mode].map((id) => (
              <li key={id} className="flex items-start gap-3">
                <StepIcon state={steps[id] ?? 'pending'} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${steps[id] === 'pending' ? 'text-text-tertiary' : 'text-text-primary'}`}>
                    {t(`deployModal.steps.${id}.title`)}
                  </p>
                  {steps[id] === 'active' && (
                    <p className="text-xs text-text-tertiary">{t(`deployModal.steps.${id}.hint`)}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {phase === 'working' && <p className="mt-4 text-xs text-text-tertiary">{t('deployModal.working_note')}</p>}

        {phase === 'error' && error && (
          <section role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/[0.07] p-4">
            <p className="text-sm font-medium text-text-primary">{errorMessage(error)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {error.status === 401 ? (
                <Button variant="primary" size="sm" onClick={() => redirectToLogin('deploy')}>
                  {t('deployModal.login')}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={publish} icon={<RotateCcw className="w-4 h-4" />}>
                  {t('deployModal.retry')}
                </Button>
              )}
              {error.message === 'build_failed' && error.details && (
                <Button variant="secondary" size="sm" onClick={fixBuild} icon={<Wand2 className="w-4 h-4" />}>
                  {t('preview.fix.cta')}
                </Button>
              )}
              {error.details && (
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary"
                  aria-expanded={showDetails}
                >
                  {t(showDetails ? 'preview.fix.hideDetails' : 'preview.fix.details')}
                </button>
              )}
            </div>
            {showDetails && error.details && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-surface-2 p-2 text-[11px] text-text-secondary whitespace-pre-wrap break-words" data-mono>
                {error.details}
              </pre>
            )}
          </section>
        )}

        {phase === 'ready' && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('deployModal.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={publish}>
              {t(liveUrl ? 'deployModal.update.cta' : 'deployModal.publish.cta')}
            </Button>
          </div>
        )}

        {phase === 'done' && (
          <div className="mt-6 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setPhase('ready'); onClose(); }}>
              {t('deployModal.close')}
            </Button>
          </div>
        )}

        {/* Ce qui est technique, replié : l'utilisateur veut mettre en ligne, pas configurer. */}
        {(phase === 'ready' || phase === 'done') && (
          <section className="mt-5 border-t border-[var(--glass-border)] pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              {t('deployModal.advanced.title')}
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen && (
              <div className="mt-3 grid gap-3 text-xs text-text-secondary">
                <label className="grid gap-1">
                  <span className="font-medium text-text-primary">{t('deployModal.advanced.name')}</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={Boolean(existing)}
                    className="h-8 rounded-md border border-[var(--glass-border)] bg-surface-2 px-2 text-sm text-text-primary disabled:opacity-60"
                  />
                  {existing && <span className="text-text-tertiary">{t('deployModal.advanced.name_locked')}</span>}
                </label>
                <p>
                  <span className="font-medium text-text-primary">{t('deployModal.advanced.what')} </span>
                  {t(`deployModal.advanced.what_${mode}`)}
                </p>
                {existing?.apiUrl && (
                  <p className="break-all">
                    <span className="font-medium text-text-primary">{t('deployModal.advanced.api')} </span>
                    {existing.apiUrl}
                  </p>
                )}
                {manageUrl && (
                  <ButtonLink
                    variant="ghost"
                    size="sm"
                    href={manageUrl}
                    target="_blank"
                    rel="noreferrer"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    className="justify-self-start"
                  >
                    {t('deployModal.advanced.manage')}
                  </ButtonLink>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-white">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500 text-white">
        <X className="h-3 w-3" />
      </span>
    );
  }
  if (state === 'active') {
    return <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />;
  }
  return <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-[var(--glass-border)]" aria-hidden />;
}

function UrlField({
  url,
  copied,
  onCopy,
  label,
  openLabel,
  copyLabel,
}: {
  url: string;
  copied: boolean;
  onCopy: (url: string) => void;
  label: string;
  openLabel: string;
  copyLabel: string;
}) {
  return (
    <section className="mt-5 rounded-xl border border-success/30 bg-success/8 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
        <span className="text-xs font-medium text-success">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <code
          className="flex h-9 min-w-0 flex-1 items-center truncate rounded-lg border border-[var(--glass-border)] bg-surface-2 px-3 text-xs text-text-secondary"
          data-mono
          title={url}
        >
          {url.replace(/^https?:\/\//, '')}
        </code>
        <Button
          variant="icon"
          onClick={() => onCopy(url)}
          title={copyLabel}
          aria-label={copyLabel}
          icon={copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        />
        <ButtonLink
          variant="secondary"
          size="sm"
          href={url}
          target="_blank"
          rel="noreferrer"
          icon={<ExternalLink className="h-4 w-4" />}
        >
          {openLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
