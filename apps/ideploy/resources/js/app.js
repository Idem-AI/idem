import { initializeTerminalComponent } from './terminal.js';
import './auth-check.js';

['livewire:navigated', 'alpine:init'].forEach((event) => {
  document.addEventListener(event, () => {
    // tree-shaking
    if (document.getElementById('terminal-container')) {
      initializeTerminalComponent();
    }
  });
});
