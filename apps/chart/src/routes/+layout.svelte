<script lang="ts">
  import { Toaster } from '$/components/ui/sonner/index.js';
  import { loadingStateStore } from '$/util/loading';
  import { toggleDarkTheme } from '$/util/state';
  import { readThemeCookie, writeThemeCookie } from '$/util/themeCookie';
  import { initHandler } from '$/util/util';
  import { base } from '$app/paths';
  import { mode, ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
  import { onMount, type Snippet } from 'svelte';
  import '../app.postcss';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  // Cross-app theme sync: the shared `idem_theme` cookie is the source of truth.
  // Guard against writing the cookie before the cookie→setMode boot step ran.
  let themeBooted = $state(false);

  // This can be removed once https://github.com/sveltejs/kit/issues/1612 is fixed.
  // Then move it into src and vite will bundle it automatically.
  onMount(() => {
    // Hide the initial global loader once Svelte is ready
    const hideInitialLoader = () => {
      const loader = document.querySelector('#initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
          loader.style.display = 'none';
        }, 300);
      }
    };

    // Hide loader after a short delay to ensure components are rendered
    setTimeout(hideInitialLoader, 150);

    // Apply the shared cross-app theme cookie (another Idem app may have set it),
    // then start syncing the user preference back to the cookie.
    const cookieTheme = readThemeCookie();
    if (cookieTheme && cookieTheme !== $userPrefersMode) {
      setMode(cookieTheme);
    }
    themeBooted = true;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const cookie = readThemeCookie();
      if (cookie && cookie !== $userPrefersMode) {
        setMode(cookie);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    window.addEventListener('hashchange', () => {
      void initHandler();
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`${base}/service-worker.js`, {
          scope: `${base}/`
        })
        .then(function (registration) {
          console.log('Registration successful, scope is:', registration.scope);
        })
        .catch(function (error) {
          console.log('Service worker registration failed, error:', error);
        });
    }
  });

  $effect(() => {
    toggleDarkTheme($mode === 'dark');
    // Update HTML class for theme-aware background
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', $mode === 'light');
    }
  });

  // Persist the user PREFERENCE (light/dark/system — not the resolved mode) to the
  // shared cookie so every existing setMode call site (MainMenu switch, edit page,
  // toolbar) propagates to the other Idem apps.
  $effect(() => {
    const pref = $userPrefersMode ?? 'system';
    if (themeBooted) {
      writeThemeCookie(pref);
    }
  });
</script>

<ModeWatcher />
<Toaster />

<main class="bg-background h-screen">
  {@render children()}
</main>

{#if $loadingStateStore.loading}
  <div
    class="absolute top-0 left-0 z-50 flex h-screen w-screen justify-center bg-gray-600 align-middle opacity-50">
    <div class="my-auto text-4xl font-bold text-indigo-100">
      <div class="loader mx-auto"></div>
      <div>{$loadingStateStore.message}</div>
    </div>
  </div>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Jura:wght@300..700&family=Raleway:ital,wght@0,100..900;1,100..900&display=swap');
  * {
    font-family: 'Jura', sans-serif;
  }
  .loader {
    border: 0.45em solid #f3f3f3;
    border-radius: 50%;
    border-top: 0.45em solid #6365f1;
    width: 3em;
    height: 3em;
    -webkit-animation: spin 2s linear infinite; /* Safari */
    animation: spin 2s linear infinite;
  }

  /* Safari */
  @-webkit-keyframes spin {
    0% {
      -webkit-transform: rotate(0deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
