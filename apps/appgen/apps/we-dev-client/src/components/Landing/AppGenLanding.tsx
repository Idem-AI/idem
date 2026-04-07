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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 border border-primary/40 rounded-xl flex items-center justify-center">
              <svg
                className="w-4 h-4 text-primary"
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
            <span className="text-lg font-bold tracking-tight">EON</span>
          </div>
          <div>
            {currentUser ? (
              <UserProfile user={currentUser} />
            ) : (
              <button
                onClick={() =>
                  (window.location.href = `${process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200'}/login?from=appgen`)
                }
                className="outer-button button-sm"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent leading-tight">
            Build apps with AI
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Describe your idea, EON generates production-ready code in seconds
          </p>

          {/* Input */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="A dashboard for tracking deliveries in Dakar..."
                rows={3}
                className="w-full bg-transparent text-white placeholder-gray-500 text-lg p-6 resize-none focus:outline-none"
              />
              <div className="flex items-center justify-between px-6 pb-4">
                <span className="text-sm text-gray-600">Press Enter to start</span>
                <button
                  onClick={() => handleStart()}
                  disabled={!inputValue.trim()}
                  className="inner-button button-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Generate
                </button>
              </div>
            </div>
          </div>

          {/* Example prompts */}
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-gray-500 mb-4">Try these examples</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleStart(prompt)}
                  className="text-left text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/20 rounded-xl px-5 py-4 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">See it in action</h2>
            <p className="text-xl text-gray-400">From idea to deployment in minutes</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Screenshot 1 */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden group">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
                  alt="Dashboard analytics"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Real-time analytics</h3>
                <p className="text-gray-400">
                  Beautiful dashboards generated with your data structure
                </p>
              </div>
            </div>

            {/* Screenshot 2 */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden group">
              <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
                  alt="Business dashboard"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Business tools</h3>
                <p className="text-gray-400">CRM, inventory, and management systems</p>
              </div>
            </div>

            {/* Screenshot 3 */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden group">
              <div className="aspect-video bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop"
                  alt="Team collaboration"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Collaboration</h3>
                <p className="text-gray-400">Team workspaces and project management</p>
              </div>
            </div>

            {/* Screenshot 4 */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden group">
              <div className="aspect-video bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop"
                  alt="Mobile responsive"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Mobile-first</h3>
                <p className="text-gray-400">Responsive design for all devices</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-4 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for speed</h2>
            <p className="text-xl text-gray-400">Production-ready code in seconds</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Instant generation',
                desc: 'AI-powered code generation with modern frameworks',
              },
              {
                title: 'One-click deploy',
                desc: 'Deploy to Netlify or iDeploy instantly',
              },
              {
                title: 'Full customization',
                desc: 'Edit and iterate with real-time preview',
              },
            ].map((feat, i) => (
              <div key={i} className="glass-card rounded-2xl p-8 border border-white/10">
                <h3 className="text-xl font-semibold mb-3">{feat.title}</h3>
                <p className="text-gray-400">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Start building today</h2>
          <p className="text-xl text-gray-400 mb-8">No credit card required</p>
          <button
            onClick={() =>
              (window.location.href = `${process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200'}/login?from=appgen`)
            }
            className="inner-button button-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Get started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Powered by Idem</p>
        </div>
      </footer>
    </div>
  );
}

export default AppGenLanding;
