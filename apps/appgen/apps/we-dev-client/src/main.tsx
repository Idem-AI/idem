import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../global.css";
import {
  initBrowserPolyfills,
  setupGlobalErrorHandling,
} from "./utils/browserPolyfills";

// Initialize browser compatibility fixes
initBrowserPolyfills();
setupGlobalErrorHandling();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
