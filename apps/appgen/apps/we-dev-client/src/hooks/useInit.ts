import useThemeStore from '@/stores/themeSlice';
import useUserStore from '@/stores/userSlice';
import i18n from '@/utils/i18';
import { useEffect } from 'react';
import useMCPStore from '@/stores/useMCPSlice';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';

// Version web - pas d'accès à Electron
const useInit = (): { isDarkMode: boolean } => {
  const { isDarkMode, setTheme } = useThemeStore();
  const { fetchUser, closeLoginModal } = useUserStore();
  const servers = useMCPStore((state) => state.servers);
  useEffect(() => {
    // Version web - pas d'envoi vers MCP
    console.log('MCP servers not available in web mode');
  }, []);

  // Copy optimization
  useEffect(() => {
    // Broadcast channel for cross-tab login sync
    const fetchUserInfo = async () => {
      const token =
        localStorage.getItem('token') ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem('user-storage') || '{}')?.state?.token;
          } catch {
            return null;
          }
        })();
      if (token) fetchUser();
    };

    const channel = new BroadcastChannel('login_channel');

    // Auto-trigger prompt from URL (set by AppGen landing page)
    const urlParams = new URLSearchParams(window.location.search);
    const promptParam = urlParams.get('prompt');
    if (promptParam) {
      const decoded = decodeURIComponent(promptParam);
      // Remove prompt from URL to avoid re-triggering on refresh
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('prompt');
      window.history.replaceState({}, '', cleanUrl.toString());
      // Emit to chat after a short delay to let the app mount
      setTimeout(() => {
        eventEmitter.emit('chat:autoPrompt', decoded);
      }, 500);
    }

    // Check isLogin parameter in URL
    const isLogin = urlParams.get('isLogin') === 'true';

    // Check if it's the main page
    const isMainPage = !window.location.search.includes('isLogin=true');

    if (isLogin) {
      // If it's the login page, first check if main page exists
      channel.postMessage({ type: 'CHECK_MAIN_PAGE' });

      // Set timeout to wait for main page response
      const timeout = setTimeout(() => {
        // If no response received within timeout, main page doesn't exist
        channel.postMessage({ type: 'LOGIN_SUCCESS' });
      }, 1000);

      // Listen for main page response
      channel.onmessage = (event) => {
        if (event.data.type === 'MAIN_PAGE_EXISTS') {
          clearTimeout(timeout);
          // Main page exists, send login success message and close current page
          channel.postMessage({ type: 'LOGIN_SUCCESS' });
          window.close();
        }
      };
    } else {
      // If it's the main page, listen for messages
      channel.onmessage = (event) => {
        if (event.data.type === 'CHECK_MAIN_PAGE') {
          // Respond to check request
          channel.postMessage({ type: 'MAIN_PAGE_EXISTS' });
        } else if (event.data.type === 'LOGIN_SUCCESS') {
          // Execute user info fetch operation
          closeLoginModal();
          fetchUserInfo();
        }
      };
    }

    // Version web - pas d'accès au système de fichiers local
    console.log('Local filesystem not available in web mode');

    const settingsConfig = JSON.parse(localStorage.getItem('settingsConfig') || '{}');
    if (settingsConfig.language) {
      i18n.changeLanguage(settingsConfig.language);
    } else {
      // Get browser language settings
      const browserLang = navigator.language.toLowerCase();
      // If Chinese environment (including simplified and traditional), set to Chinese, otherwise set to English
      const defaultLang = browserLang.startsWith('zh') ? 'zh' : 'en';

      i18n.changeLanguage(defaultLang);
      // Save to local settings
    }

    // Version web - pas de gestion de proxy système
    if (settingsConfig.proxyType) {
      console.log('Proxy settings not available in web mode');
    }

    // Initialize user info to ensure user-related tables are created

    const callback = (event: ClipboardEvent) => {
      try {
        navigator.clipboard.writeText(window.getSelection().toString().trim()).then(() => {});
        event.preventDefault();
      } catch (e) {}
    };
    document.addEventListener('copy', callback);

    return () => document.removeEventListener('copy', callback);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme') || 'system';
    if (savedTheme !== 'system') {
      setTheme(savedTheme === 'dark');
    } else {
      setTheme(mql.matches);
    }

    const handleStorageChange = () => {
      if (savedTheme === 'system') {
        setTheme(mql.matches);
      }
    };
    mql.addEventListener('change', handleStorageChange);
    return () => {
      mql.removeEventListener('change', handleStorageChange);
    };
  }, [isDarkMode]);

  return { isDarkMode };
};

export default useInit;
