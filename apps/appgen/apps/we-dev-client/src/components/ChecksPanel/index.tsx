import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Check,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { useFileStore } from '../WeIde/stores/fileStore';
import Button from '@/components/ui/Button';

/* ------------------------------------------------------------------ */
/* Types miroirs des rapports serveur                                  */
/* ------------------------------------------------------------------ */

interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  line: number;
  excerpt: string;
  message: string;
  fix: string;
}

interface LintReport {
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  filesScanned: number;
  repairPrompt?: string;
}

interface SecurityFinding {
  rule: string;
  severity: 'critical' | 'high' | 'medium';
  file: string;
  line: number;
  excerpt: string;
  message: string;
  fix: string;
}

interface SecurityReport {
  findings: SecurityFinding[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  filesScanned: number;
  safeToPublish: boolean;
  repairPrompt?: string | null;
}

interface ChecksPanelProps {
  /** Envoie une consigne de réparation à la conversation. */
  onRepair?: (prompt: string) => void;
}

const apiBase = () => process.env.REACT_APP_BASE_URL || '';

/**
 * Contrôles du projet généré.
 *
 * Le linter de design tournait déjà à chaque génération, mais son rapport ne
 * servait qu'à fabriquer un prompt de réparation automatique : l'utilisateur
 * ne voyait jamais ce qui avait été trouvé, ni ce qui restait. Le scan de
 * sécurité, lui, n'existait pas.
 *
 * Les deux passes sont du calcul pur côté serveur — aucun appel modèle, donc
 * gratuites. Seule la réparation coûte, et seulement si on la demande.
 */
export function ChecksPanel({ onRepair }: ChecksPanelProps) {
  const { t } = useTranslation();
  const { files } = useFileStore();
  const [lint, setLint] = useState<LintReport | null>(null);
  const [security, setSecurity] = useState<SecurityReport | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');

  const run = useCallback(async () => {
    const payload = useFileStore.getState().files;
    if (!Object.keys(payload).length) {
      setLint(null);
      setSecurity(null);
      return;
    }

    setStatus('running');
    try {
      const [lintResponse, securityResponse] = await Promise.all([
        fetch(`${apiBase()}/api/quality/lint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: payload }),
        }),
        fetch(`${apiBase()}/api/quality/security`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: payload }),
        }),
      ]);

      setLint(lintResponse.ok ? await lintResponse.json() : null);
      setSecurity(securityResponse.ok ? await securityResponse.json() : null);
      setStatus('idle');
    } catch (error) {
      console.warn('[checks] analyse impossible', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    run();
    // Relancé quand le nombre de fichiers change : une nouvelle génération
    // invalide le rapport précédent.
  }, [run, Object.keys(files).length]);

  const hasFiles = Object.keys(files).length > 0;

  if (!hasFiles) {
    return (
      <EmptyState
        icon={<ShieldCheck className="w-7 h-7 text-text-disabled" />}
        title={t('checks.emptyTitle')}
        body={t('checks.emptyBody')}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto motif-pass-through">
      <div className="mx-auto max-w-3xl p-5 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('checks.title')}</h2>
            <p className="mt-1 text-sm text-text-secondary max-w-prose">{t('checks.subtitle')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={run}
            disabled={status === 'running'}
            className="shrink-0"
            icon={<RefreshCw className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''}`} />}
          >
            {t('checks.rerun')}
          </Button>
        </header>

        {/* -------- Sécurité en premier : c'est ce qui bloque la publication -------- */}
        <Group
          icon={
            security?.safeToPublish ? (
              <ShieldCheck className="w-4 h-4 text-success" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-danger" />
            )
          }
          title={t('checks.security')}
          summary={
            security
              ? security.findings.length === 0
                ? t('checks.securityClean')
                : t('checks.securityCount', {
                    critical: security.criticalCount,
                    high: security.highCount,
                    medium: security.mediumCount,
                  })
              : t('checks.pending')
          }
          tone={security?.safeToPublish === false ? 'danger' : 'ok'}
          action={
            security?.repairPrompt && onRepair
              ? {
                  label: t('checks.fixSecurity'),
                  onClick: () => onRepair(security.repairPrompt as string),
                }
              : undefined
          }
        >
          {security?.findings.map((finding, index) => (
            <FindingRow
              key={`${finding.rule}-${finding.file}-${finding.line}-${index}`}
              file={finding.file}
              line={finding.line}
              message={finding.message}
              fix={finding.fix}
              excerpt={finding.excerpt}
              tone={finding.severity === 'medium' ? 'warning' : 'danger'}
              badge={t(`checks.severity.${finding.severity}`)}
            />
          ))}
        </Group>

        {/* -------- Design -------- */}
        <Group
          icon={
            lint && lint.errorCount === 0 && lint.warningCount === 0 ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Sparkles className="w-4 h-4 text-warning" />
            )
          }
          title={t('checks.design')}
          summary={
            lint
              ? lint.violations.length === 0
                ? t('checks.designClean')
                : t('checks.designCount', {
                    errors: lint.errorCount,
                    warnings: lint.warningCount,
                  })
              : t('checks.pending')
          }
          tone={lint && lint.errorCount > 0 ? 'warning' : 'ok'}
          action={
            lint?.repairPrompt && onRepair
              ? { label: t('checks.fixDesign'), onClick: () => onRepair(lint.repairPrompt as string) }
              : undefined
          }
        >
          {lint?.violations.map((violation, index) => (
            <FindingRow
              key={`${violation.rule}-${violation.file}-${violation.line}-${index}`}
              file={violation.file}
              line={violation.line}
              message={violation.message}
              fix={violation.fix}
              excerpt={violation.excerpt}
              tone={violation.severity === 'error' ? 'warning' : 'muted'}
              badge={violation.rule}
            />
          ))}
        </Group>

        {status === 'error' && (
          <p className="text-sm text-text-tertiary">{t('checks.error')}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Group({
  icon,
  title,
  summary,
  tone,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  tone: 'ok' | 'warning' | 'danger';
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;

  return (
    <section className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-2">
        {icon}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p
            className={`text-xs ${
              tone === 'danger'
                ? 'text-danger'
                : tone === 'warning'
                  ? 'text-warning'
                  : 'text-text-tertiary'
            }`}
          >
            {summary}
          </p>
        </div>
        {action && (
          <Button
            variant="primary"
            size="sm"
            onClick={action.onClick}
            className="shrink-0"
            icon={<Wrench className="w-3.5 h-3.5" />}
          >
            {action.label}
          </Button>
        )}
      </div>

      {hasChildren && <ul className="divide-y divide-[var(--glass-border)]">{children}</ul>}
    </section>
  );
}

function FindingRow({
  file,
  line,
  message,
  fix,
  excerpt,
  tone,
  badge,
}: {
  file: string;
  line: number;
  message: string;
  fix: string;
  excerpt: string;
  tone: 'danger' | 'warning' | 'muted';
  badge: string;
}) {
  const open = () => window.dispatchEvent(new CustomEvent('openFile', { detail: { path: file, line } }));

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
            tone === 'danger'
              ? 'bg-danger/12 text-danger'
              : tone === 'warning'
                ? 'bg-warning/12 text-warning'
                : 'bg-surface-3 text-text-tertiary'
          }`}
        >
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-text-primary">{message}</p>
          <p className="mt-0.5 text-xs text-text-secondary text-pretty">{fix}</p>
          <button
            type="button"
            onClick={open}
            className="mt-1.5 text-[11px] text-text-tertiary hover:text-primary transition-colors"
            data-mono
          >
            {file}:{line}
          </button>
          {excerpt && (
            <pre
              className="mt-1 px-2 py-1 rounded bg-surface-2 text-[11px] text-text-tertiary overflow-x-auto"
              data-mono
            >
              {excerpt}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="h-full grid place-items-center p-6 motif-pass-through">
      <div className="max-w-xs text-center space-y-2">
        {icon}
        <p className="text-sm text-text-secondary">{title}</p>
        <p className="text-xs text-text-tertiary text-pretty">{body}</p>
      </div>
    </div>
  );
}

export default ChecksPanel;
