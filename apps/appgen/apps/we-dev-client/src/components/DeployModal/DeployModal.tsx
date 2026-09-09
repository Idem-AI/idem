import { useCallback, useState, useEffect } from 'react';
import { Modal } from 'antd';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Copy, Check, ExternalLink } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import {
  PublishQuickIllustration,
  PublishPipelineIllustration,
} from '@/components/ui/Illustrations';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import useUserStore from '@/stores/userSlice';
import { redirectToLogin } from '@/hooks/useAuth';
import { getCurrentUser } from '@/api/persistence/db';
import type { UserModel } from '@/api/persistence/userModel';

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  onNetlifyDeploy: () => void;
  /** Adresse du site déjà en ligne, quand il y en a une. */
  liveUrl?: string | null;
}

const IDEPLOY_URL = process.env.REACT_APP_IDEPLOY_URL || 'http://localhost:8000';
const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';
const API_BASE = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

const HANDOFF_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function DeployModal({ open, onClose, onNetlifyDeploy, liveUrl }: DeployModalProps) {
  const { t } = useTranslation();
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLiveUrl = useCallback(async () => {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      // L'état revient de lui-même : un bouton qui reste « Copié » ne dit plus
      // rien au clic suivant.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('header.error'));
    }
  }, [liveUrl, t]);
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const { getHandoffPayload } = useAppGenContextStore();
  const { token } = useUserStore();

  useEffect(() => {
    if (open) {
      getCurrentUser().then((user) => setCurrentUser(user));
    }
  }, [open]);

  const handleNetlify = () => {
    onClose();
    onNetlifyDeploy();
  };

  const handleIdemDeploy = async () => {
    if (!currentUser) {
      redirectToLogin('deploy_idem');
      onClose();
      return;
    }

    const payload = getHandoffPayload();
    if (!payload) {
      toast.error(t('deployModal.no_generation'));
      return;
    }

    setIsHandingOff(true);
    try {
      const response = await fetch(`${API_BASE}/appgen/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          target: 'ideploy',
          expiresAt: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const { handoffId } = await response.json();
      onClose();
      window.location.href = `${IDEPLOY_URL}/deploy/from-appgen?handoffId=${handoffId}`;
    } catch (error) {
      console.error('Handoff failed:', error);
      // Fallback: pass payload via sessionStorage + redirect
      const payload = getHandoffPayload();
      if (payload) {
        sessionStorage.setItem(
          'appgen_handoff',
          JSON.stringify({
            ...payload,
            expiresAt: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
          })
        );
      }
      onClose();
      window.location.href = `${IDEPLOY_URL}/deploy/from-appgen?source=appgen`;
    } finally {
      setIsHandingOff(false);
    }
  };

  const handleConnectProject = () => {
    if (!currentUser) {
      redirectToLogin('connect_project');
      onClose();
      return;
    }

    const payload = getHandoffPayload();
    if (payload) {
      sessionStorage.setItem(
        'appgen_handoff',
        JSON.stringify({
          ...payload,
          target: 'dashboard',
          expiresAt: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
        })
      );
    }

    onClose();
    const encodedName = encodeURIComponent(payload?.appName || t('deployModal.default_app_name'));
    const encodedDesc = encodeURIComponent(payload?.description || '');
    window.location.href = `${DASHBOARD_URL}/create-project?from=appgen&name=${encodedName}&description=${encodedDesc}`;
  };


  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
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
        <header className="mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{t('deployModal.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">{t('deployModal.subtitle')}</p>
        </header>

        {/* Site déjà en ligne. C'est la première chose à voir quand on revient
            republier : l'adresse actuelle, ouvrable et copiable, plutôt qu'une
            information perdue dans une modale de succès déjà refermée. */}
        {liveUrl && (
          <section className="mb-5 rounded-xl border border-success/30 bg-success/8 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-2 rounded-full bg-success" aria-hidden />
              <span className="text-xs font-medium text-success">{t('deployModal.live')}</span>
            </div>

            <div className="flex items-center gap-2">
              <code
                className="flex-1 min-w-0 truncate px-3 h-9 flex items-center rounded-lg bg-surface-2 border border-[var(--glass-border)] text-xs text-text-secondary"
                data-mono
                title={liveUrl}
              >
                {liveUrl.replace(/^https?:\/\//, '')}
              </code>

              <Button
                variant="icon"
                onClick={copyLiveUrl}
                title={copied ? t('header.copied_link') : t('header.copy')}
                aria-label={t('header.copy')}
                icon={
                  copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )
                }
              />
              <ButtonLink
                variant="icon"
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                title={t('preview.openExternal')}
                aria-label={t('preview.openExternal')}
                icon={<ExternalLink className="w-4 h-4" />}
              />
            </div>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            illustration={<PublishQuickIllustration size={86} />}
            title={t('deployModal.quick_deploy_title')}
            subtitle={t('deployModal.quick_deploy_subtitle')}
            description={t('deployModal.quick_deploy_desc')}
            tags={[t('deployModal.tag_instant'), t('deployModal.tag_ssl'), t('deployModal.tag_cdn')]}
            onClick={handleNetlify}
            primary
            cta={liveUrl ? t('header.redeploy') : t('header.deploy')}
          />

          <OptionCard
            illustration={<PublishPipelineIllustration size={86} />}
            title={t('deployModal.idem_deploy_title')}
            subtitle={t('deployModal.idem_deploy_subtitle')}
            description={t('deployModal.idem_deploy_desc')}
            tags={[t('deployModal.tag_auto_project'), t('deployModal.tag_prefilled')]}
            onClick={handleIdemDeploy}
            loading={isHandingOff}
            cta={currentUser ? t('deployModal.open_pipeline') : t('deployModal.login_required')}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleConnectProject}
            className="text-left min-w-0"
          >
            <span className="block text-sm text-text-secondary hover:text-text-primary transition-colors truncate">
              {t('deployModal.connect_idem_title')}
            </span>
            <span className="block text-xs text-text-tertiary truncate">
              {t('deployModal.connect_idem_subtitle')}
            </span>
          </button>

          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('deployModal.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Une voie de publication.
 *
 * L'illustration porte la différence entre les deux options avant que le texte
 * ne soit lu : d'un côté l'application part telle quelle vers le web, de
 * l'autre elle traverse une chaîne de déploiement pour atterrir sur une
 * infrastructure que l'on possède.
 */
function OptionCard({
  illustration,
  title,
  subtitle,
  description,
  tags,
  onClick,
  cta,
  primary,
  loading,
}: {
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  onClick: () => void;
  cta: string;
  primary?: boolean;
  loading?: boolean;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-[var(--glass-border)] bg-surface-2 overflow-hidden">
      <div className="grid place-items-center py-4 bg-surface-3/40">{illustration}</div>

      <div className="flex-1 flex flex-col gap-2 p-4">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
          <p className="text-xs text-text-tertiary">{subtitle}</p>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed text-pretty">{description}</p>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-surface-3 text-[11px] text-text-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>

        <Button
          variant={primary ? 'primary' : 'secondary'}
          size="sm"
          onClick={onClick}
          loading={loading}
          className="mt-2 w-full"
        >
          {cta}
        </Button>
      </div>
    </article>
  );
}
