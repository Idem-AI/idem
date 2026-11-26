import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Copy, ExternalLink, RotateCcw, Wand2, X } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { PublishQuickIllustration } from '@/components/ui/Illustrations';
import { useFileStore } from '@/components/WeIde/stores/fileStore';
import { redirectToLogin } from '@/hooks/useAuth';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';
import type { AppDeployment } from '@/api/persistence/db';
import {
  PublishError,
  buildStaticSite,
  prepareStaticSite,
  getAddressState,
  waitForAddress,
  type AddressState,
  readBuildReport,
  type BuildReport,
  collectSourceFiles,
  detectPublishMode,
  fetchPublishedManifest,
  publishToIdeploy,
  reserveAddress,
  takeReservation,
  toDeploymentRecord,
  waitForDeployment,
  type PublishMode,
} from '@/utils/ideployPublish';
import { IdemLoader } from '@idem/shared-loader/react';
import { idomainText, useDomainConnections } from '@idem/shared-idomain/react';
import { ChoiceList } from '@/components/ui/ChoiceList';
import { OwnDomainSetup } from './OwnDomainSetup';

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  /** Le site déjà publié, s'il y en a un : la publication le met à jour, à la même adresse. */
  deployment: AppDeployment | null;
  /** Nom proposé pour l'application (celui du projet). */
  defaultName: string;
  onPublished: (deployment: AppDeployment) => void | Promise<void>;
  /** Ouverte pour choisir un nom de domaine : l'achat s'ouvre dès que l'application est en ligne. */
  openDomain?: boolean;
}

const IDEPLOY_URL = process.env.REACT_APP_IDEPLOY_URL || 'http://localhost:4202';
/** iDomain : un nom à soi, acheté et branché sans quitter iCode. */
const IDOMAIN_API_URL = process.env.REACT_APP_IDOMAIN_API_URL || 'http://localhost:3007';

type StepId = 'prepare' | 'send' | 'live' | 'database' | 'server' | 'interface' | 'secure';
type StepState = 'pending' | 'active' | 'done' | 'failed';
type Phase = 'ready' | 'working' | 'done' | 'error';

const STEPS: Record<PublishMode, StepId[]> = {
  static: ['prepare', 'send', 'live', 'secure'],
  fullstack: ['prepare', 'database', 'server', 'interface', 'secure'],
};

/** Ce qu'on attend au plus de l'adresse sécurisée avant de rendre la main (elle continue d'être suivie). */
const ADDRESS_WAIT_MS = 45_000;

/** Après la mise en ligne : l'utilisateur a-t-il un nom à lui ? */
type DomainChoice = 'ask' | 'connect' | 'buy' | 'later';

/**
 * Mettre en ligne depuis iCode, par iDeploy, sans le quitter.
 *
 * Pensé pour qui ne sait pas ce qu'est un serveur : un bouton, des étapes dites
 * avec des mots simples, une adresse à la fin. Ce qui est technique (ce qui est
 * créé, l'adresse de l'API, la gestion dans iDeploy) vit dans « Options
 * avancées », replié.
 */
