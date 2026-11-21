import { FormEvent, useEffect, useRef, useState } from 'react';
import { IdemLoader } from '@idem/shared-loader/react';
import { Connection, IdomainError, createIdomainClient } from '../client';
import { idomainText } from '../texts';

export interface DomainConnectProps {
  apiUrl: string;
  /** L'application qui répondra à ce nom. */
  appUuid: string;
  lang?: string;
  /** Reprendre une connexion déjà demandée (ses réglages et son état). */
  connectionId?: string | null;
  onClose: () => void;
  /** Le nom est en ligne, HTTPS compris. */
  onFinished?: (connection: Connection) => void;
  /** Une connexion a été créée : la liste de l'appelant peut se rafraîchir. */
  onChanged?: () => void;
}

const POLL_MS = 10_000;

/**
 * Brancher un nom acheté AILLEURS (Namecheap, GoDaddy, OVH…), sans quitter l'application.
 *
 * Le serveur iDomain fait tout le travail (`method: 'manual'`) : il prouve que le nom est à
 * l'utilisateur (un TXT), donne l'adresse du serveur (un A), surveille le DNS public, relie le nom
 * à l'application et attend un certificat valide. Cette fenêtre ne fait que montrer les deux
 * réglages à copier, et l'état, relu toutes les 10 s.
 */
export function DomainConnect({ apiUrl, appUuid, lang = 'fr', connectionId = null, onClose, onFinished, onChanged }: DomainConnectProps) {
  const t = (key: string, params: Record<string, string | number> = {}) => idomainText(lang, key, params);
  const client = useRef(createIdomainClient(apiUrl, () => lang)).current;
  const [host, setHost] = useState('');
  const [includeWww, setIncludeWww] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const reported = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reprise d'une connexion existante.
  useEffect(() => {
    if (!connectionId) {
      inputRef.current?.focus();
      return;
    }
    client.connection(connectionId).then(setConnection).catch(() => setError(t('errors.connect')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  // L'état, relu tant que ce n'est pas terminé.
  useEffect(() => {
    if (!connection || connection.status === 'active' || connection.status === 'failed' || connection.status === 'detached') return;
    const timer = setInterval(() => {
      client.connection(connection.id).then(setConnection).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [client, connection]);

  useEffect(() => {
    if (connection?.status === 'active' && !reported.current) {
      reported.current = true;
      onFinished?.(connection);
    }
  }, [connection, onFinished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cleaned = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cleaned || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await client.connect({ host: cleaned, appUuid, includeWww });
      setConnection(created);
      onChanged?.();
    } catch (raw) {
      setError(raw instanceof IdomainError && raw.message ? raw.message : t('errors.connect'));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!connection) return;
    setBusy(true);
    try {
      setConnection(await client.retryConnection(connection.id));
    } catch {
      setError(t('errors.retry'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      /* presse-papiers refusé : la valeur reste affichée, sélectionnable */
    }
  };

  const status = connection?.status;
  const statusKey =
    status && ['verifying_ownership', 'attaching', 'waiting_dns', 'activating_tls', 'active', 'failed'].includes(status)
      ? `connect.status.${status}`
      : 'connect.status.other';
  const instructions = connection?.instructions ?? [];

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label={t('close')} className="absolute inset-0 cursor-default" style={{ background: 'color-mix(in oklch, var(--color-bg-darker) 60%, transparent)' }} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="idm-connect-title"
        className="modal-panel relative flex max-h-[88dvh] w-full max-w-[34rem] flex-col overflow-hidden !rounded-b-none text-[var(--color-text-primary)] sm:max-h-[min(44rem,88dvh)] sm:!rounded-b-[var(--radius-2xl)]"
      >
        <header className="shrink-0 px-6 pb-3 pt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="idm-connect-title" className="text-base font-semibold">{t('connect.title')}</h2>
            <button type="button" className="button-icon !p-2" aria-label={t('close')} onClick={onClose}>
              <svg viewBox="0 0 16 16" width={14} height={14} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
          {!connection && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('connect.lead')}</p>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" aria-live="polite">
          {error && (
            <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm text-[var(--color-danger)]" style={{ background: 'color-mix(in oklch, var(--color-danger) 8%, transparent)' }}>
              {error}
            </p>
          )}

          {!connection && !connectionId && (
            <form onSubmit={submit} className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('connect.label')}</span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t('connect.placeholder')}
                 
                />
              </label>
              {cleaned && cleaned.split('.').length === 2 && (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} />
                  {t('connect.www', { domain: cleaned })}
                </label>
              )}
              <div className="flex justify-end">
                <button type="submit" className="inner-button inline-flex items-center gap-2" disabled={!cleaned || busy}>
                  {busy ? <IdemLoader size="xs" /> : t('connect.submit')}
                </button>
              </div>
            </form>
          )}

          {connection && (
            <div className="grid gap-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                {status !== 'active' && status !== 'failed' && <IdemLoader size="sm" />}
                <span>{t(statusKey, { domain: connection.host })}</span>
              </p>

              {status !== 'active' && instructions.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-sm font-medium">{t('connect.stepsTitle')}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t('connect.stepsLead')}</p>
                  <ol className="grid gap-2">
                    {instructions.map((record, index) => {
                      const key = `${record.type}-${record.name}-${index}`;
                      return (
                        <li key={key} className="rounded-xl border border-[var(--glass-border-subtle)] p-3">
                          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                            {index + 1}. {t(`connect.purpose.${record.purpose}`)}
                          </p>
                          <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm">
                            <span className="text-xs text-[var(--color-text-tertiary)]">{t('connect.type')}</span>
                            <span className="font-mono">{record.type}</span>
                            <span />
                            <span className="text-xs text-[var(--color-text-tertiary)]">{t('connect.name')}</span>
                            <span className="truncate font-mono" title={record.name}>{record.name}</span>
                            <button type="button" className="button-ghost button-sm" onClick={() => copy(record.name, `${key}-n`)}>
                              {copied === `${key}-n` ? t('connect.copied') : t('connect.copy')}
                            </button>
                            <span className="text-xs text-[var(--color-text-tertiary)]">{t('connect.value')}</span>
                            <span className="truncate font-mono" title={record.value}>{record.value}</span>
                            <button type="button" className="button-ghost button-sm" onClick={() => copy(record.value, `${key}-v`)}>
                              {copied === `${key}-v` ? t('connect.copied') : t('connect.copy')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{t('connect.replaceHint')}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{t('connect.wait')}</p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {status === 'failed' && (
                  <button type="button" className="outer-button" onClick={retry} disabled={busy}>
                    {t('connect.retry')}
                  </button>
                )}
                {status === 'active' && (
                  <a className="outer-button" href={`https://${connection.host}`} target="_blank" rel="noreferrer">
                    {t('connect.open', { domain: connection.host })}
                  </a>
                )}
                <button type="button" className="inner-button inline-flex items-center gap-2" onClick={onClose}>
                  {status === 'active' ? t('connect.done') : t('close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
