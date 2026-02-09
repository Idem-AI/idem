import JSZip from 'jszip';

/**
 * Convert files object to ZIP blob
 * @param files - Object containing file paths and content
 * @returns Promise<Blob> - ZIP file as blob
 */
export async function createZipFromFiles(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();

  // Add each file to the ZIP
  Object.entries(files).forEach(([filePath, content]) => {
    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    zip.file(cleanPath, content);
  });

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

/**
 * Create project metadata JSON for storage alongside ZIP
 * @param projectData - Project information
 * @param messages - Chat messages
 * @returns Object containing metadata
 */
export function createProjectMetadata(
  projectData: any,
  messages: any[]
): {
  projectName: string;
  timestamp: number;
  messageCount: number;
  fileCount: number;
  lastMessage: string;
} {
  return {
    projectName: projectData?.name || 'Unknown Project',
    timestamp: Date.now(),
    messageCount: messages.length,
    fileCount: Object.keys(extractFilesFromMessages(messages)).length,
    lastMessage: messages[messages.length - 1]?.content?.slice(0, 100) || '',
  };
}

/**
 * Extract files from the latest message artifacts
 * @param messages - Array of chat messages
 * @returns Object containing files or empty object
 */
export function extractFilesFromMessages(messages: any[]): Record<string, string> {
  if (!messages || messages.length === 0) {
    return {};
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.artifacts || lastMessage.artifacts.length === 0) {
    return {};
  }

  // Get the latest artifact (usually the last one)
  const latestArtifact = lastMessage.artifacts[lastMessage.artifacts.length - 1];
  return latestArtifact?.content || {};
}

/**
 * Upload ZIP file to the API
 * @param projectId - Project ID
 * @param zipBlob - ZIP file blob
 * @param apiBaseUrl - API base URL
 * @returns Promise<void>
 */
export async function uploadZipToAPI(
  projectId: string,
  zipBlob: Blob,
  apiBaseUrl: string = 'http://localhost:3001'
): Promise<void> {
  const formData = new FormData();
  formData.append('zip', zipBlob, `${projectId}-generation.zip`);

  const response = await fetch(`${apiBaseUrl}/projects/${projectId}/zip`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ZIP: ${response.status} ${response.statusText}`);
  }
}

/**
 * Save project metadata to API
 * @param projectId - Project ID
 * @param metadata - Project metadata
 * @param apiBaseUrl - API base URL
 * @returns Promise<void>
 */
export async function saveProjectMetadata(
  projectId: string,
  metadata: any,
  apiBaseUrl: string = 'http://localhost:3001'
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/projects/${projectId}/generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Failed to save metadata: ${response.status} ${response.statusText}`);
  }
}