export function DeployModal({ open, onClose, deployment, defaultName, onPublished, openDomain = false }: DeployModalProps) {
  const { t, i18n } = useTranslation();
  const files = useFileStore((state) => state.files);
  const mode = useMemo(() => detectPublishMode(files as Record<string, string>), [files]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [steps, setSteps] = useState<Record<StepId, StepState>>({} as Record<StepId, StepState>);
  const [error, setError] = useState<PublishError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  // Le nom proposé arrive souvent après l'ouverture (nom du projet IDEM chargé à part) : il remplace
  // la valeur de départ tant que l'utilisateur n'a pas écrit le sien.
  const nameEdited = useRef(false);
  useEffect(() => {
    if (!nameEdited.current) setName(defaultName);
  }, [defaultName]);
  const [copied, setCopied] = useState(false);
  // Ce que le contrôle du site construit a relevé (référencement) : montré sans bloquer la mise en ligne.
  const [buildReport, setBuildReport] = useState<BuildReport | null>(null);

  const existing = deployment?.provider === 'ideploy' ? deployment.ideploy ?? null : null;
  const liveUrl = deployment?.url || null;
  // L'application iDeploy qui répond au public : le site, ou l'interface d'une application complète.
  const publicAppUuid = existing?.applicationUuid ?? existing?.frontendUuid ?? null;
  const lang = (i18n.language || 'fr').slice(0, 2);
  // Déjà en ligne : la mise à jour est la seule action ; le nom de domaine reste à un clic, sans question.
  const [domainChoice, setDomainChoice] = useState<DomainChoice>(liveUrl ? 'later' : 'ask');
  const [resumeHosts, setResumeHosts] = useState<string[] | undefined>(undefined);
  const [domainsVersion, setDomainsVersion] = useState(0);
  // « /domaine » ou la carte « Votre propre nom » : la question s'ouvre aussitôt, si l'application est déjà en ligne
  // (sinon la fenêtre propose d'abord la mise en ligne, sans laquelle un nom ne mène nulle part).
  useEffect(() => {
    if (open && openDomain && publicAppUuid) setDomainChoice('ask');
  }, [open, openDomain, publicAppUuid]);
  const ownDomains = useDomainConnections(IDOMAIN_API_URL, publicAppUuid, domainsVersion);

  // L'adresse publique : elle peut répondre en HTTPS quelques instants après la fin du déploiement
  // (le nom vient d'être publié dans le DNS). Tant qu'elle ne répond pas, l'adresse automatique,
  // qui marche déjà, est proposée — jamais un lien qui ouvrirait une erreur du navigateur.
  const [address, setAddress] = useState<AddressState | null>(null);
  const addressWatch = useRef<{ cancelled: boolean } | null>(null);
  useEffect(() => () => {
    if (addressWatch.current) addressWatch.current.cancelled = true;
  }, []);
  useEffect(() => {
    if (!open || phase !== 'done' || address?.ready !== false || !publicAppUuid) return;
    const timer = setInterval(() => {
      void getAddressState(publicAppUuid).then((next) => next && setAddress(next));
    }, 5000);
    return () => clearInterval(timer);
  }, [open, phase, address?.ready, publicAppUuid]);

  // À chaque ouverture : déjà en ligne → pas de question, la mise à jour d'abord.
  useEffect(() => {
    if (!open || phase !== 'ready') return;
    setResumeHosts(undefined);
    // « /domaine » ouvre la question même sur une application en ligne.
    setDomainChoice(liveUrl && !openDomain ? 'later' : 'ask');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ouverte sur une application déjà en ligne : ses noms (gratuit, et ceux de l'utilisateur) et leur état.
  useEffect(() => {
    if (!open || !publicAppUuid || phase !== 'ready') return;
    let alive = true;
    void getAddressState(publicAppUuid).then((state) => alive && state && setAddress(state));
    return () => {
      alive = false;
    };
  }, [open, publicAppUuid, phase, domainsVersion]);

  // Le site se construit dès l'ouverture de la fenêtre : le temps de lire et de cliquer, il est souvent prêt.
  // La même construction est reprise par la publication (rien n'est construit deux fois).
  useEffect(() => {
    if (open && phase === 'ready' && mode === 'static') prepareStaticSite().catch(() => undefined);
  }, [open, phase, mode]);

  // Première mise en ligne d'un site : l'adresse est réservée dès que le nom proposé est posé (2 s sans changement).
  // iDeploy crée le nom et obtient le certificat pendant que l'utilisateur lit et que le site se construit ; sans
  // cela, le clic attendait le DNS (jusqu'à 90 s) puis le certificat. Le nom tapé à la main n'est pas réservé :
  // chaque frappe créerait une adresse.
  const reservedName = useRef<string | null>(null);
  useEffect(() => {
    if (!open || phase !== 'ready' || mode !== 'static' || existing || nameEdited.current || reservedName.current) return;
    const proposed = defaultName.trim();
    if (!proposed) return;
    const timer = setTimeout(() => {
      reservedName.current = proposed;
      void reserveAddress(proposed);
    }, 2000);
    return () => clearTimeout(timer);
  }, [open, phase, mode, existing, defaultName]);

  const mark = (id: StepId, state: StepState) => setSteps((current) => ({ ...current, [id]: state }));

  const publish = useCallback(async () => {
    const wasLive = Boolean(liveUrl);
    setPhase('working');
    setError(null);
    setShowDetails(false);
    setBuildReport(null);
    setSteps(Object.fromEntries(STEPS[mode].map((id) => [id, 'pending'])) as Record<StepId, StepState>);
    let current: StepId = 'prepare';

    try {
      mark('prepare', 'active');
      const finalName = name.trim() || defaultName;
      // L'adresse réservée à l'ouverture, si le nom n'a pas changé ; sinon elle est rendue tout de suite.
      const reservation = mode === 'static' && !existing && reservedName.current ? await takeReservation(reservedName.current) : null;
      const reserved = reservation && reservation.name === finalName.trim().toLowerCase() ? reservation : null;
      if (reservation && !reserved) {
        void fetch(`${process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000'}/api/ideploy/site/delete`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ideploy: { applicationUuid: reservation.applicationUuid } }),
        }).catch(() => undefined);
      }
      reservedName.current = null;
      const target = existing ?? (reserved ? { mode: 'static' as const, applicationUuid: reserved.applicationUuid } : null);
      // Ce que la version en ligne contient déjà, lu pendant la construction : seuls les fichiers changés partiront.
      const publishedManifest =
        mode === 'static' && target?.applicationUuid && !reserved ? fetchPublishedManifest(target.applicationUuid) : Promise.resolve(null);
      const payload = mode === 'fullstack' ? collectSourceFiles() : await buildStaticSite();
      if (mode === 'static') setBuildReport(await readBuildReport());
      mark('prepare', 'done');

      current = mode === 'fullstack' ? 'database' : 'send';
      mark(current, 'active');
      const result = await publishToIdeploy({
        name: finalName,
        mode,
        files: payload,
        existing: target,
        publishedManifest: await publishedManifest,
      });

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

      // L'adresse sécurisée : attendue un moment, puis suivie en arrière-plan si elle tarde.
      const publicUuid = result.ids.applicationUuid ?? result.ids.frontendUuid ?? null;
      current = 'secure';
      mark('secure', 'active');
      if (publicUuid) {
        if (addressWatch.current) addressWatch.current.cancelled = true;
        const watch = { cancelled: false };
        addressWatch.current = watch;
        const state = await waitForAddress(publicUuid, ADDRESS_WAIT_MS, watch);
        setAddress(state ?? { url: result.url, ready: false, fallbackUrl: null, domains: [] });
      }
      mark('secure', 'done');
      // La question n'est posée qu'après la première mise en ligne.
      setDomainChoice(wasLive ? 'later' : 'ask');
      setPhase('done');
    } catch (raw) {
      const failure = raw instanceof PublishError ? raw : new PublishError((raw as Error)?.message || 'publish_failed');
      mark(current, 'failed');
      setError(failure);
      setPhase('error');
    }
  }, [mode, name, defaultName, existing, onPublished, liveUrl]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé : l'adresse reste affichée */
    }
  };

  /** Les défauts de référencement du site en ligne, envoyés au chat pour correction. */
  const fixSeo = () => {
    if (!buildReport?.errors.length) return;
    eventEmitter.emit(
      'chat:fixError',
      [t('preview.fix.prompt', { summary: t('deployModal.seo.summary') }), '', ...buildReport.errors.map((line) => `- ${line}`)].join('\n')
    );
    onClose();
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

  // Fini, mais l'adresse principale ne répond pas encore en HTTPS : on montre celle qui marche.
  const addressPending = phase === 'done' && address !== null && !address.ready;
  const shownUrl =
    phase === 'done'
      ? addressPending
        ? address?.fallbackUrl ?? null
        : address?.url ?? deployment?.url ?? null
      : liveUrl;

  /** Les noms à l'utilisateur (pas les adresses gratuites d'iDeploy), un par domaine (www regroupé). */
  const customDomains = (address?.domains ?? []).filter((d) => d.status !== 'automatic' && !d.host.startsWith('www.'));

  /** Le réglage d'un nom de domaine occupe toute la fenêtre : une seule tâche à l'écran. */
  const settingDomain = domainChoice === 'connect' && Boolean(publicAppUuid) && (phase === 'ready' || phase === 'done');

  const manageUrl = existing
    ? `${IDEPLOY_URL}/applications/${existing.applicationUuid ?? existing.frontendUuid}`
    : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={settingDomain ? 880 : 560}
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
        {settingDomain ? (
          <header className="pr-8">
            <h3 className="text-lg font-semibold text-text-primary">{t('deployModal.ownDomain.title')}</h3>
          </header>
        ) : (
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
        )}

        {/* L'adresse : celle d'avant pendant qu'on prépare, la nouvelle à la fin. */}
        {!settingDomain && (phase === 'done' || (phase === 'ready' && liveUrl)) && shownUrl && (
          <UrlField
            url={shownUrl}
            copied={copied}
            onCopy={copy}
            label={addressPending ? t('deployModal.address.temporary') : t('deployModal.live')}
            openLabel={t('deployModal.open')}
            copyLabel={copied ? t('header.copied_link') : t('header.copy')}
          />
        )}
        {!settingDomain && addressPending && address?.url && (
          <p className="mt-2 flex items-start gap-2 text-xs text-text-secondary" role="status">
            <IdemLoader size="xs" className="mt-0.5 shrink-0" />
            <span>{t('deployModal.address.pending', { url: address.url.replace(/^https?:\/\//, '') })}</span>
          </p>
        )}

        {/* Un nom à soi. Après la 1re mise en ligne : la question. Ensuite : ses noms, ou un lien discret. */}
        {(phase === 'done' || (phase === 'ready' && liveUrl)) && publicAppUuid && (
          <section className={settingDomain ? 'mt-4' : 'mt-4 border-t border-[var(--glass-border-subtle)] pt-4'}>
            {domainChoice !== 'connect' && (customDomains.length > 0 || ownDomains.length > 0) ? (
              // Ses noms à lui, et où ils en sont ; un nom pas encore en ligne rouvre ses réglages.
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-text-primary">{t('deployModal.domain.yours')}</p>
                <ul className="grid gap-1.5 text-sm">
                  {customDomains.map((d) => {
                    const live = d.https === 'valid';
                    return (
                      <li key={d.host} className="flex flex-wrap items-center gap-2">
                        <span className={`status-dot ${live ? 'bg-success' : 'bg-[var(--color-text-tertiary)]'}`} aria-hidden />
                        <a href={`https://${d.host}`} target="_blank" rel="noreferrer" className="font-medium text-text-primary hover:underline">{d.host}</a>
                        <span className="text-xs text-text-tertiary">{t(live ? 'deployModal.ownDomain.status.live' : 'deployModal.ownDomain.status.waiting')}</span>
                        {!live && (
                          <button
                            type="button"
                            onClick={() => {
                              const www = `www.${d.host}`;
                              setResumeHosts([d.host, ...((address?.domains ?? []).some((x) => x.host === www) ? [www] : [])]);
                              setDomainChoice('connect');
                            }}
                            className="button-ghost button-sm !px-2"
                          >
                            {t('deployModal.domain.showSettings')}
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {ownDomains
                    .filter((c) => !customDomains.some((d) => d.host === c.host))
                    .map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-2">
                        <span className={`status-dot ${c.status === 'active' ? 'bg-success' : 'bg-[var(--color-text-tertiary)]'}`} aria-hidden />
                        <a href={`https://${c.host}`} target="_blank" rel="noreferrer" className="font-medium text-text-primary hover:underline">{c.host}</a>
                        <span className="text-xs text-text-tertiary">
                          {idomainText(lang, `manage.status.${c.status === 'active' ? 'active' : c.status === 'failed' ? 'failed' : 'pending'}`)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : domainChoice === 'later' ? (
              <button type="button" onClick={() => setDomainChoice('ask')} className="button-ghost button-sm !px-2">
                {t('deployModal.domain.add')}
              </button>
            ) : domainChoice === 'connect' ? (
              <OwnDomainSetup
                key={(resumeHosts ?? []).join(',') || 'new'}
                resumeHosts={resumeHosts}
                appUuid={publicAppUuid}
                idomainApiUrl={IDOMAIN_API_URL}
                lang={lang}
                onCancel={() => {
                  setResumeHosts(undefined);
                  setDomainChoice(resumeHosts ? 'later' : 'ask');
                }}
                onDone={() => {
                  setResumeHosts(undefined);
                  setDomainChoice('later');
                  setDomainsVersion((v) => v + 1);
                }}
              />
            ) : domainChoice === 'buy' ? (
              <div className="grid gap-2" role="status">
                <p className="text-sm font-semibold text-text-primary">{t('deployModal.domain.soonTitle')}</p>
                <p className="text-xs text-text-secondary">{t('deployModal.domain.soonBody')}</p>
                <button type="button" onClick={() => setDomainChoice('ask')} className="button-ghost button-sm justify-self-start !px-2">
                  {t('deployModal.ownDomain.back')}
                </button>
              </div>
            ) : (
              <>
                <ChoiceList
                  question={t('deployModal.domain.question')}
                  help={t('deployModal.domain.lead')}
                  choices={[
                    { value: 'connect', label: t('deployModal.domain.yes'), description: t('deployModal.domain.yesHint') },
                    { value: 'buy', label: t('deployModal.domain.buy'), description: t('deployModal.domain.buyHint') },
                    { value: 'later', label: t('deployModal.domain.later') },
                  ]}
                  onChoose={(value) => setDomainChoice(value as DomainChoice)}
                />
              </>
            )}
          </section>
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

        {phase === 'ready' && !settingDomain && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('deployModal.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={publish}>
              {t(liveUrl ? 'deployModal.update.cta' : 'deployModal.publish.cta')}
            </Button>
          </div>
        )}

        {phase === 'done' && !settingDomain && buildReport && buildReport.errors.length > 0 && (
          <section role="status" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
            <p className="text-sm font-medium text-text-primary">{t('deployModal.seo.title', { count: buildReport.errors.length })}</p>
            <p className="mt-1 text-xs text-text-secondary">{t('deployModal.seo.body')}</p>
            <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
              {buildReport.errors.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={fixSeo} icon={<Wand2 className="w-4 h-4" />}>
                {t('preview.fix.cta')}
              </Button>
            </div>
          </section>
        )}

        {phase === 'done' && !settingDomain && (
          <div className="mt-6 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => { setPhase('ready'); onClose(); }}>
              {t('deployModal.close')}
            </Button>
          </div>
        )}

        {/* Ce qui est technique, replié : l'utilisateur veut mettre en ligne, pas configurer. */}
        {(phase === 'ready' || phase === 'done') && !settingDomain && (
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
                    onChange={(e) => { nameEdited.current = true; setName(e.target.value); }}
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
    return <IdemLoader size="sm" className="mt-0.5 shrink-0" />;
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
