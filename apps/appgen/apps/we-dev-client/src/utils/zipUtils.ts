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
    projectName: projectData.name,
    timestamp: Date.now(),
    messageCount: messages.length,
    fileCount: Object.keys(messages[messages.length - 1]?.artifacts?.[0]?.content || {}).length,
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
