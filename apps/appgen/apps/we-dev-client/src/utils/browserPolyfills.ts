// Browser compatibility polyfills and error handling
export function initBrowserPolyfills() {
  // Handle MediaSession API errors
  if (typeof window !== "undefined" && "navigator" in window) {
    // Wrap MediaSession API calls to prevent errors
    const originalMediaSession = navigator.mediaSession;
    if (originalMediaSession) {
      const originalSetActionHandler = originalMediaSession.setActionHandler;
      if (originalSetActionHandler) {
        navigator.mediaSession.setActionHandler = function (
          action: any,
          handler: any,
        ) {
          try {
            // Check if the action is valid before calling
            const validActions = [
              "play",
              "pause",
              "stop",
              "seekbackward",
              "seekforward",
              "seekto",
              "previoustrack",
              "nexttrack",
              "skipad",
              "togglemicrophone",
              "togglecamera",
              "hangup",
            ];

            if (validActions.includes(action)) {
              return originalSetActionHandler.call(this, action, handler);
            } else {
              console.warn(`MediaSession: Invalid action '${action}' ignored`);
            }
          } catch (error) {
            console.warn("MediaSession API error:", error);
          }
        };
      }
    }
  }

  // Handle RefreshRuntime errors
  if (typeof window !== "undefined") {
    // Ensure RefreshRuntime is available for Vite HMR
    const windowAny = window as any;
    if (!windowAny.__vite_plugin_react_preamble_installed__) {
      windowAny.__vite_plugin_react_preamble_installed__ = true;

      // Create a minimal RefreshRuntime if it doesn't exist
      if (typeof windowAny.RefreshRuntime === "undefined") {
        windowAny.RefreshRuntime = {
          injectIntoGlobalHook: () => {},
          register: () => {},
          createSignatureFunctionForTransform: () => () => {},
          isLikelyComponentType: () => false,
          getFamilyByType: () => null,
          performReactRefresh: () => {},
        };
      }
    }
  }

  // Handle other potential browser compatibility issues
  if (typeof window !== "undefined") {
    // Polyfill for missing console methods
    if (!window.console) {
      window.console = {
        log: () => {},
        warn: () => {},
        error: () => {},
        info: () => {},
        debug: () => {},
      } as any;
    }

    // Handle picture-in-picture API errors
    if ("documentPictureInPicture" in document) {
      const originalRequestPictureInPicture = (document as any)
        .documentPictureInPicture?.requestWindow;
      if (originalRequestPictureInPicture) {
        (document as any).documentPictureInPicture.requestWindow = function (
          ...args: any[]
        ) {
          try {
            return originalRequestPictureInPicture.apply(this, args);
          } catch (error) {
            console.warn("Picture-in-Picture API error:", error);
            return Promise.reject(error);
          }
        };
      }
    }
  }
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandling() {
  if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
      // Suppress known browser extension errors
      if (
        event.error?.message?.includes("enterpictureinpicture") ||
        event.error?.message?.includes("RefreshRuntime") ||
        event.error?.message?.includes("MediaSession")
      ) {
        console.warn(
          "Suppressed browser compatibility error:",
          event.error?.message,
        );
        event.preventDefault();
        return false;
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      // Suppress known promise rejections from browser APIs
      if (
        event.reason?.message?.includes("MediaSession") ||
        event.reason?.message?.includes("picture-in-picture")
      ) {
        console.warn("Suppressed promise rejection:", event.reason?.message);
        event.preventDefault();
        return false;
      }
    });
  }
}
