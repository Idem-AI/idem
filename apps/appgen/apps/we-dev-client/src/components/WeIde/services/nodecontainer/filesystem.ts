// Version web - pas d'accès à ipcRenderer
import { useFileStore } from '../../stores/fileStore';
import { add, debounce } from 'lodash';

// Définition locale des fichiers masqués pour le mode web
const isHiddenNodeModules = ['node_modules', '.git', '.DS_Store'];

// Store file hash values
// @ts-ignore
window.fileHashMap = window.fileHashMap || new Map<string, string>();

// Calculate MD5 hash of file content
async function calculateMD5(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let first = true;
// Version web - fonction stub pour la compatibilité
async function readDirRecursive(
  dirPath: string,
  filesObj: Record<string, string>,
  projectRoot: string
): Promise<{ path: string; content: string }[]> {
  console.warn('readDirRecursive non disponible en mode web');
  return [];
}

// Version web - fonction stub pour la compatibilité
const debouncedUpdateFileSystem = debounce(async () => {
  console.warn('updateFileSystemNow non disponible en mode web');
  return;
}, 500);

// Export debounced version
export const updateFileSystemNow = debouncedUpdateFileSystem;

// Version web - fonction stub pour la compatibilité
const debouncedSyncFileSystem = debounce(async (close: boolean = false): Promise<boolean> => {
  console.warn('syncFileSystem non disponible en mode web');
  return false;
}, 500);

// Export debounced version
export const syncFileSystem = debouncedSyncFileSystem;
