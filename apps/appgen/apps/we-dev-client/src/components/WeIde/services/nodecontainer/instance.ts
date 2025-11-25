import { EventEmitter } from '@/components/AiChat/utils/EventEmitter';
import type { NodeContainer } from './types';

// Version web - pas d'accès à ipcRenderer
let nodeContainerInstance: NodeContainer | null = null;
let bootPromise: Promise<NodeContainer> | null = null;

// Stub pour getProjectRoot
export async function getProjectRoot() {
  console.warn('getProjectRoot non disponible en mode web');
  return '/web-project';
}

async function initNodeContainer(): Promise<NodeContainer> {
  console.warn('NodeContainer n\'est pas pleinement fonctionnel en mode web');
  
  try {
    const projectRoot = '/web-project';
    
    const instance = new EventEmitter() as any;

    instance.fs = {
      mkdir: async (path: string, options?: { recursive?: boolean }) => {
        console.warn('mkdir non disponible en mode web');
        return Promise.resolve();
      },
      writeFile: async (path: string, contents: string) => {
        console.warn('writeFile non disponible en mode web');
        return Promise.resolve();
      },
      readFile: async (path: string, encoding: string) => {
        console.warn('readFile non disponible en mode web');
        return Promise.resolve('');
      },
      readdir: async (path: string, options?: { withFileTypes?: boolean }) => {
        console.warn('readdir non disponible en mode web');
        return Promise.resolve([]);
      }
    };

    instance.spawn = async (command: string, args: string[], options?: { cwd?: string }) => {
      console.warn('spawn non disponible en mode web', { command, args, options });
      
      // Créer un stream vide qui se termine immédiatement
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`La commande '${command}' n'est pas disponible en mode web\n`));
          controller.close();
        }
      });

      // Promise qui se résout immédiatement
      const exit = Promise.resolve(1);

      return {
        output: stream,
        exit
      };
    };

    // Stocker le chemin racine du projet
    instance.projectRoot = projectRoot;

    return instance;
  } catch (error) {
    console.error('Failed to initialize NodeContainer:', error);
    throw error;
  }
}

export async function getNodeContainerInstance(): Promise<NodeContainer | null> {
  try {
    // Check if already booted
    if (nodeContainerInstance) {
      return nodeContainerInstance;
    }

    // If boot already in progress, return that promise
    if (bootPromise) {
      return await bootPromise;
    }

    // Start boot process
    console.warn("NodeContainer n'est pas disponible en mode web. Création d'un stub limité.");
    bootPromise = initNodeContainer();
    nodeContainerInstance = await bootPromise;
    return nodeContainerInstance;
  } catch (error) {
    console.error('Failed to init NodeContainer:', error);
    nodeContainerInstance = null;
    return null;
  } finally {
    bootPromise = null;
  }
} 