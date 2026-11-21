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
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{t('deployModal.ownDomain.recordsTitle')}</p>
            <p className="mt-0.5 text-xs text-text-secondary">{t('deployModal.ownDomain.recordsLead')}</p>
          </div>

          {/* 1. Le fournisseur : ses trois étapes, ses boutons nommés comme chez lui. */}
          {!allLive && (
            <div className="grid gap-2">
              <label htmlFor="own-domain-provider" className="text-xs font-semibold text-text-primary">
                {t('deployModal.ownDomain.whereQuestion')}
              </label>
              <select id="own-domain-provider" value={provider ?? ''} onChange={(e) => setProvider(e.target.value || null)}>
                <option value="">{t('deployModal.ownDomain.pickProvider')}</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || t('deployModal.ownDomain.otherProvider')}
                  </option>
                ))}
              </select>
              {chosen && (
                <ol className="grid gap-1.5">
                  {(['step1', 'step2', 'step3'] as const).map((s, index) => (
                    <li key={s} className="flex gap-2 text-xs text-text-secondary">
                      <span className="grid h-5 w-5 flex-none place-items-center rounded border border-[var(--glass-border)] text-[11px] tabular-nums text-text-tertiary" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{t(`deployModal.ownDomain.providers.${chosen.id}.${s}`)}</span>
                    </li>
                  ))}
                  <li className="text-xs text-text-tertiary">{t(`deployModal.ownDomain.providers.${chosen.id}.tip`)}</li>
                  {chosen.url && (
                    <li>
                      <a href={chosen.url} target="_blank" rel="noreferrer" className="button-ghost button-sm inline-flex items-center gap-1 !px-2">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('deployModal.ownDomain.openProvider', { name: chosen.name })}
                      </a>
                    </li>
                  )}
                </ol>
              )}
            </div>
          )}

          {/* 2. Le réglage à recopier, et où il en est (relu toutes les 10 s). */}
          {checks.length === 0 ? (
            <div className="skeleton h-16 rounded-lg" aria-hidden="true" />
          ) : (
            <ul className="grid gap-2">
              {checks.map((check) => {
                const state = statusOf(check);
                return (
                  <li key={check.host} className="rounded-lg border border-[var(--glass-border)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{check.host}</span>
                      <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                        {state !== 'live' && <IdemLoader size="xs" />}
                        <span className={state === 'live' ? 'text-success' : ''}>{t(`deployModal.ownDomain.status.${state}`)}</span>
                      </span>
                    </div>
                    {check.record && state !== 'live' && (
                      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-text-tertiary">{t('deployModal.ownDomain.type')}</span>
                        <span className="font-mono text-text-primary">{check.record.type}</span>
                        <span />
                        {(['name', 'value'] as const).map((field) => (
                          <FieldRow
                            key={field}
                            label={t(`deployModal.ownDomain.${field}`)}
                            value={check.record![field]}
                            copied={copied === `${check.host}-${field}`}
                            onCopy={() => copy(check.record![field], `${check.host}-${field}`)}
                            copyLabel={t('header.copy')}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!allLive && <p className="text-xs text-text-tertiary">{t('deployModal.ownDomain.wait')}</p>}

          <Button variant="primary" size="sm" onClick={onDone} className="justify-self-end">
            {t(allLive ? 'deployModal.ownDomain.done' : 'deployModal.ownDomain.later')}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, copied, onCopy, copyLabel }: { label: string; value: string; copied: boolean; onCopy: () => void; copyLabel: string }) {
  return (
    <>
      <span className="text-text-tertiary">{label}</span>
      <span className="truncate font-mono text-text-primary" title={value}>
        {value}
      </span>
      <button type="button" onClick={onCopy} aria-label={`${copyLabel} ${label}`} className="button-icon !p-1">
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </>
  );
}
