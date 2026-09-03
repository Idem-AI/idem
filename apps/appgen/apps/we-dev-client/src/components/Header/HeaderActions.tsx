import { useFileStore } from '../WeIde/stores/fileStore';
import JSZip from 'jszip';
import { useTranslation } from 'react-i18next';
import useChatModeStore from '@/stores/chatModeSlice';
import { ChatMode } from '@/types/chat';
import useTerminalStore from '@/stores/terminalSlice';
import { getWebContainerInstance } from '../WeIde/services/webcontainer';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Modal } from 'antd';
import { sendToGitHub, getCurrentUser } from '@/api/persistence/db';
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
const getAllFiles = async (
  webcontainer: any,
  dirPath: string,
  zip: JSZip,
  baseDir: string = ''
) => {
  try {
    const entries = await webcontainer.fs.readdir(dirPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      try {
        if (entry.isDirectory()) {
          // If it's a directory, recursively process it
          await getAllFiles(webcontainer, fullPath, zip, `${baseDir}${entry.name}/`);
        } else {
          // If it's a file, read its content and add it to the zip
          const content = await webcontainer.fs.readFile(fullPath);
          const relativePath = `${baseDir}${entry.name}`;
          console.log('Adding file:', relativePath);
          zip.file(relativePath, content);
        }
      } catch (error) {
        console.error(`Failed to process file ${entry.name}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);

    // If it doesn't support withFileTypes, try the regular readdir
    const files = await webcontainer.fs.readdir(dirPath);

    for (const file of files) {
      const fullPath = `${dirPath}/${file}`;
      try {
        // Try to read the file content
        const content = await webcontainer.fs.readFile(fullPath);
        const relativePath = `${baseDir}${file}`;
        console.log('Adding file:', relativePath);
        zip.file(relativePath, content);
      } catch (error) {
        // If reading fails, it might be a directory, try recursively
        try {
          await getAllFiles(webcontainer, fullPath, zip, `${baseDir}${file}/`);
        } catch (dirError) {
          console.error(`Failed to process file/directory ${file}:`, dirError);
        }
      }
    }
  }
};

export function HeaderActions() {
  const { files } = useFileStore();
  const { t } = useTranslation();
  const { getTerminal, newTerminal, getEndTerminal } = useTerminalStore();
  const { mode } = useChatModeStore();
  const [showModal, setShowModal] = useState(false);
  const [showDeployChoiceModal, setShowDeployChoiceModal] = useState(false);
  const [deployUrl, setDeployUrl] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSendingToGitHub, setIsSendingToGitHub] = useState(false);
  const [deployment, setDeployment] = useState<AppDeployment | null>(null);
  const [isRedeploy, setIsRedeploy] = useState(false);

  const handleDownload = async () => {
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

  const handleDeployClick = () => {
    setShowDeployChoiceModal(true);
    // Sync current files into AppGen context before deploying
    updateDraftFiles(files as Record<string, string>);
  };

  const publishToNetlify = async () => {
    setIsDeploying(true);
    const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';

    try {
      const webcontainer = await getWebContainerInstance();

      newTerminal(async () => {
        const res = await getEndTerminal().executeCommand('npm run build');
        if (res.exitCode === 127) {
          await getEndTerminal().executeCommand('npm install');
          await getEndTerminal().executeCommand('npm run build');
        }

        try {
          const zip = new JSZip();

          // Use new recursive function to get all files
          await getAllFiles(webcontainer, 'dist', zip);

          // Generate and download zip file
          const blob = await zip.generateAsync({ type: 'blob' });
          const formData = new FormData();
          // Sent before the file so it is parsed even by streaming middlewares.
          const existing = await loadDeployment(projectId, draftId);
          if (existing?.siteId) {
            formData.append('siteId', existing.siteId);
          }
          formData.append('file', new File([blob], 'dist.zip', { type: 'application/zip' }));

          // Send request
          const response = await fetch(`${API_BASE}/api/deploy`, {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          console.log('Deploy API response:', data);

          if (data.success) {
            const nextDeployment: AppDeployment = {
              provider: 'netlify',
              siteId: data.siteId,
              siteName: data.siteName ?? null,
              url: data.url,
              adminUrl: data.adminUrl ?? null,
              deployId: data.deployId ?? null,
            };

            setDeployment(nextDeployment);
            setIsRedeploy(!data.isNewSite);
            setDeployUrl(data.url);
            setShowModal(true);
            updateDraftMetadata({ deployUrl: data.url });

            if (data.siteId) {
              await persistDeployment(projectId, draftId, nextDeployment);
            }

            toast.success(
              data.isNewSite ? t('header.deploySuccess') : t('header.redeploySuccess')
            );
          } else {
            console.error('Deploy failed:', data);
            const errorMessage = data.message || t('header.error.deploy_failed');
            toast.error(t('header.error.deploy_failed_with_msg', { message: errorMessage }));
          }
        } catch (error) {
          console.error('Failed to read dist directory:', error);
          toast.error(t('header.error.deploy_failed'));
        } finally {
          setIsDeploying(false);
        }
      });
    } catch (error) {
      console.error('Failed to deploy:', error);
      toast.error(t('header.error.deploy_failed'));
      setIsDeploying(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(deployUrl);
      toast.success(t('header.copied_link'));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSendToGitHub = async () => {
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
            loading={isDeploying}
            icon={<Rocket className="w-4 h-4" />}
          >
            {isDeploying
              ? t('header.deploying')
              : deployment
                ? t('header.redeploy')
                : t('header.deploy')}
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
        onNetlifyDeploy={publishToNetlify}
        liveUrl={deployment?.url ?? null}
      />

      {showModal && (
        <Modal
          open={showModal}
          onCancel={() => setShowModal(false)}
          footer={null}
          centered
          styles={{
            content: { backgroundColor: 'var(--color-bg-light)' },
            header: { backgroundColor: 'var(--color-bg-light)' },
          }}
        >
          <div className="text-center mb-6">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-text-primary">
              {isRedeploy ? t('header.redeploySuccess') : t('header.deploySuccess')}
            </h3>
            <p className="text-text-tertiary mt-2">
              {isRedeploy ? t('header.redeployToCloud') : t('header.deployToCloud')}
            </p>
          </div>

          <div className="bg-surface-2/50 border border-[var(--glass-border)] rounded-lg p-4 mb-6">
            <p className="text-sm text-text-tertiary mb-2">{t('header.accessLink')}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={deployUrl}
                readOnly
                className="flex-1 p-2 text-sm border border-[var(--glass-border)] rounded-lg bg-surface-1 text-text-primary focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-2 bg-gray-200 text-gray-900 hover:bg-surface-3 dark:text-white dark:hover:bg-gray-500 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                {t('header.copy')}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('header.close')}
            </button>
            <button
              onClick={() => window.open(deployUrl, '_blank')}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg hover:from-blue-700 hover:to-blue-900 transition-all flex items-center gap-2"
            >
              <span>{t('header.visitSite')}</span>
              <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          </div>
        </Modal>
      )}

      {/* Deploy Loading Modal */}
      {isDeploying && (
        <Modal
          open={isDeploying}
          footer={null}
          closable={false}
          centered
          width={400}
          className="deploy-loading-modal"
          styles={{
            content: { backgroundColor: 'var(--color-bg-light)' },

            body: {
              padding: '2rem',
            },
            header: {
              display: 'none',
            },
          }}
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t('header.deploy_modal.title')}</h3>
            <div className="flex justify-center items-center h-32">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500/30 border-t-blue-500"></div>
                <div className="absolute inset-0 rounded-full animate-pulse bg-blue-500/10 backdrop-blur-sm"></div>
              </div>
            </div>
            <p className="text-sm text-text-tertiary mt-4">
              {t('header.deploy_modal.loading_text')}
            </p>
          </div>
        </Modal>
      )}
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
