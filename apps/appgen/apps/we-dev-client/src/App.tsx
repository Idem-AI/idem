import { useState, useEffect, useRef } from 'react';
import useUserStore from './stores/userSlice';
import useChatModeStore from './stores/chatModeSlice';
import { GlobalLimitModal } from './components/UserModal';
import Header from './components/Header';
import AiChat from './components/AiChat';
import Workspace from './components/Workspace';
import { WorkspaceShell } from './components/Workspace/WorkspaceShell';
import './utils/i18';
import { ChatMode } from './types/chat';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UpdateTip } from './components/UpdateTip';
import useInit from './hooks/useInit';
import { Loading } from './components/loading';
import TopViewContainer from './components/TopView';
import { AppGenLanding } from './components/Landing/AppGenLanding';
import { BrandMark } from './components/Brand';
import useAppGenContextStore from './stores/appgenContextSlice';
import { consumePendingContext } from './hooks/useAuth';
import { AuthSync } from './components/Auth/AuthSync';
import { useTour } from './hooks/useTour';
import { eventEmitter } from './components/AiChat/utils/EventEmitter';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';

// View states managed by App
type AppView = 'loading' | 'landing' | 'chat';

function App() {
  const { mode, initOpen } = useChatModeStore();
  const { openLoginModal } = useUserStore();
  useInit();
  const { initDraft, setPendingIntent, updateDraftMetadata } = useAppGenContextStore();

  const [view, setView] = useState<AppView>('loading');

  // Visite guidée de première utilisation, une fois la vue principale montée.
  useTour(view === 'chat');

  // Le choix de la vue initiale consomme l'intention laissée avant le login :
  // il ne doit se faire qu'une fois. Sans cette garde, le double passage des
  // effets en StrictMode consommait l'intention au premier et renvoyait sur la
  // landing au second.
  const initialViewResolved = useRef(false);

  useEffect(() => {
    if (initialViewResolved.current) return;
    initialViewResolved.current = true;

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

    // La landing est la page d'accueil pour tout le monde, connecté ou non :
    // un utilisateur connecté y voit son profil en haut, et n'entre dans
    // l'atelier que lorsqu'il le demande (« Commencer », ou « Ouvrir le chat »
    // dans le menu du profil).
    //
    // L'atelier s'ouvre directement seulement quand la demande est déjà faite :
    // - projectId : lien « Générer » depuis un projet du dashboard ;
    // - prompt : demande transmise dans l'URL ;
    // - from=dashboard / from=appgen : parcours explicites existants ;
    // - intention en attente : l'utilisateur avait cliqué sur « Commencer »
    //   avant de se connecter, il revient ici après le login. On se fie à
    //   l'intention (posée au départ vers le login, valable 30 min, consommée
    //   au retour) et non à la seule demande en attente, qui reste stockée si
    //   la personne ferme la fenêtre de connexion sans se connecter.
    const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
    const resumesStart = Boolean(pendingCtx?.intent);

    if (
      projectId ||
      promptParam ||
      fromParam === 'dashboard' ||
      fromParam === 'appgen' ||
      resumesStart
    ) {
      // La demande mise de côté avant le login est rejouée via l'URL.
      if (!promptParam && pendingPrompt) {
        localStorage.removeItem(PENDING_PROMPT_KEY);
        const url = new URL(window.location.href);
        url.searchParams.set('prompt', encodeURIComponent(pendingPrompt));
        window.history.replaceState({}, '', url.toString());
      }
      setView('chat');
      return;
    }

    setView('landing');
  }, []);

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
      <div className="h-screen w-screen flex items-center justify-center bg-bg-darker">
        <div className="flex flex-col items-center gap-5">
          <BrandMark size={56} className="animate-pulse" />
          <div className="w-5 h-5 border-2 border-[var(--glass-border-strong)] border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Landing page — non-authenticated entry point
  if (view === 'landing') {
    return (
      <div>
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
      <AuthSync />
      <GlobalLimitModal onLogin={openLoginModal} />
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-darker">
        <Header />
        <WorkspaceShell
          hasWorkspace={mode === ChatMode.Builder && !initOpen}
          chat={<AiChat />}
          workspace={
            <Workspace onSendToChat={(text) => eventEmitter.emit('chat:prefill', text)} />
          }
        />
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
