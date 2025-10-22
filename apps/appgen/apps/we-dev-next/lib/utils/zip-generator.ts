import archiver from 'archiver';
import { BackendZip, FrontendZip, GeneratedAppCode } from './app-generation-storage';

export interface ZipFileEntry {
  path: string;
  content: string | Buffer;
}

/**
 * Create a zip file from an array of file entries
 * @param files - Array of file entries with path and content
 * @param zipName - Name of the zip file (for logging purposes)
 * @returns Buffer containing the zip file
 */
export async function createZipFromFiles(
  files: ZipFileEntry[],
  zipName: string = 'archive.zip'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Collect chunks
    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Handle completion
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log(`Zip file created: ${zipName}, size: ${buffer.length} bytes`);
      resolve(buffer);
    });

    // Handle errors
    archive.on('error', (err) => {
      console.error(`Error creating zip file ${zipName}:`, err);
      reject(err);
    });

    // Add files to the archive
    files.forEach((file) => {
      const content =
        typeof file.content === 'string' ? Buffer.from(file.content, 'utf-8') : file.content;

      archive.append(content, { name: file.path });
    });

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Create a zip file from a directory structure object
 * @param directoryStructure - Object representing directory structure
 * @param basePath - Base path for files in the zip
 * @returns Buffer containing the zip file
 */
export async function createZipFromDirectoryStructure(
  directoryStructure: FrontendZip | BackendZip,
  basePath: string = ''
): Promise<Buffer> {
  const files: ZipFileEntry[] = [];

  function traverseStructure(obj: FrontendZip | BackendZip, currentPath: string) {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = currentPath ? `${currentPath}/${key}` : key;

      if (typeof value === 'string' || Buffer.isBuffer(value)) {
        // It's a file
        files.push({
          path: fullPath,
          content: value,
        });
      } else if (typeof value === 'object' && value !== null) {
        // It's a directory, traverse recursively
        traverseStructure(value, fullPath);
      }
    }
  }

  traverseStructure(directoryStructure, basePath);

  return createZipFromFiles(files, `${basePath || 'archive'}.zip`);
}

/**
 * Create separate zip files for frontend and backend from generated code
 * @param generatedCode - Object containing frontend and/or backend code structures
 * @returns Object with frontend and/or backend zip buffers
 */
export async function createGeneratedAppZips(generatedCode: GeneratedAppCode): Promise<{
  frontend?: Buffer;
  backend?: Buffer;
}> {
  const result: {
    frontend?: Buffer;
    backend?: Buffer;
  } = {};

  try {
    if (generatedCode.frontend) {
      console.log('Creating frontend zip file...');
      result.frontend = await createZipFromDirectoryStructure(generatedCode.frontend, 'frontend');
    }

    if (generatedCode.backend) {
      console.log('Creating backend zip file...');
      result.backend = await createZipFromDirectoryStructure(generatedCode.backend, 'backend');
    }

    return result;
  } catch (error) {
    console.error('Error creating generated app zips:', error);
    throw new Error(`Failed to create zip files: ${error.message}`);
  }
}
