/**
 * Fix for MediaSession API errors caused by browser extensions
 * This prevents the 'enterpictureinpicture' error which is not a valid MediaSessionAction
 */

// Store the original setActionHandler method
const originalSetActionHandler = navigator.mediaSession?.setActionHandler;

if (navigator.mediaSession && originalSetActionHandler) {
  // Valid MediaSession actions according to the spec
  const validActions = new Set([
    'nexttrack',
    'pause',
    'play',
    'previoustrack',
    'seekbackward',
    'seekforward',
    'seekto',
    'skipad',
    'stop',
  ]);

  // Override setActionHandler to filter out invalid actions
  navigator.mediaSession.setActionHandler = function (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) {
    if (validActions.has(action)) {
      return originalSetActionHandler.call(this, action, handler);
    } else {
      console.warn(`MediaSession: Ignoring invalid action "${action}"`);
      return;
    }
  };
}

export {};
