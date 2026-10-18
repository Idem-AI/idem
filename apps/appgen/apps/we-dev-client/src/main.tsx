import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DepsBakePage from "./components/DepsBake/DepsBakePage";
import "../global.css";
import { currentPlatform, currentProduct, rememberProductChoice } from "./utils/product";
import { prewarmWorkspace, targetFromChoice } from "./components/AiChat/utils/warmStart";
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

// Le four à dépendances : une page d'administration, pas un atelier. Elle
// installe les `node_modules` du socle dans la WebContainer et les dépose sur
// le serveur, qui les sert ensuite à tous les ateliers. Voir
// components/DepsBake/DepsBakePage.tsx.
const bakeMode = new URLSearchParams(window.location.search).has('deps-bake');

// Préchauffage, avant le premier rendu.
//
// Le démarrage de la WebContainer (une à trois secondes) et la demande du plan
// de dépendances ne dépendent ni du projet ni du socle : les lancer maintenant,
// c'est les payer pendant que les requêtes du projet voyagent. Un atelier ouvert
// sans projet (la landing) n'y perd rien — le conteneur servira de toute façon.
if (!bakeMode && new URLSearchParams(window.location.search).has('projectId')) {
  prewarmWorkspace(targetFromChoice(currentProduct(), currentPlatform()));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{bakeMode ? <DepsBakePage /> : <App />}</React.StrictMode>,
);
