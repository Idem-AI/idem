import { useState, useEffect } from 'react';
import { Modal } from 'antd';
import { toast } from 'react-toastify';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import useUserStore from '@/stores/userSlice';
import { redirectToLogin } from '@/hooks/useAuth';
import { getCurrentUser } from '@/api/persistence/db';
import type { UserModel } from '@/api/persistence/userModel';

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  onNetlifyDeploy: () => void;
}

const IDEPLOY_URL = process.env.REACT_APP_IDEPLOY_URL || 'http://localhost:8000';
const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';
const API_BASE = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

const HANDOFF_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function DeployModal({ open, onClose, onNetlifyDeploy }: DeployModalProps) {
  const [isHandingOff, setIsHandingOff] = useState(false);
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
      toast.error('Aucune génération disponible à déployer');
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
    const encodedName = encodeURIComponent(payload?.appName || 'Mon Application');
    const encodedDesc = encodeURIComponent(payload?.description || '');
    window.location.href = `${DASHBOARD_URL}/create-project?from=appgen&name=${encodedName}&description=${encodedDesc}`;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={620}
      styles={{
        content: {
          backgroundColor: '#1a1f2e',
          padding: 0,
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
        },
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Déployer votre application</h3>
          <p className="text-sm text-gray-400">Choisissez comment vous souhaitez déployer</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Quick deploy - Netlify */}
          <button
            onClick={handleNetlify}
            className="group relative rounded-2xl bg-gradient-to-br from-[#1e2535] to-[#1a1f2e] border border-white/10 p-5 text-left hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white group-hover:text-blue-400 transition-colors text-sm">
                  Déploiement rapide
                </h4>
                <span className="text-xs text-gray-500">Netlify · Sans compte requis</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Déployez instantanément avec CDN global et SSL automatique.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 text-xs bg-blue-900/40 text-blue-300 rounded-md">
                Instantané
              </span>
              <span className="px-2 py-0.5 text-xs bg-blue-900/40 text-blue-300 rounded-md">
                SSL auto
              </span>
              <span className="px-2 py-0.5 text-xs bg-blue-900/40 text-blue-300 rounded-md">
                CDN global
              </span>
            </div>
          </button>

          {/* iDeploy */}
          <button
            onClick={handleIdemDeploy}
            disabled={isHandingOff}
            className="group relative rounded-2xl bg-gradient-to-br from-[#1e2535] to-[#1a1f2e] border border-white/10 p-5 text-left hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isHandingOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl z-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500/30 border-t-purple-500" />
              </div>
            )}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white group-hover:text-purple-400 transition-colors text-sm">
                  Déploiement avec Idem
                </h4>
                <span className="text-xs text-gray-500">iDeploy · Projet auto-configuré</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Votre application est transférée vers iDeploy avec toutes les métadonnées. Prête à
              déployer.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 text-xs bg-purple-900/40 text-purple-300 rounded-md">
                Projet auto
              </span>
              <span className="px-2 py-0.5 text-xs bg-purple-900/40 text-purple-300 rounded-md">
                Données pré-remplies
              </span>
            </div>
            {!currentUser && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>Connexion requise</span>
              </div>
            )}
          </button>
        </div>

        {/* Connect to project */}
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={handleConnectProject}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Connecter à un projet Idem</p>
                <p className="text-xs text-gray-500">Créer ou associer à un projet existant</p>
              </div>
            </div>
            <svg
              className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Cancel */}
        <div className="flex justify-center mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default DeployModal;
