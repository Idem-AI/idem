import { useFileStore } from '../WeIde/stores/fileStore';
import JSZip from 'jszip';
import { useTranslation } from 'react-i18next';
import useChatModeStore from '@/stores/chatModeSlice';
import { ChatMode } from '@/types/chat';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { sendToGitHub, getCurrentUser, getProjectById } from '@/api/persistence/db';
import useBillingStore from '@/stores/billingSlice';
import { openProjectPassCheckout } from '@/api/billing';
import { HelpButton } from './HelpButton';
import { DeployModal } from '../DeployModal/DeployModal';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { UserProfile } from './UserProfile';
import type { UserModel } from '@/api/persistence/userModel';
import {
  Rocket,
  MoreHorizontal,
  Download,
  Github,
  History,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import Popover from '@/components/ui/Popover';
import Button from '@/components/ui/Button';
import { VersionList } from './VersionHistory';
import {
  loadDeployment,
  persistDeployment,
  type AppDeployment,
} from '@/utils/netlifyDeployment';

// Add a helper function to recursively get all files
export function HeaderActions() {
  const { files } = useFileStore();
  const { t } = useTranslation();
  const { mode } = useChatModeStore();
  const [showDeployChoiceModal, setShowDeployChoiceModal] = useState(false);
  const [isSendingToGitHub, setIsSendingToGitHub] = useState(false);
  const [deployment, setDeployment] = useState<AppDeployment | null>(null);

  const handleDownload = async () => {
    // Télécharger le code est un acte de possession : il suppose un Project
    // Pass. Le serveur refuse de toute façon les actions qui comptent
    // (déploiement, GitHub) ; ce contrôle-ci évite surtout de laisser
    // l'utilisateur croire que c'est gratuit avant de buter dessus.
    if (!(await ensureProjectUnlocked())) return;

    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        // Pack the dist directory
        zip.file(path, content as string);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const { updateDraftFiles, updateDraftMetadata, draft } = useAppGenContextStore();
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);

  // Project this generation is attached to (set when coming from the dashboard).
  const projectId = new URLSearchParams(window.location.search).get('projectId');
  const draftId = draft?.id ?? null;

  const { checkProjectAccess } = useBillingStore();

  /**
   * Le projet est-il débloqué ?
   *
   * Trois issues, et la troisième compte autant que les autres :
   *  - débloqué → on continue ;
   *  - verrouillé → on envoie payer, avec retour ici ;
   *  - **inconnu** (API de facturation injoignable) → on laisse passer. Le
   *    serveur reste seul juge au moment d'agir ; bloquer sur une panne de
   *    facturation empêcherait de travailler sans rien protéger.
   */
  const ensureProjectUnlocked = async (): Promise<boolean> => {
    if (!projectId) {
      // Sans projet rattaché, aucun pass ne peut être acheté ni vérifié.
      toast.error(t('billing.locked.missingProject'));
      return false;
    }

    const unlocked = await checkProjectAccess(projectId);
    if (unlocked === false) {
      toast.error(t('billing.locked.title'));
      openProjectPassCheckout(projectId);
      return false;
    }

    return true;
  };

  useEffect(() => {
    getCurrentUser().then((user) => setCurrentUser(user));
  }, []);

  // Restore the Netlify site already used for this project/draft so the next
  // deploy updates it instead of spawning a brand new site.
  useEffect(() => {
    let cancelled = false;
    loadDeployment(projectId, draftId).then((existing) => {
      if (!cancelled && existing) setDeployment(existing);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, draftId]);

  // Ouvert depuis le tableau de bord avec `?publish=1` (« Mettre en ligne ») :
  // la fenêtre de mise en ligne s'ouvre d'elle-même, une seule fois.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('publish') !== '1') return;
    url.searchParams.delete('publish');
    window.history.replaceState(window.history.state, '', url.toString());
    setShowDeployChoiceModal(true);
  }, []);

  const handleDeployClick = () => {
    setShowDeployChoiceModal(true);
    // Sync current files into AppGen context before deploying
    updateDraftFiles(files as Record<string, string>);
  };

  // Le nom proposé pour l'application en ligne : celui du projet IDEM.
  const [projectName, setProjectName] = useState('');
  useEffect(() => {
    if (!projectId) return;
    getProjectById(projectId)
      .then((project) => setProjectName(project?.name ?? ''))
      .catch(() => undefined);
  }, [projectId]);

  /** Publié par iDeploy : on garde l'adresse et les applications pour la prochaine mise à jour. */
  const handlePublished = async (record: AppDeployment) => {
    setDeployment(record);
    updateDraftMetadata({ deployUrl: record.url });
    await persistDeployment(projectId, draftId, record);
    toast.success(t('deployModal.done.toast'));
  };

  const handleSendToGitHub = async () => {
    // Pousser sur GitHub est l'autre acte de possession du modèle iCode.
    if (!(await ensureProjectUnlocked())) return;

    setIsSendingToGitHub(true);

    try {
      // Get project ID from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('projectId');

      if (!projectId) {
        toast.error(t('header.github.no_project_id'));
        return;
      }

      // Prepare GitHub data with project files
      const githubData = {
        files: files,
        projectName: `project-${projectId}`,
        description: 'Project generated from we-dev-client',
        timestamp: new Date().toISOString(),
      };
      console.log('Sending to GitHub:', githubData);

      // await sendToGitHub(projectId, githubData);
      toast.success(t('header.github.success'));
    } catch (error) {
      console.error('Failed to send to GitHub:', error);
      toast.error(t('header.github.error_sending'));
    } finally {
      setIsSendingToGitHub(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {mode === ChatMode.Builder && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDeployClick}
            icon={<Rocket className="w-4 h-4" />}
          >
            {deployment ? t('header.redeploy') : t('header.deploy')}
          </Button>

          <Popover
            label={t('header.moreActions')}
            className="w-72"
            trigger={(triggerProps) => (
              <Button
                {...triggerProps}
                variant="icon"
                title={t('header.moreActions')}
                aria-label={t('header.moreActions')}
                icon={<MoreHorizontal className="w-4 h-4" />}
              />
            )}
          >
            {(close) => <ActionsMenu close={close} onDownload={handleDownload} onGitHub={handleSendToGitHub} sendingToGitHub={isSendingToGitHub} />}
          </Popover>
        </>
      )}

      <HelpButton />
      {currentUser && <UserProfile user={currentUser} />}

      <DeployModal
        open={showDeployChoiceModal}
        onClose={() => setShowDeployChoiceModal(false)}
        deployment={deployment}
        defaultName={projectName || 'mon-app'}
        onPublished={handlePublished}
      />

    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-9 px-3 flex items-center gap-2.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-left"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

function ActionsMenu({
  close,
  onDownload,
  onGitHub,
  sendingToGitHub,
}: {
  close: () => void;
  onDownload: () => void;
  onGitHub: () => void;
  sendingToGitHub: boolean;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState<'menu' | 'versions'>('menu');

  if (page === 'versions') {
    return (
      <div>
        <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--glass-border)]">
          <button
            type="button"
            onClick={() => setPage('menu')}
            aria-label={t('common.back')}
            className="w-7 h-7 grid place-items-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{t('versions.title')}</p>
            <p className="text-[11px] text-text-tertiary">{t('versions.hint')}</p>
          </div>
        </div>
        <VersionList onDone={close} />
      </div>
    );
  }

  return (
    <div className="py-1">
      <MenuItem
        icon={<History className="w-4 h-4" />}
        label={t('versions.title')}
        onClick={() => setPage('versions')}
        trailing={<ChevronRight className="w-4 h-4 text-text-disabled" />}
      />
      <div className="my-1 h-px bg-[var(--glass-border)]" />
      <MenuItem
        icon={<Download className="w-4 h-4" />}
        label={t('header.download')}
        onClick={() => {
          onDownload();
          close();
        }}
      />
      <MenuItem
        icon={<Github className="w-4 h-4" />}
        label={sendingToGitHub ? t('header.github.sending') : t('header.github.send')}
        disabled={sendingToGitHub}
        onClick={() => {
          onGitHub();
          close();
        }}
      />
    </div>
  );
}
