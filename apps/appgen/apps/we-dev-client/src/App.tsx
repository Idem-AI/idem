import { useState, useEffect } from 'react';
import useUserStore from './stores/userSlice';
import useChatModeStore from './stores/chatModeSlice';
import { GlobalLimitModal } from './components/UserModal';
import Header from './components/Header';
import AiChat from './components/AiChat';
import EditorPreviewTabs from './components/EditorPreviewTabs';
import './utils/i18';
import classNames from 'classnames';
import { ChatMode } from './types/chat';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UpdateTip } from './components/UpdateTip';
import useInit from './hooks/useInit';
import { Loading } from './components/loading';
import TopViewContainer from './components/TopView';
import { AppGenLanding } from './components/Landing/AppGenLanding';
import useAppGenContextStore from './stores/appgenContextSlice';
import { consumePendingContext } from './hooks/useAuth';
import { getCurrentUser } from './api/persistence/db';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';

// View states managed by App
type AppView = 'loading' | 'landing' | 'chat';

function App() {
  const { mode, initOpen } = useChatModeStore();
  const { openLoginModal, isAuthenticated } = useUserStore();
  const { isDarkMode } = useInit();
  const { initDraft, setPendingIntent, updateDraftMetadata } = useAppGenContextStore();

  const [view, setView] = useState<AppView>('loading');

  useEffect(() => {
    // URL params take priority — preserve all existing workflows
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    const fromParam = urlParams.get('from');
    const promptParam = urlParams.get('prompt');

    // Restore AppGen context if returning from login redirect
    const pendingCtx = consumePendingContext();
    if (pendingCtx?.intent) {
      setPendingIntent(pendingCtx.intent);
    }

    initDraft();

    // Skip landing entirely for existing workflows:
    // - projectId: linked from main-dashboard
    // - prompt: coming from landing start
    // - from=dashboard / from=appgen: returning after auth (restore pending prompt if any)
    if (projectId || promptParam || fromParam === 'dashboard' || fromParam === 'appgen') {
      // If returning from login with a pending prompt, inject it via URL param
      if (!promptParam) {
        const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
        if (pendingPrompt) {
          localStorage.removeItem(PENDING_PROMPT_KEY);
          const url = new URL(window.location.href);
          url.searchParams.set('prompt', encodeURIComponent(pendingPrompt));
          window.history.replaceState({}, '', url.toString());
        }
      }
      setView('chat');
      return;
    }

    // Use the same auth check as AuthWrapper: getCurrentUser() via session cookie
    getCurrentUser().then((user) => {
      setView(user ? 'chat' : 'landing');
    });
  }, []);

  // When user logs in via the login modal, switch from landing to chat
  useEffect(() => {
    if (isAuthenticated && view === 'landing') {
      setView('chat');
    }
  }, [isAuthenticated]);

  const handleLandingStart = (prompt?: string) => {
    updateDraftMetadata({});
    if (prompt) {
      const url = new URL(window.location.href);
      url.searchParams.set('prompt', encodeURIComponent(prompt));
      window.history.replaceState({}, '', url.toString());
    }
    setView('chat');
  };

  // Minimal loading screen while checking auth
  if (view === 'loading') {
    return (
      <div
        className={classNames('h-screen w-screen flex items-center justify-center bg-[#111]', {
          dark: isDarkMode,
        })}
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/icons/logo_white.png"
            alt="logo"
            className="w-12 h-auto animate-pulse"
          />
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Landing page — non-authenticated entry point
  if (view === 'landing') {
    return (
      <div className={classNames({ dark: isDarkMode })}>
        <AppGenLanding onStart={handleLandingStart} />
        <ToastContainer
          position="top-center"
          autoClose={2000}
          theme="colored"
          style={{ zIndex: 100000 }}
        />
      </div>
    );
  }

  // Chat — full app (authenticated or projectId workflow)
  return (
    <TopViewContainer>
      <GlobalLimitModal onLogin={openLoginModal} />
      <div
        className={classNames('h-screen w-screen flex flex-col', {
          dark: isDarkMode,
        })}
      >
        <Header />
        <div className="flex flex-row w-full h-full max-h-[calc(100%-48px)] bg-white dark:bg-[#111]">
          <AiChat />
          {mode === ChatMode.Builder && !initOpen && <EditorPreviewTabs />}
        </div>
      </div>
      <UpdateTip />
      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        style={{
          zIndex: 100000,
        }}
      />
      <Loading />
    </TopViewContainer>
  );
}

export default App;
