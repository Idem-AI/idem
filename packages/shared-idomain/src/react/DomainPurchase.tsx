import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { IdemLoader } from '@idem/shared-loader/react';
import { Connection, Contact, Quote, createIdomainClient } from '../client';
import { DomainPurchaseFlow, PURCHASE_STAGES, PurchaseState, formatXaf, stageIndex } from '../flow';
import { CONTACT_FIELDS, FACADE_PATHS, idomainText } from '../texts';

export interface DomainPurchaseProps {
  /** L'API iDomain (environnement de l'application). */
  apiUrl: string;
  /** L'application qui recevra le nom ; absente, l'utilisateur la choisit. */
  appUuid?: string | null;
  appName?: string | null;
  lang?: string;
  /** La page de recharge du portefeuille (le montant manquant y est ajouté). */
  topupUrl: string;
  /** Un nom à chercher tout de suite. */
  initial?: string;
  onClose: () => void;
  /** L'installation est terminée (en ligne). */
  onFinished?: (connection: Connection | null) => void;
}

const SETUP_STEPS = ['paid', 'registered', 'connected', 'live'];

/**
 * Acheter un nom sans quitter l'application (iCode) — le même parcours que dans iDeploy
 * (`DomainPurchaseFlow`), rendu en React. Une fenêtre de taille fixe, centrée (feuille en bas sur
 * téléphone) : la progression des quatre étapes en tête, le contenu qui défile au milieu, l'action
 * principale toujours visible en pied.
 */
