import { initializeTerminalComponent } from './terminal.js';

// Livewire 3 calls window.Echo.socketId() on every request.
// If Echo is defined but not properly initialized (no Pusher/Reverb setup),
// this throws TypeError and blocks ALL Livewire requests.
if (typeof window !== 'undefined' && window.Echo && typeof window.Echo.socketId !== 'function') {
    window.Echo = undefined;
}

['livewire:navigated', 'alpine:init'].forEach((event) => {
  document.addEventListener(event, () => {
    // tree-shaking
    if (document.getElementById('terminal-container')) {
      initializeTerminalComponent();
    }
  });
});
