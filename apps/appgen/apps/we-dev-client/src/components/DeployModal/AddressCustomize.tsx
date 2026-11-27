import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { IdemLoader } from '@idem/shared-loader/react';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';
const PLATFORM_DOMAIN = 'ideploy.site';

type Availability = { state: 'idle' | 'checking' } | { state: 'free'; host: string } | { state: 'refused'; reason: string };

/** The label of a free address (`buni` in `buni.ideploy.site`), or null for any other address. */
export function platformLabel(url: string | null | undefined): string | null {
  const host = (url ?? '').replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').toLowerCase();
  const match = /^([a-z0-9-]+)\.(?:ideploy\.site|idem\.africa)$/.exec(host);
  return match ? match[1] : null;
}

/**
 * « Personnaliser l'adresse » : the name of the free address, chosen by the owner
 * (`buni.ideploy.site` rather than `buni-k3x9p.ideploy.site`). Availability is
 * checked while typing; iDeploy applies it (routes, or a redeployment by itself).
 */
export function AddressCustomize({
  appUuid,
  currentUrl,
  onChanged,
  onCancel,
}: {
  appUuid: string;
  currentUrl: string;
  onChanged: (url: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(platformLabel(currentUrl) ?? '');
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = platformLabel(currentUrl);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const wanted = label.trim().toLowerCase();
    if (!wanted || wanted === current) {
      setAvailability({ state: 'idle' });
      return;
    }
    setAvailability({ state: 'checking' });
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/ideploy/applications/${encodeURIComponent(appUuid)}/platform-address?label=${encodeURIComponent(wanted)}`,
          { credentials: 'include' }
        );
        const data = await response.json().catch(() => null);
        if (!alive) return;
        if (data?.available && data.host) setAvailability({ state: 'free', host: String(data.host) });
        else setAvailability({ state: 'refused', reason: String(data?.reason ?? 'unavailable') });
      } catch {
        if (alive) setAvailability({ state: 'refused', reason: 'unavailable' });
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [label, appUuid, current]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (availability.state !== 'free' || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ideploy/applications/${encodeURIComponent(appUuid)}/platform-address`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data.url) {
        setError(data?.message || t('deployModal.customize.error'));
        return;
      }
      await onChanged(String(data.url));
    } catch {
      setError(t('deployModal.customize.error'));
    } finally {
      setSaving(false);
    }
  };

  const hintId = 'address-customize-hint';
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-xl border border-[var(--glass-border)] bg-surface-2 p-4">
      <label htmlFor="address-customize" className="text-sm font-semibold text-text-primary">
        {t('deployModal.customize.title')}
      </label>
      <div className="flex items-center rounded-lg border border-[var(--glass-border)] bg-[var(--idem-surface-1)] focus-within:border-[var(--color-primary)]">
        <input
          id="address-customize"
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hintId}
          className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none"
          data-mono
        />
        <span className="pr-3 text-sm text-text-tertiary" data-mono>
          .{PLATFORM_DOMAIN}
        </span>
      </div>
      <p id={hintId} className="flex min-h-[18px] items-center gap-1.5 text-xs" role="status" aria-live="polite">
        {availability.state === 'checking' && (
          <>
            <IdemLoader size="xs" />
            <span className="text-text-tertiary">{t('deployModal.customize.checking')}</span>
          </>
        )}
        {availability.state === 'free' && <span className="text-success">{t('deployModal.customize.free', { host: availability.host })}</span>}
        {availability.state === 'refused' && (
          <span className="text-[var(--color-danger)]">{t(`deployModal.customize.refused.${availability.reason}`, { defaultValue: t('deployModal.customize.refused.unavailable') })}</span>
        )}
        {availability.state === 'idle' && <span className="text-text-tertiary">{t('deployModal.customize.hint')}</span>}
      </p>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          {t('deployModal.cancel')}
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={availability.state !== 'free' || saving}>
          {saving ? t('deployModal.customize.saving') : t('deployModal.customize.cta')}
        </Button>
      </div>
    </form>
  );
}
