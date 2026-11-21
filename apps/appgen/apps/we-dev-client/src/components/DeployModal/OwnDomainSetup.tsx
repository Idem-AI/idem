import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ChoiceList } from '@/components/ui/ChoiceList';
import { IdemLoader } from '@idem/shared-loader/react';
import { createIdomainClient, type Connection } from '@idem/shared-idomain';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';

/** Les fournisseurs du guide d'iDeploy (onglet « Nom de domaine »), avec leur page DNS. */
const PROVIDERS: { id: string; name: string; url: string | null }[] = [
  { id: 'godaddy', name: 'GoDaddy', url: 'https://dcc.godaddy.com/control/portfolio' },
  { id: 'namecheap', name: 'Namecheap', url: 'https://ap.www.namecheap.com/domains/list/' },
  { id: 'ovh', name: 'OVHcloud', url: 'https://www.ovh.com/manager/#/web/domain' },
  { id: 'hostinger', name: 'Hostinger', url: 'https://hpanel.hostinger.com/domains' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'https://dash.cloudflare.com' },
  { id: 'lws', name: 'LWS', url: 'https://panel.lws.fr' },
  { id: 'squarespace', name: 'Squarespace', url: 'https://account.squarespace.com/domains' },
  { id: 'other', name: '', url: null },
];

const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const POLL_MS = 10_000;

function bareHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
}

interface DomainCheck {
  host: string;
  status: string;
  record: { type: string; name: string; value: string; zone: string } | null;
  https: { status: string };
}

type Step = 'host' | 'source' | 'records' | 'idomain';

/**
 * « Oui, j'ai un nom de domaine » : le nom, puis où il a été acheté.
 *   - chez iDomain : iDomain le relie tout seul (rien à régler) ;
 *   - ailleurs : le nom est ajouté à l'application comme dans l'onglet « Nom de domaine »
 *     d'iDeploy, et la page montre le réglage à faire chez le fournisseur, en trois étapes.
 * Tout passe par les API d'iDeploy et d'iDomain : leurs règles restent les leurs.
 */
