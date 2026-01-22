// Version web - pas d'accès à ipcRenderer
import { getNodeContainerInstance } from './instance';

export async function startDevServer(): Promise<{ output: ReadableStream<any>; exit: Promise<number>; }> {
  const nodeContainer = await getNodeContainerInstance();
  if (!nodeContainer) {
    throw new Error('NodeContainer not available');
  }

  try {
    console.log('Installing dependencies...');
    const installProcess = await nodeContainer.spawn('npm', ['install'], {
      cwd: nodeContainer.projectRoot
    });

    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error('npm install failed');
    }

    console.log('Starting dev server...');
     return await nodeContainer.spawn('npm', ['run', 'dev'], {
      cwd: nodeContainer.projectRoot
    });

  } catch (error) {
    console.error('Failed to start dev server:', error);
    throw error;
  }
}

// Arrêter le serveur de développement - version web stub
export async function stopDevServer(port: number): Promise<void> {
  try {
    console.warn(`stopDevServer non disponible en mode web (port: ${port})`);
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to stop dev server:', error);
    throw error;
  }
} 