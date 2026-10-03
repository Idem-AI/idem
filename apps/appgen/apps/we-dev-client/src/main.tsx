import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../global.css";
import { rememberProductChoice } from "./utils/product";
import {
  initBrowserPolyfills,
  setupGlobalErrorHandling,
} from "./utils/browserPolyfills";

// Initialize browser compatibility fixes
initBrowserPolyfills();
setupGlobalErrorHandling();

// Avant le premier rendu : l'atelier lit le site / l'application, web / mobile,
// dans l'adresse, qu'une redirection a pu vider.
rememberProductChoice();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
