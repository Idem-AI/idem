import { initializeTerminalComponent } from './terminal.js';
import './idem-auth.js';

['livewire:navigated', 'alpine:init'].forEach((event) => {
  document.addEventListener(event, () => {
    // tree-shaking
    if (document.getElementById('terminal-container')) {
      initializeTerminalComponent();
    }
  });
});
