import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { getCurrentUser } from '@/api/persistence/db';
import type { UserModel } from '@/api/persistence/userModel';
import { UserProfile } from '../Header/UserProfile';
import { redirectToLogin } from '@/hooks/useAuth';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';

interface AppGenLandingProps {
  onStart: (prompt?: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Une application de gestion de tontines pour les communautés africaines',
  'Un dashboard de suivi des livraisons pour un e-commerce à Dakar',
  'Une landing page pour une startup fintech à Lagos',
  'Une plateforme de mise en relation entre freelances et entreprises à Abidjan',
];

export function AppGenLanding({ onStart }: AppGenLandingProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const { initDraft } = useAppGenContextStore();

  useEffect(() => {
    getCurrentUser().then((user) => setCurrentUser(user));
  }, []);

  const handleStart = (prompt?: string) => {
    const finalPrompt = prompt || inputValue.trim() || undefined;
    if (!currentUser) {
      // Save prompt so we can restore it after login redirect
      if (finalPrompt) {
        localStorage.setItem(PENDING_PROMPT_KEY, finalPrompt);
      }
      redirectToLogin('generate');
      return;
    }
    initDraft();
    onStart(finalPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) handleStart();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111] text-white px-4 py-12">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-3 bg-[#111]/80 backdrop-blur border-b border-white/5 z-10">
        <div className="flex items-center gap-2">
          <img src="/assets/icons/logo_white.png" alt="logo" className="w-6 h-auto" />
          <span className="text-sm font-bold tracking-tight">APPGEN</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border border-gray-700 rounded-full px-2 py-0.5">
            by Idem
          </span>
        </div>
        <div>
          {currentUser ? (
            <UserProfile user={currentUser} />
          ) : (
            <a
              href={`${process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200'}/login?from=appgen`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Se connecter
            </a>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 mt-14">
        <img src="/assets/icons/logo_white.png" alt="logo" className="w-10 h-auto" />
        <span className="text-2xl font-bold tracking-tight">APPGEN</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 border border-gray-700 rounded-full px-2 py-0.5 ml-1">
          by Idem
        </span>
      </div>

      {/* Hero */}
      <div className="text-center max-w-2xl mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
          Générez votre application en quelques secondes
        </h1>
        <p className="text-gray-400 text-lg">
          Décrivez votre idée, AppGen s'occupe du reste. Sans compte requis pour commencer.
        </p>
      </div>

      {/* Input */}
      <div className="w-full max-w-2xl mb-6">
        <div className="relative glass-card rounded-2xl border border-white/10 overflow-hidden">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Décrivez l'application que vous voulez créer..."
            rows={3}
            className="w-full bg-transparent text-white placeholder-gray-500 text-base p-4 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <span className="text-xs text-gray-600">Appuyez sur Entrée pour commencer</span>
            <button
              onClick={() => handleStart()}
              disabled={!inputValue.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                inputValue.trim() ? 'inner-button' : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Générer
            </button>
          </div>
        </div>
      </div>

      {/* Example prompts */}
      <div className="w-full max-w-2xl mb-12">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Exemples</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleStart(prompt)}
              className="text-left text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-xl px-4 py-3 transition-all duration-200 truncate"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-10">
        {[
          {
            icon: (
              <svg
                className="w-5 h-5 text-blue-400"
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
            ),
            title: 'Génération instantanée',
            desc: 'Code prêt à déployer en secondes',
          },
          {
            icon: (
              <svg
                className="w-5 h-5 text-purple-400"
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
            ),
            title: 'Déploiement en 1 clic',
            desc: 'Netlify ou Idem Deploy',
          },
          {
            icon: (
              <svg
                className="w-5 h-5 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            ),
            title: 'Connecté à votre workspace',
            desc: 'Intégration native Idem',
          },
        ].map((feat, i) => (
          <div key={i} className="glass-card rounded-2xl p-4 border border-white/5">
            <div className="mb-2">{feat.icon}</div>
            <div className="text-sm font-semibold text-white mb-1">{feat.title}</div>
            <div className="text-xs text-gray-500">{feat.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA auth */}
      <div className="text-center text-sm text-gray-500">
        <span>Vous avez un compte Idem ? </span>
        <a
          href={`${process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200'}/login?from=appgen`}
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          Se connecter
        </a>
        <span> pour sauvegarder vos projets</span>
      </div>
    </div>
  );
}

export default AppGenLanding;
