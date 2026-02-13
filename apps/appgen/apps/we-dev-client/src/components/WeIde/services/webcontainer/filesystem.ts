import { WebContainer } from '@webcontainer/api';
import { useFileStore } from '../../stores/fileStore';
import { getWebContainerInstance } from './instance';
import { debounce } from 'lodash';

// Définition locale des fichiers masqués pour le mode web
const isHiddenNodeModules = ['node_modules', '.git', '.DS_Store'];

// Type definitions at the top of the file
interface FileContent {
  file: {
    contents: string;
  };
}

interface DirectoryContent {
  directory: Record<string, FileContent | DirectoryContent>;
}

type FileTreeContent = FileContent | DirectoryContent;

const fileHashMap = new Map<string, string>();

// Cache for already-fetched URLs to avoid re-fetching
const imageDataUrlCache = new Map<string, string>();

// Regex to find Firebase Storage URLs in file contents (in src attributes, url() CSS, etc.)
const FIREBASE_URL_REGEX =
  /https?:\/\/[^"'`\s)}>]*(storage\.googleapis\.com|firebasestorage\.app|firebasestorage\.googleapis\.com)[^"'`\s)}>]*/g;

/**
 * Extract all Firebase Storage URLs from file content
 */
function extractFirebaseUrls(content: string): string[] {
  FIREBASE_URL_REGEX.lastIndex = 0;
  const matches = content.match(FIREBASE_URL_REGEX);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Fetch a single image URL and convert to data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  // Check cache first
  const cached = imageDataUrlCache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        imageDataUrlCache.set(url, dataUrl);
        resolve(dataUrl);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[ImageProxy] Failed to fetch:', url, e);
    return null;
  }
}

/**
 * Replace all Firebase Storage URLs in content with data URLs
 */
async function replaceFirebaseUrlsWithDataUrls(content: string): Promise<string> {
  const urls = extractFirebaseUrls(content);
  if (urls.length === 0) return content;

  console.log(`[ImageProxy] Found ${urls.length} Firebase URL(s) to pre-fetch`);

  // Fetch all URLs in parallel
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      dataUrl: await fetchImageAsDataUrl(url),
    }))
  );

  // Replace URLs in content
  let result = content;
  for (const { url, dataUrl } of results) {
    if (dataUrl) {
      result = result.split(url).join(dataUrl);
      console.log(`[ImageProxy] Replaced: ${url.substring(0, 80)}...`);
    } else {
      console.warn(`[ImageProxy] Could not fetch: ${url.substring(0, 80)}...`);
    }
  }

  return result;
}

async function calculateMD5(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function mountFileSystem(
  instance: WebContainer,
  close: boolean = false
): Promise<boolean> {
  try {
    const { files } = useFileStore.getState();

    if (!files) {
      console.error('Files object is undefined or null');
      return false;
    }

    const fileTree: Record<string, FileTreeContent> = {};

    // Step 1: Collect all Firebase URLs across all files and pre-fetch them
    const allFirebaseUrls = new Set<string>();
    for (const [, contents] of Object.entries(files)) {
      if (typeof contents !== 'string') continue;
      const urls = extractFirebaseUrls(contents);
      urls.forEach((url) => allFirebaseUrls.add(url));
    }

    // Pre-fetch all Firebase URLs in parallel (runs in parent context with full CORS access)
    if (allFirebaseUrls.size > 0) {
      console.log(`[ImageProxy] Pre-fetching ${allFirebaseUrls.size} Firebase Storage URL(s)...`);
      await Promise.all(Array.from(allFirebaseUrls).map((url) => fetchImageAsDataUrl(url)));
      console.log('[ImageProxy] Pre-fetch complete');
    }

    // Step 2: Build file tree with Firebase URLs replaced by data URLs
    for (const [path, contents] of Object.entries(files)) {
      if (typeof contents !== 'string') continue;

      // Replace Firebase URLs with cached data URLs
      const processedContents = await replaceFirebaseUrlsWithDataUrls(contents);

      const newHash = await calculateMD5(processedContents);
      const oldHash = fileHashMap.get(path);

      if (oldHash === newHash) {
        continue;
      }

      fileHashMap.set(path, newHash);

      const parts = path.split('/');
      let currentPath = '';
      let current = fileTree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (i === parts.length - 1) {
          current[part] = {
            file: {
              contents: processedContents,
            },
          };
        } else {
          if (!current[part]) {
            current[part] = {
              directory: {},
            };
          }
          current = (current[part] as DirectoryContent).directory;
        }
      }
    }

    if (Object.keys(fileTree).length > 0) {
      console.log('Mounting changed files:', fileTree);
      await instance.mount(fileTree, {
        mountPoint: '/',
      });
    } else {
      // console.log('No files changed, skipping mount');
    }

    if (!close && !window.isLoading) {
      updateFileSystemNow();
    }

    return true;
  } catch (error) {
    console.error('Failed to mount file system:', error);
    return false;
  }
}

// Move recursive function outside
const readDirRecursive = async (
  instance: WebContainer,
  dirPath: string,
  filesObj: Record<string, string>
): Promise<{ path: string; content: string }[]> => {
  const files: { path: string; content: string }[] = [];
  const entries = (await instance?.fs.readdir(dirPath, { withFileTypes: true })) || [];

  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`;

    if (isHiddenNodeModules.some((item) => entry?.name?.indexOf(item) > -1)) continue;

    if (entry.isDirectory()) {
      const subFiles = await readDirRecursive(instance, fullPath, filesObj);
      files.push(...subFiles);
    } else {
      try {
        const content = (await instance?.fs.readFile(fullPath, 'utf-8')) || '';
        const newHash = await calculateMD5(content);
        const oldHash = fileHashMap.get(fullPath);
        const fileHash = await calculateMD5(filesObj[fullPath.substring(1)]);

        if (oldHash !== newHash && fileHash !== newHash) {
          files.push({
            path: fullPath.startsWith('/') ? fullPath.slice(1) : fullPath,
            content,
          });
        }
        fileHashMap.set(fullPath, newHash);
      } catch (error) {
        console.warn(`Failed to read file ${fullPath}:`, error);
      }
    }
  }
  return files;
};

// Create debounced version of updateFileSystemNow
const debouncedUpdateFileSystem = debounce(async () => {
  if (window.isLoading) {
    return;
  }
  const { updateContent, files: filesObj } = useFileStore.getState();
  const instance = await getWebContainerInstance();
  if (!instance) return;

  try {
    // Start reading from root directory
    const files = await readDirRecursive(instance, '/', filesObj);

    // Update file storage
    if (files.length > 0) {
      // console.log('Updating files:', files.map(f => f.path));
      // Update files one by one
      for (const file of files) {
        updateContent(file.path.substring(1), file.content, true, true);
      }
    } else {
      // console.log('No files changed');
    }
  } catch (error) {
    console.error('Failed to update files:', error);
  }
}, 500);

// Export debounced version
export const updateFileSystemNow = debouncedUpdateFileSystem;

// Create debounced version of syncFileSystem
const debouncedSyncFileSystem = debounce(async (close: boolean = false): Promise<boolean> => {
  console.log('syncFileSystem');
  const instance = await getWebContainerInstance();
  if (!instance) return false;

  const result = await mountFileSystem(instance, close);
  return result;
}, 500);

// Export debounced version
export const syncFileSystem = debouncedSyncFileSystem;