export function DomainPurchase({ apiUrl, appUuid = null, appName = null, lang = 'fr', topupUrl, initial = '', onClose, onFinished }: DomainPurchaseProps) {
  // Le parcours vit tant que la fenêtre est montée. En développement, React (mode strict) monte,
  // démonte puis remonte : le parcours arrêté au démontage est remplacé par un neuf au remontage
  // (sinon il ignorerait toutes les réponses, et la fenêtre chargerait sans fin).
  const make = () => new DomainPurchaseFlow(createIdomainClient(apiUrl, () => lang), { appUuid });
  const [flow, setFlow] = useState<DomainPurchaseFlow>(make);
  const [s, setState] = useState<PurchaseState>(() => flow.state);
  const [query, setQuery] = useState(initial);
  const [draft, setDraft] = useState<Partial<Contact>>({});
  const [submitted, setSubmitted] = useState(false);
  const reported = useRef(false);
  const queryRef = useRef<HTMLInputElement>(null);
  const t = (key: string, params: Record<string, string | number> = {}) => idomainText(lang, key, params);

  useEffect(() => {
    if (flow.isDisposed) {
      setFlow(make());
      return;
    }
    const unsubscribe = flow.subscribe((next) => {
      setState(next);
      if (next.progress === 'live' && !reported.current) {
        reported.current = true;
        onFinished?.(next.connection);
      }
    });
    // Le nom de l'application, cherché d'office : ses extensions libres s'affichent tout de suite.
    if (initial) void flow.search(initial);
    queryRef.current?.focus();
    return () => {
      unsubscribe();
      flow.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contactValue = (name: keyof Contact) => String(({ phoneCountryCode: '237', country: 'CM', ...s.contactDefaults, ...(s.contact ?? {}), ...draft } as Partial<Contact>)[name] ?? '');
  const invalid = (name: string) => {
    if (!submitted) return false;
    const f = CONTACT_FIELDS.find((x) => x.name === name)!;
    const v = contactValue(name as keyof Contact).trim();
    return !(f.optional && !v) && !f.pattern.test(v);
  };
  const saveContact = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const values = Object.fromEntries(CONTACT_FIELDS.map((f) => [f.name, contactValue(f.name).trim()])) as unknown as Contact;
    const bad = CONTACT_FIELDS.some((f) => !(f.optional && !values[f.name]) && !f.pattern.test(String(values[f.name] ?? '')));
    if (!bad) void flow.saveContact({ ...values, company: values.company || null });
  };

  const stage = stageIndex(s);
  const current = s.progress === 'registering' ? 'registered' : s.progress === 'connecting' ? 'connected' : s.progress === 'securing' ? 'live' : s.progress === 'paying' ? 'paid' : null;
  const done = (step: string) => s.progress === 'live' || (current !== null && SETUP_STEPS.indexOf(step) < SETUP_STEPS.indexOf(current));
  const steps = s.appUuid ? SETUP_STEPS : SETUP_STEPS.slice(0, 2);
  const amount = s.topupXaf ?? s.missingXaf;
  const topupHref = `${topupUrl}${amount ? `${topupUrl.includes('?') ? '&' : '?'}topup=${amount}` : ''}`;
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang.startsWith('en') ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  const finished = ['live', 'failed', 'connection_failed'].includes(s.progress || '');

  const row = (q: Quote, featured = false) => (
    <li key={q.domain} className={`flex items-center gap-3 px-4 py-3 ${featured && q.state === 'available' ? 'bg-[color-mix(in_oklch,var(--color-success)_7%,transparent)]' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${featured ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{q.domain}</p>
        <p className="text-xs" style={{ color: q.state === 'available' ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
          {t(`state.${q.state}`)}
          {q.state === 'available' && q.renewalXaf ? <span className="text-[var(--color-text-tertiary)]"> · {t('search.renewal', { price: formatXaf(q.renewalXaf) })}</span> : null}
        </p>
      </div>
      {q.state === 'available' && (
        <>
          <span className="shrink-0 text-sm font-semibold">{formatXaf(q.priceXaf)}</span>
          <button type="button" className={`${featured ? 'inner-button' : 'outer-button'} button-sm shrink-0`} disabled={s.locking} onClick={() => void flow.choose(q)}>
            {t('search.choose')}
          </button>
        </>
      )}
    </li>
  );

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (s.step === 'search') {
    const r = s.result;
    body = (
      <>
        <form role="search" className="flex items-center gap-1 rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-2)] p-1 focus-within:border-[var(--color-primary-500)]" onSubmit={(e) => { e.preventDefault(); void flow.search(query); }}>
          <label className="sr-only" htmlFor="idm-query">{t('search.label')}</label>
          <input ref={queryRef} id="idm-query" type="text" className="!m-0 min-w-0 flex-1 !border-0 !bg-transparent !px-3 !py-2 !shadow-none !outline-none" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={253} placeholder={t('search.placeholder')} value={query} onChange={(e) => { setQuery(e.target.value); flow.type(e.target.value); }} />
          <button type="submit" className="inner-button button-sm inline-flex shrink-0 items-center gap-2" disabled={s.searching || s.locking || !query.trim()}>
            {s.searching && <IdemLoader size="xs" />}
            {t('search.submit')}
          </button>
        </form>
        {s.locking && <IdemLoader block className="mt-6" />}
        {!r && !s.searching && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <svg viewBox="0 0 120 88" width={120} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--color-text-tertiary)' }}>
              {FACADE_PATHS.map((p) => <path key={p.d} d={p.d} strokeWidth={p.width} opacity={p.opacity} style={p.accent ? { color: 'var(--color-primary-500)' } : undefined} />)}
            </svg>
            <p className="mt-4 max-w-xs text-sm text-[var(--color-text-secondary)]">{t('search.empty')}</p>
          </div>
        )}
        {s.searching && !r && <div className="mt-4 space-y-2"><div className="skeleton h-14 rounded-xl" /><div className="skeleton h-12 rounded-xl" /></div>}
        {r && (
          <>
            {r.exact ? (
              <ul className="mt-4 overflow-hidden rounded-xl border border-[var(--glass-border)]">{row(r.exact, true)}</ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{t('search.invalid')}</p>
            )}
            {r.suggestions.length > 0 && (
              <>
                <p className="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">{t('search.suggestions')}</p>
                <ul className="mt-2 divide-y divide-[var(--glass-border-subtle)] overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]">{r.suggestions.map((q) => row(q))}</ul>
              </>
            )}
            {r.extensions.length > 0 && (
              <>
                <p className="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">{t('search.otherExtensions')}</p>
                <ul className="mt-2 divide-y divide-[var(--glass-border-subtle)] overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]">{r.extensions.map((q) => row(q))}</ul>
              </>
            )}
          </>
        )}
      </>
    );
  }

  if (s.step === 'holder') {
    body = (
      <>
        <h3 className="font-semibold">{t('holder.title')}</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('holder.lead')}</p>
        <form id="idm-holder" className="mt-4 grid gap-3 sm:grid-cols-2" noValidate onSubmit={saveContact}>
          {CONTACT_FIELDS.map((f) => (
            <div key={f.name} className={f.wide ? 'sm:col-span-2' : undefined}>
              <label htmlFor={`idm-${f.name}`}>{t(`field.${f.name}`)}</label>
              <input id={`idm-${f.name}`} type={f.type} autoComplete={f.autocomplete} value={contactValue(f.name)} onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))} aria-invalid={invalid(f.name)} aria-describedby={invalid(f.name) ? `idm-${f.name}-err` : undefined} />
              {invalid(f.name) && <p id={`idm-${f.name}-err`} className="mt-1 text-xs text-[var(--color-danger)]">{t('holder.invalid')}</p>}
            </div>
          ))}
        </form>
      </>
    );
    footer = (
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="button-ghost button-sm" onClick={() => flow.back()}>{t('back')}</button>
        <button type="submit" form="idm-holder" className="inner-button inline-flex items-center gap-2" disabled={s.savingContact}>
          {s.savingContact && <IdemLoader size="xs" />}
          {t('holder.save')}
        </button>
      </div>
    );
  }

  if (s.step === 'confirm' && s.session) {
    const session = s.session;
    body = (
      <>
        <div className="rounded-2xl border border-[var(--glass-border)] p-4">
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-xs">
            <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="var(--color-success)" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
            <span className="truncate"><span className="text-[var(--color-text-tertiary)]">https://</span><span className="font-medium">{session.domain}</span></span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{session.domain}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{t('confirm.guaranteed', { time: time(session.expiresAt) })}</p>
            </div>
            <p className="shrink-0 text-2xl font-black">{formatXaf(session.priceXaf)}</p>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-[var(--glass-border-subtle)] text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt><label htmlFor="idm-years" className="!m-0">{t('confirm.duration')}</label></dt>
            <dd className="flex items-center gap-2">
              {s.locking && <IdemLoader size="xs" />}
              <select id="idm-years" className="!m-0 !w-auto !py-1.5" value={s.years} disabled={s.locking} onChange={(e) => void flow.setYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y === 1 ? t('confirm.oneYear') : t('confirm.years', { count: y })}</option>)}
              </select>
            </dd>
          </div>
          {session.renewalXaf ? (
            <div className="py-3 text-[var(--color-text-secondary)]">{t('confirm.renewal', { price: formatXaf(session.renewalXaf) })}</div>
          ) : null}
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-[var(--color-text-secondary)]">{t('confirm.app')}</dt>
            <dd className="min-w-0 text-right font-medium">
              {appUuid ? (
                <span className="truncate">{appName || appUuid}</span>
              ) : s.apps === null ? (
                <IdemLoader size="xs" />
              ) : s.apps.length ? (
                <>
                  <label className="sr-only" htmlFor="idm-app">{t('confirm.chooseApp')}</label>
                  <select id="idm-app" className="!m-0 !w-auto !py-1.5" value={s.appUuid ?? ''} onChange={(e) => flow.setApp(e.target.value || null)}>
                    <option value="">{t('confirm.chooseApp')}</option>
                    {s.apps.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
                  </select>
                </>
              ) : (
                <span className="text-xs font-normal text-[var(--color-text-secondary)]">{t('confirm.noApps')}</span>
              )}
            </dd>
          </div>
          {s.contact && (
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="truncate text-[var(--color-text-secondary)]">{t('confirm.holder', { name: `${s.contact.firstName} ${s.contact.lastName}` })}</dt>
              <dd><button type="button" className="button-ghost button-sm" onClick={() => flow.editContact()}>{t('confirm.editHolder')}</button></dd>
            </div>
          )}
        </dl>
      </>
    );
    footer = (
      <>
        <button type="button" className="inner-button inline-flex w-full items-center justify-center gap-2" disabled={s.paying || s.locking} onClick={() => void flow.pay()}>
          {s.paying && <IdemLoader size="xs" />}
          {s.appUuid ? t('confirm.pay', { price: formatXaf(session.priceXaf) }) : t('confirm.payOnly', { price: formatXaf(session.priceXaf) })}
        </button>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" className="button-ghost button-sm" onClick={() => flow.back()}>{t('back')}</button>
          <p className="text-right text-[11px] leading-snug text-[var(--color-text-tertiary)]">{t('confirm.payHint')}</p>
        </div>
      </>
    );
  }

  if (s.step === 'payment') {
    body = (
      <div className="py-2">
        <p className="text-lg font-semibold">{t('payment.title', { missing: formatXaf(s.missingXaf) })}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('payment.lead')}</p>
      </div>
    );
    footer = (
      <div className="flex flex-wrap justify-end gap-2">
        <a className="outer-button" href={topupHref} target="_blank" rel="noopener noreferrer">{t('payment.topup')}</a>
        <button type="button" className="inner-button inline-flex items-center gap-2" disabled={s.paying} onClick={() => void flow.pay()}>
          {s.paying && <IdemLoader size="xs" />}
          {t('payment.retry')}
        </button>
      </div>
    );
  }

  if (s.step === 'progress') {
    body = (
      <>
        <p className="truncate text-lg font-semibold">{s.order?.items?.[0]?.domain || s.session?.domain}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(`progress.${s.progress || 'registering'}`)}</p>
        {!['failed', 'on_hold'].includes(s.progress || '') && (
          <ol className="mt-5 space-y-4">
            {steps.map((step) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                {done(step) ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'var(--color-success)' }}>
                    <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="var(--color-surface-1)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.6" /></svg>
                  </span>
                ) : current === step ? (
                  <span className="grid h-6 w-6 place-items-center"><IdemLoader size="xs" /></span>
                ) : (
                  <span className="h-6 w-6 rounded-full border border-[var(--glass-border)]" aria-hidden="true" />
                )}
                <span style={!done(step) && current !== step ? { color: 'var(--color-text-tertiary)' } : undefined}>{t(`progress.step.${step}`)}</span>
              </li>
            ))}
          </ol>
        )}
        {!finished && <p className="mt-5 text-xs text-[var(--color-text-tertiary)]">{t('progress.canClose')}</p>}
      </>
    );
    footer = (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="button-ghost" onClick={onClose}>{t('close')}</button>
        {s.progress === 'connection_failed' && <button type="button" className="outer-button" onClick={() => void flow.retryConnection()}>{t('progress.retry')}</button>}
        {s.progress === 'live' && s.connection && (
          <a className="inner-button" href={`https://${s.connection.host}`} target="_blank" rel="noopener noreferrer">{t('progress.open', { domain: s.connection.host })}</a>
        )}
      </div>
    );
  }

  const stageName = t(`stage.${PURCHASE_STAGES[stage]}`);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label={t('close')} className="absolute inset-0 cursor-default" style={{ background: 'color-mix(in oklch, var(--color-bg-darker) 60%, transparent)' }} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="idm-purchase-title"
        className="modal-panel relative flex max-h-[88dvh] w-full max-w-[34rem] flex-col overflow-hidden !rounded-b-none text-[var(--color-text-primary)] sm:max-h-[min(44rem,88dvh)] sm:!rounded-b-[var(--radius-2xl)]"
      >
        <header className="shrink-0 px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="idm-purchase-title" className="text-base font-semibold">{t('title')}</h2>
            <button type="button" className="button-icon !p-2" aria-label={t('close')} onClick={onClose}>
              <svg viewBox="0 0 16 16" width={14} height={14} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {PURCHASE_STAGES.map((st, i) => (
              <span key={st} className="h-1 flex-1 rounded-full" style={{ background: i <= stage ? 'var(--color-primary-500)' : 'var(--color-surface-3)' }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t('stage.label', { n: stage + 1, name: stageName })}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" aria-live="polite">
          {s.error && <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm text-[var(--color-danger)]" style={{ background: 'color-mix(in oklch, var(--color-danger) 8%, transparent)' }}>{s.error.text || t(s.error.key || 'errors.pay')}</p>}
          {body}
        </div>

        {footer && <footer className="shrink-0 border-t border-[var(--glass-border-subtle)] px-6 py-4">{footer}</footer>}
      </section>
    </div>
  );
}

/**
 * Les noms achetés chez IDEM et reliés à une application : pour afficher, à côté de l'adresse
 * gratuite, le nom à soi et son état (en ligne, en cours, à relancer).
 */
export function useDomainConnections(apiUrl: string, appUuid: string | null | undefined, refreshKey = 0): Connection[] {
  const [list, setList] = useState<Connection[]>([]);
  useEffect(() => {
    if (!appUuid) {
      setList([]);
      return;
    }
    let alive = true;
    createIdomainClient(apiUrl)
      .connections({ appUuid })
      .then((r) => alive && setList(r.connections.filter((c) => c.domain)))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [apiUrl, appUuid, refreshKey]);
  return list;
}