export function OwnDomainSetup({
  appUuid,
  idomainApiUrl,
  lang,
  onDone,
  onCancel,
  resumeHosts,
}: {
  /** Des noms déjà ajoutés à l'application : la fenêtre rouvre directement leurs réglages. */
  resumeHosts?: string[];
  appUuid: string;
  idomainApiUrl: string;
  lang: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(resumeHosts?.length ? 'records' : 'host');
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyChoice, setBusyChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>(resumeHosts ?? []);
  const [checks, setChecks] = useState<DomainCheck[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const idomain = useRef(createIdomainClient(idomainApiUrl, () => lang)).current;

  const domain = bareHost(host);

  const submitHost = (e: FormEvent) => {
    e.preventDefault();
    if (!HOSTNAME.test(domain)) {
      setError(t('deployModal.ownDomain.invalid'));
      return;
    }
    setError(null);
    setStep('source');
  };

  /** Ailleurs : ajouté à l'application par iDeploy, puis son guide DNS. */
  const chooseOther = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ideploy/applications/${encodeURIComponent(appUuid)}/domains`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: domain }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setError(data?.message && data.message !== 'invalid_domain' ? data.message : t('deployModal.ownDomain.saveError'));
        return;
      }
      setHosts(data.hosts ?? [domain]);
      setStep('records');
    } catch {
      setError(t('deployModal.ownDomain.saveError'));
    } finally {
      setBusy(false);
    }
  };

  /** Chez iDomain : relié par iDomain, sans réglage. Un nom qui n'y est pas ne passe pas par là. */
  const chooseIdomain = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await idomain.connect({ host: domain, appUuid });
      if (created.method !== 'managed') {
        await idomain.detach(created.id).catch(() => undefined);
        setError(t('deployModal.ownDomain.notInIdomain', { domain }));
        return;
      }
      setConnection(created);
      setStep('idomain');
    } catch (raw) {
      setError((raw as Error)?.message || t('deployModal.ownDomain.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const loadGuide = useCallback(async () => {
    if (!hosts.length) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/ideploy/applications/${encodeURIComponent(appUuid)}/domains/dns?domains=${encodeURIComponent(hosts.join(','))}`,
        { credentials: 'include' }
      );
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) setChecks(data.guide?.domains ?? []);
    } catch {
      /* relu au prochain tour */
    }
  }, [appUuid, hosts]);

  useEffect(() => {
    if (step !== 'records') return;
    void loadGuide();
    const timer = setInterval(() => void loadGuide(), POLL_MS);
    return () => clearInterval(timer);
  }, [step, loadGuide]);

  useEffect(() => {
    if (step !== 'idomain' || !connection || connection.status === 'active' || connection.status === 'failed') return;
    const timer = setInterval(() => {
      idomain.connection(connection.id).then(setConnection).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [step, connection, idomain]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      /* la valeur reste affichée */
    }
  };

  const statusOf = (check: DomainCheck): 'live' | 'certificate' | 'proxied' | 'waiting' => {
    if (check.https?.status === 'valid') return 'live';
    if (check.status === 'proxied') return 'proxied';
    if (check.status === 'ok' || check.status === 'ipv6_conflict') return 'certificate';
    return 'waiting';
  };
  const allLive = checks.length > 0 && checks.every((c) => statusOf(c) === 'live');
  const chosen = PROVIDERS.find((p) => p.id === provider) ?? null;

  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {step === 'host' && (
        <form onSubmit={submitHost} className="grid gap-2">
          <label htmlFor="own-domain-host" className="text-sm font-semibold text-text-primary">
            {t('deployModal.ownDomain.label')}
          </label>
          <div className="flex gap-2">
            <input
              id="own-domain-host"
              autoFocus
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="maboutique.com"
              className="min-w-0 flex-1"
            />
            <Button variant="primary" size="sm" type="submit" disabled={!domain}>
              {t('deployModal.ownDomain.next')}
            </Button>
          </div>
          <button type="button" onClick={onCancel} className="button-ghost button-sm justify-self-start !px-2">
            {t('deployModal.ownDomain.back')}
          </button>
        </form>
      )}

      {step === 'source' && (
        <>
          <ChoiceList
            question={t('deployModal.ownDomain.sourceQuestion', { domain })}
            busy={busy ? busyChoice : null}
            choices={[
              { value: 'other', label: t('deployModal.ownDomain.other'), description: t('deployModal.ownDomain.otherHint') },
              { value: 'idomain', label: t('deployModal.ownDomain.idomain'), description: t('deployModal.ownDomain.idomainHint') },
            ]}
            onChoose={(value) => {
              setBusyChoice(value);
              void (value === 'idomain' ? chooseIdomain() : chooseOther());
            }}
          />
          <button type="button" onClick={() => setStep('host')} disabled={busy} className="button-ghost button-sm justify-self-start !px-2">
            {t('deployModal.ownDomain.back')}
          </button>
        </>
      )}

      {step === 'idomain' && connection && (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-sm text-text-primary" role="status">
            {connection.status !== 'active' && connection.status !== 'failed' && <IdemLoader size="xs" />}
            {t(
              connection.status === 'active'
                ? 'deployModal.ownDomain.idomainLive'
                : connection.status === 'failed'
                  ? 'deployModal.ownDomain.idomainFailed'
                  : 'deployModal.ownDomain.idomainPending',
              { domain: connection.host }
            )}
          </p>
          <Button variant="primary" size="sm" onClick={onDone} className="justify-self-end">
            {t('deployModal.ownDomain.done')}
          </Button>
        </div>
      )}

      {step === 'records' && (
        <div className="grid gap-5">
          <p className="text-sm text-text-secondary">{t('deployModal.ownDomain.recordsLead', { domain: hosts[0] ?? '' })}</p>

          <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* 1. Chez le fournisseur : où cliquer, nommé comme chez lui. */}
            <div className="grid content-start gap-3">
              <StepTitle n={1} label={t('deployModal.ownDomain.stepProvider')} />
              <select
                id="own-domain-provider"
                aria-label={t('deployModal.ownDomain.whereQuestion')}
                value={provider ?? ''}
                onChange={(e) => setProvider(e.target.value || null)}
              >
                <option value="">{t('deployModal.ownDomain.pickProvider')}</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || t('deployModal.ownDomain.otherProvider')}
                  </option>
                ))}
              </select>
              {chosen ? (
                <>
                  <ol className="grid gap-1.5 text-xs leading-relaxed text-text-secondary">
                    {(['step1', 'step2', 'step3'] as const).map((key, index) => (
                      <li key={key} className="flex gap-2">
                        <span className="tabular-nums text-text-tertiary">{index + 1}.</span>
                        <span>{t(`deployModal.ownDomain.providers.${chosen.id}.${key}`)}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs leading-relaxed text-text-tertiary">{t(`deployModal.ownDomain.providers.${chosen.id}.tip`)}</p>
                  {chosen.url && (
                    <a href={chosen.url} target="_blank" rel="noreferrer" className="outer-button button-sm inline-flex items-center gap-1.5 justify-self-start">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('deployModal.ownDomain.openProvider', { name: chosen.name })}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-xs text-text-tertiary">{t('deployModal.ownDomain.pickHint')}</p>
              )}
            </div>

            {/* 2. Les réglages à recopier : une ligne chacun, et où il en est (relu toutes les 10 s). */}
            <div className="grid content-start gap-3">
              <StepTitle n={2} label={t('deployModal.ownDomain.stepRecords')} />
              {checks.length === 0 ? (
                <div className="skeleton h-24 rounded-lg" aria-hidden="true" />
              ) : (
                <ul className="grid gap-3">
                  {checks.map((check) => {
                    const state = statusOf(check);
                    return (
                      <li key={check.host} className="rounded-lg border border-[var(--glass-border)] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                            {check.record && <span className="tag !py-0 font-mono !text-[11px]">{check.record.type}</span>}
                            {check.host}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                            {state === 'live' ? <span className="status-dot bg-success" aria-hidden /> : <IdemLoader size="xs" />}
                            <span className={state === 'live' ? 'text-success' : ''}>{t(`deployModal.ownDomain.status.${state}`)}</span>
                          </span>
                        </div>
                        {check.record && state !== 'live' && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                            <CopyField
                              label={t('deployModal.ownDomain.name')}
                              value={check.record.name}
                              copied={copied === `${check.host}-name`}
                              onCopy={() => copy(check.record!.name, `${check.host}-name`)}
                              copyLabel={t('header.copy')}
                              copiedLabel={t('deployModal.ownDomain.copied')}
                            />
                            <CopyField
                              label={t('deployModal.ownDomain.value')}
                              value={check.record.value}
                              copied={copied === `${check.host}-value`}
                              onCopy={() => copy(check.record!.value, `${check.host}-value`)}
                              copyLabel={t('header.copy')}
                              copiedLabel={t('deployModal.ownDomain.copied')}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs leading-relaxed text-text-tertiary">{t('deployModal.ownDomain.wait')}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--glass-border-subtle)] pt-4">
            <button type="button" onClick={onCancel} className="button-ghost button-sm !px-2">
              {t('deployModal.ownDomain.back')}
            </button>
            <Button variant="primary" size="sm" onClick={onDone}>
              {t(allLive ? 'deployModal.ownDomain.done' : 'deployModal.ownDomain.later')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepTitle({ n, label }: { n: number; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
      <span className="grid h-5 w-5 flex-none place-items-center rounded border border-[var(--glass-border)] text-[11px] tabular-nums text-text-tertiary" aria-hidden="true">
        {n}
      </span>
      {label}
    </p>
  );
}

/** Une valeur à recopier : son nom, la valeur bien lisible, et un vrai bouton « Copier ». */
function CopyField({
  label,
  value,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg-light)] py-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary" title={value}>
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`${copyLabel} ${label} : ${value}`}
          className="outer-button button-sm inline-flex flex-none items-center gap-1.5 !px-2.5"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}
