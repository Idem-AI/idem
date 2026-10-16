/**
 * Exécute un composant de site dans un DOM, comme le navigateur de l'aperçu.
 *
 * Reçoit un paquet autonome (React, Motion, Radix et le composant, construit
 * par `src/siteEngine/renderCheck.ts`), l'évalue dans une fenêtre jsdom, puis
 * appelle sa fonction `run` : le composant est monté sous une frontière
 * d'erreur, ses effets exécutés. Rend l'erreur attrapée, ou ce qui s'affiche.
 *
 * Un fil par vérification en cours ; le serveur coupe le fil qui ne répond
 * plus (boucle infinie) et en relance un neuf.
 */
import { parentPort } from 'node:worker_threads';
import { Script } from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

/** Ce que jsdom n'a pas et qu'une section peut appeler en se montant. */
function installBrowserStubs(window) {
  class Observer {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      // Tout est « visible » : les animations à l'apparition s'exécutent aussi.
      if (typeof this.callback === 'function') {
        try {
          this.callback([{ target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: target.getBoundingClientRect(), contentRect: { width: 1280, height: 800 } }], this);
        } catch (error) {
          window.setTimeout(() => {
            throw error;
          });
        }
      }
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = Observer;
  window.ResizeObserver = class extends Observer {
    observe() {}
  };
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  window.scrollTo = () => {};
  window.scrollBy = () => {};
  window.open = () => null;
  window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  window.Element.prototype.scrollTo = function scrollTo() {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLMediaElement.prototype.load = () => {};
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.supports !== 'function') window.CSS.supports = () => false;
  if (typeof window.CSS.escape !== 'function') window.CSS.escape = (value) => String(value);
  if (!window.document.fonts) window.document.fonts = { ready: Promise.resolve(), addEventListener() {}, removeEventListener() {} };
  if (typeof window.MessageChannel !== 'function') {
    // Le planificateur de React s'en sert ; des ports simples, sur les minuteurs de la fenêtre.
    window.MessageChannel = class MessageChannel {
      constructor() {
        const port = (other) => ({
          onmessage: null,
          postMessage: (data) => window.setTimeout(() => other().onmessage?.({ data })),
          start() {},
          close() {},
          addEventListener(type, listener) {
            if (type === 'message') this.onmessage = listener;
          },
          removeEventListener() {},
        });
        this.port1 = port(() => this.port2);
        this.port2 = port(() => this.port1);
      }
    };
  }
  window.IS_REACT_ACT_ENVIRONMENT = true;
}

const describe = (error) => ({
  message: String(error?.message ?? error),
  stack: String(error?.stack ?? ''),
  componentStack: '',
});

async function check({ code, props }) {
  const uncaught = [];
  const virtualConsole = new VirtualConsole();
  // Les avertissements de React (clés, imbrication) ne cassent rien : seuls
  // comptent les plantages, rendus par la frontière d'erreur.
  virtualConsole.on('jsdomError', () => {});
  const dom = new JSDOM('<!doctype html><html lang="fr"><head></head><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole,
  });
  const { window } = dom;
  installBrowserStubs(window);
  window.addEventListener('error', (event) => uncaught.push(describe(event.error ?? event.message)));

  try {
    new Script(code, { filename: 'idem-check.js' }).runInContext(dom.getInternalVMContext());
  } catch (error) {
    return { error: { ...describe(error), phase: 'load' } };
  }

  const harness = window.__idemCheck;
  if (!harness || typeof harness.run !== 'function') return { error: { message: 'module de vérification illisible', stack: '', componentStack: '', phase: 'load' } };

  try {
    const result = await harness.run(props ?? {});
    // Une erreur lancée hors du rendu (minuteur d'un effet) passe par la fenêtre.
    if (!result.error && uncaught.length) return { ...result, error: { ...uncaught[0], phase: 'effect' } };
    return result;
  } catch (error) {
    return { error: { ...describe(error), phase: 'harness' } };
  } finally {
    window.close();
  }
}

parentPort.on('message', async (job) => {
  let reply;
  try {
    reply = await check(job);
  } catch (error) {
    reply = { error: { ...describe(error), phase: 'worker' } };
  }
  parentPort.postMessage({ id: job.id, ...reply });
});
