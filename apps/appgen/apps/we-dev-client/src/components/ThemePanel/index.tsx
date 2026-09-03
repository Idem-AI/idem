import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, AlertTriangle, RotateCcw, Sparkles, Info } from 'lucide-react';
import {
  forgeDesignSystem,
  type DesignSystem,
  type ForgeOverrides,
  type ForgeResponse,
} from '@/api/design';

interface ThemePanelProps {
  projectData?: unknown;
  /** Demande au modèle d'appliquer le système au code déjà généré. */
  onApply?: (system: DesignSystem, brief: string) => void;
}

/**
 * Panneau Thème.
 *
 * iCode calcule déjà, pour chaque projet, une palette en OKLCH à contrastes
 * vérifiés, une échelle typographique, un appariement de polices et une
 * direction artistique tirée d'une graine stable. Ce calcul ne vivait que dans
 * le prompt : l'utilisateur en héritait sans jamais pouvoir le regarder.
 *
 * Le panneau le rend visible et négociable. Il affiche aussi les **ratios de
 * contraste mesurés** — la différence entre un thème que l'on choisit et un
 * thème dont on sait qu'il est lisible.
 */
export function ThemePanel({ projectData, onApply }: ThemePanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<ForgeResponse | null>(null);
  const [overrides, setOverrides] = useState<ForgeOverrides>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (next: ForgeOverrides) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Un rechargement garde l'ancien contenu à l'écran : vider le panneau à
      // chaque déplacement du sélecteur de couleur le ferait clignoter.
      setStatus(data ? 'ready' : 'loading');

      try {
        const response = await forgeDesignSystem(projectData, next, controller.signal);
        setData(response);
        setStatus('ready');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setStatus('error');
      }
    },
    [projectData, data]
  );

  useEffect(() => {
    load(overrides);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (patch: ForgeOverrides) => {
      const next = { ...overrides, ...patch };
      setOverrides(next);
      load(next);
    },
    [overrides, load]
  );

  const reset = useCallback(() => {
    setOverrides({});
    load({});
  }, [load]);

  const hasOverrides = Object.values(overrides).some(Boolean);

  if (status === 'loading') {
    return <ThemeSkeleton />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <AlertTriangle className="w-7 h-7 mx-auto text-warning" />
          <p className="text-sm text-text-secondary">{t('theme.error')}</p>
          <button
            type="button"
            onClick={() => load(overrides)}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 transition"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { system, catalog, brief } = data;

  return (
    <div className="h-full overflow-y-auto bg-surface-1">
      <div className="mx-auto max-w-4xl p-5 space-y-7">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{t('theme.title')}</h2>
            <p className="mt-1 text-sm text-text-secondary max-w-prose">
              {system.brandDriven ? t('theme.subtitleBrand') : t('theme.subtitleSeeded')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasOverrides && (
              <button
                type="button"
                onClick={reset}
                className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('theme.reset')}
              </button>
            )}
            {onApply && (
              <button
                type="button"
                onClick={() => onApply(system, brief)}
                className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 active:brightness-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                {t('theme.apply')}
              </button>
            )}
          </div>
        </header>

        {/* ---------- Direction artistique ---------- */}
        <Section
          title={t('theme.direction')}
          hint={t('theme.directionHint')}
        >
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {catalog.directions
              .filter((direction) => direction.registers.includes(system.register))
              .map((direction) => {
                const active = direction.id === system.direction.id;
                return (
                  <button
                    key={direction.id}
                    type="button"
                    onClick={() => update({ directionId: direction.id })}
                    aria-pressed={active}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-primary bg-primary/8'
                        : 'border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {direction.name}
                      </span>
                      {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary line-clamp-2">
                      {direction.signature}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-text-disabled">
                      <span>{direction.surface === 'dark' ? t('theme.dark') : t('theme.light')}</span>
                      <span aria-hidden>·</span>
                      <span>{direction.colorStrategy}</span>
                      <span aria-hidden>·</span>
                      <span>{direction.radius}px</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </Section>

        {/* ---------- Couleurs ---------- */}
        <Section title={t('theme.colors')} hint={t('theme.colorsHint')}>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2.5">
              <span className="text-sm text-text-secondary">{t('theme.brandColor')}</span>
              <span className="relative inline-flex">
                <input
                  type="color"
                  value={overrides.brandColor ?? system.colors.brand['500'] ?? '#1447e6'}
                  onChange={(event) => update({ brandColor: event.target.value })}
                  className="w-9 h-9 rounded-lg border border-[var(--glass-border)] bg-transparent cursor-pointer p-0.5"
                  aria-label={t('theme.brandColor')}
                />
              </span>
              <code className="text-xs text-text-tertiary" data-mono>
                {(overrides.brandColor ?? system.colors.brand['500'] ?? '').toUpperCase()}
              </code>
            </label>

            {system.brandDriven && !overrides.brandColor && (
              <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Info className="w-3.5 h-3.5 shrink-0" />
                {t('theme.fromBrand')}
              </p>
            )}
          </div>

          <Ramp label={t('theme.brandRamp')} ramp={system.colors.brand} />
          <Ramp label={t('theme.neutralRamp')} ramp={system.colors.neutral} />

          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <Swatch label={t('theme.accent')} value={system.colors.accent} />
            <Swatch label={t('theme.secondary')} value={system.colors.secondary} />
            <Swatch label={t('theme.surface')} value={system.colors.surface} />
            <Swatch label={t('theme.surfaceRaised')} value={system.colors.surfaceRaised} />
            <Swatch label={t('theme.ink')} value={system.colors.ink} />
            <Swatch label={t('theme.inkMuted')} value={system.colors.inkMuted} />
          </div>
        </Section>

        {/* ---------- Contrastes : l'argument central ---------- */}
        <Section title={t('theme.contrast')} hint={t('theme.contrastHint')}>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <ContrastRow
              label={t('theme.bodyOnSurface')}
              ratio={system.contrast.bodyOnSurface}
              target={4.5}
            />
            <ContrastRow
              label={t('theme.mutedOnSurface')}
              ratio={system.contrast.mutedOnSurface}
              target={4.5}
            />
            <ContrastRow
              label={t('theme.inkOnAccent')}
              ratio={system.contrast.inkOnAccent}
              target={4.5}
            />
          </div>
        </Section>

        {/* ---------- Typographie ---------- */}
        <Section title={t('theme.typography')} hint={t('theme.typographyHint')}>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {catalog.fontPairings.map((pairing) => {
              const active = pairing.display === system.fonts.display;
              return (
                <button
                  key={pairing.display}
                  type="button"
                  onClick={() => update({ fontPairingDisplay: pairing.display })}
                  aria-pressed={active}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    active
                      ? 'border-primary bg-primary/8'
                      : 'border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-text-primary truncate">{pairing.display}</span>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <span className="text-xs text-text-tertiary">{pairing.body}</span>
                </button>
              );
            })}
          </div>

          <dl className="mt-1 grid gap-x-6 gap-y-1.5 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
            {Object.entries(system.typeScale).map(([step, size]) => (
              <div key={step} className="flex items-baseline justify-between gap-2 min-w-0">
                <dt className="text-xs text-text-tertiary truncate">{step}</dt>
                <dd className="text-xs text-text-secondary tabular-nums" data-mono>
                  {size}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ---------- Le brief réellement envoyé ---------- */}
        <details className="group rounded-lg border border-[var(--glass-border)] bg-surface-2">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary select-none">
            {t('theme.briefLabel')}
          </summary>
          <pre
            className="px-4 pb-4 text-[11px] leading-relaxed text-text-tertiary whitespace-pre-wrap overflow-x-auto"
            data-mono
          >
            {brief}
          </pre>
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-text-tertiary max-w-prose">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Ramp({ label, ramp }: { label: string; ramp: Record<string, string> }) {
  const steps = useMemo(
    () => Object.entries(ramp).sort(([a], [b]) => Number(a) - Number(b)),
    [ramp]
  );

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-[var(--glass-border)]">
        {steps.map(([step, color]) => (
          <div
            key={step}
            className="flex-1 h-10 relative group/step"
            style={{ backgroundColor: color }}
            title={`${step} · ${color}`}
          >
            <span className="sr-only">{`${step} ${color}`}</span>
          </div>
        ))}
      </div>
      <div className="flex text-[10px] text-text-disabled tabular-nums">
        {steps.map(([step]) => (
          <span key={step} className="flex-1 text-center">
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

function Swatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg border border-[var(--glass-border)]">
      <span
        className="w-8 h-8 rounded-md border border-[var(--glass-border)] shrink-0"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-xs text-text-secondary truncate">{label}</span>
        <code className="block text-[11px] text-text-tertiary" data-mono>
          {value?.toUpperCase()}
        </code>
      </span>
    </div>
  );
}

function ContrastRow({
  label,
  ratio,
  target,
}: {
  label: string;
  ratio: number;
  target: number;
}) {
  const passes = ratio >= target;
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--glass-border)]">
      <span className="text-xs text-text-secondary min-w-0 truncate">{label}</span>
      <span
        className={`shrink-0 flex items-center gap-1.5 text-xs font-medium tabular-nums ${
          passes ? 'text-success' : 'text-warning'
        }`}
      >
        {passes ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {ratio?.toFixed(2)}:1
      </span>
    </div>
  );
}

/** Squelette plutôt qu'un spinner : la forme de la page apparaît d'abord, le
 *  contenu la remplit. Un rond qui tourne au centre n'apprend rien. */
function ThemeSkeleton() {
  return (
    <div className="h-full overflow-hidden bg-surface-1">
      <div className="mx-auto max-w-4xl p-5 space-y-7 animate-pulse">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-surface-3" />
          <div className="h-3.5 w-72 rounded bg-surface-3" />
        </div>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-24 rounded-lg bg-surface-3" />
          ))}
        </div>
        <div className="h-10 rounded-lg bg-surface-3" />
        <div className="h-10 rounded-lg bg-surface-3" />
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-12 rounded-lg bg-surface-3" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThemePanel;
