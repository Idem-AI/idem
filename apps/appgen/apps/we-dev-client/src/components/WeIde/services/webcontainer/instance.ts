import { WebContainer } from '@webcontainer/api';
import { useFileStore } from '../../stores/fileStore';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

// Cache du dernier `server-ready`. WebContainer n'émet cet évènement qu'une fois
// et ne le rejoue pas pour les abonnés tardifs : sans ce cache, une preview qui
// se monte (ou se remonte) après le démarrage — install npm en cache, rechargement
// d'un projet, ou redémarrage de Vite dû à l'instrumentation du mode Edit — rate
// l'évènement et reste sur une page blanche.
let lastServerReady: { port: number; url: string } | null = null;
const serverReadyListeners = new Set<(port: number, url: string) => void>();

/**
 * Tous les serveurs ouverts, par port. Une application complète en ouvre deux —
 * l'API (`backend/`, port 3001) et l'interface (`frontend/`) — et l'aperçu doit
 * savoir lesquels sont prêts, pas seulement le dernier.
 */
const openServers = new Map<number, string>();
const serversListeners = new Set<(servers: Map<number, string>) => void>();
const notifyServers = () => serversListeners.forEach((cb) => cb(new Map(openServers)));

/** S'abonne à la liste des serveurs ouverts ; rappelle tout de suite avec l'état actuel. */
export function onServersChange(cb: (servers: Map<number, string>) => void): () => void {
  serversListeners.add(cb);
  cb(new Map(openServers));
  return () => {
    serversListeners.delete(cb);
  };
}

/** Dernière URL de serveur connue, ou null si aucun serveur n'est encore prêt. */
export function getLastServerUrl(): { port: number; url: string } | null {
  return lastServerReady;
}

/**
 * S'abonne à `server-ready`. Rappelle immédiatement avec la dernière URL connue
 * si un serveur est déjà prêt, puis à chaque (re)démarrage suivant. Renvoie une
 * fonction de désabonnement.
 */
export function onServerReady(cb: (port: number, url: string) => void): () => void {
  serverReadyListeners.add(cb);
  if (lastServerReady) cb(lastServerReady.port, lastServerReady.url);
  return () => {
    serverReadyListeners.delete(cb);
  };
}

export async function getWebContainerInstance(): Promise<WebContainer | null> {
  if (webcontainerInstance) return webcontainerInstance;
  if (bootPromise) return bootPromise;

  try {
    bootPromise = WebContainer.boot();
    webcontainerInstance = await bootPromise;

    if (webcontainerInstance) {
      // Écoute unique et persistante : mémorise la dernière URL et rediffuse à
      // tous les abonnés (preview classique + mode Edit).
      webcontainerInstance.on('server-ready', (port, url) => {
        lastServerReady = { port, url };
        openServers.set(port, url);
        serverReadyListeners.forEach((cb) => cb(port, url));
        notifyServers();
      });

      // Un serveur arrêté (« Exécuter » relancé, crash, correction) n'est plus
      // un aperçu valable.
      webcontainerInstance.on('port', (port, type, url) => {
        if (type === 'close') {
          openServers.delete(port);
          if (lastServerReady?.port === port) lastServerReady = null;
        } else if (type === 'open') {
          openServers.set(port, url);
        }
        notifyServers();
      });

      // Initialize the root directory
      await webcontainerInstance.fs.mkdir('/', { recursive: true });
      
      // Mount initial files
      const { files } = useFileStore.getState();
      for (const [path, contents] of Object.entries(files)) {
        const fullPath = `//${path}`;
        // Create parent directories
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        await webcontainerInstance.fs.mkdir(parentDir, { recursive: true });
        // Write file
        await webcontainerInstance.fs.writeFile(fullPath, contents);
      }
    }

    return webcontainerInstance;
  } catch (error) {
    console.error('Failed to boot WebContainer:', error);
    webcontainerInstance = null;
    return null;
  } finally {
    bootPromise = null;
  }
}