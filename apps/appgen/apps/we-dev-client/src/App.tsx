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
import { useAppInit } from './hooks/useAppInit';
import { Loading } from './components/loading';
import TopViewContainer from './components/TopView';

function App() {
  const { mode, initOpen } = useChatModeStore();
  const { openLoginModal, isAuthenticated } = useUserStore();
  const { isDarkMode } = useInit();

  // Gérer l'initialisation complète de l'application
  const { isInitialized, hasProject, projectId, projectData, error } = useAppInit();

  // Afficher le loader pendant l'initialisation
  if (!isInitialized) {
    return (
      <TopViewContainer>
        <div className={classNames('h-screen w-screen flex flex-col', { dark: isDarkMode })}>
          <Loading />
        </div>
      </TopViewContainer>
    );
  }

  // Afficher une erreur si l'initialisation a échoué
  if (error) {
    return (
      <TopViewContainer>
        <div
          className={classNames('h-screen w-screen flex flex-col items-center justify-center', {
            dark: isDarkMode,
          })}
        >
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Erreur d'initialisation</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </TopViewContainer>
    );
  }

  // Afficher l'interface principale si tout est initialisé

  return (
    <TopViewContainer>
      <GlobalLimitModal onLogin={openLoginModal} />
      <div
        className={classNames('h-screen w-screen flex flex-col ', {
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
