import { storageService, UploadResult } from '../services/storage.service';
import { createGeneratedAppZips } from './zip-generator';

export interface GeneratedAppCode {
  frontend?: FrontendZip;
  backend?: BackendZip;
}

export interface FrontendZip {
  buffer: Buffer;
  fileName: string;
}

export interface BackendZip {
  buffer: Buffer;
  fileName: string;
}

export interface StorageUploadResult {
  frontend?: UploadResult;
  backend?: UploadResult;
  uploadedAt: string;
}

/**
 * Generate zip files from code and upload to Firebase Storage
 * This is the main function to call after application generation
 * @param generatedCode - Object containing frontend and/or backend code structures
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns Upload results with URLs and file paths
 */
export async function generateAndUploadAppZips(
  generatedCode: GeneratedAppCode,
  userId: string,
  projectId: string
): Promise<StorageUploadResult> {
  try {
    console.log('Starting app generation and upload process', {
      userId,
      projectId,
      hasFrontend: !!generatedCode.frontend,
      hasBackend: !!generatedCode.backend,
    });

    // Step 1: Create zip files from generated code
    const zipBuffers = await createGeneratedAppZips(generatedCode);

    if (!zipBuffers.frontend && !zipBuffers.backend) {
      throw new Error('No zip files were generated');
    }

    // Step 2: Upload to Firebase Storage
    const uploadResults = await storageService.uploadGeneratedAppZips(
      zipBuffers,
      userId,
      projectId
    );

    // Step 3: Format and return results
    const result: StorageUploadResult = {
      uploadedAt: new Date().toISOString(),
    };

    if (uploadResults.frontend) {
      result.frontend = uploadResults.frontend;
    }

    if (uploadResults.backend) {
      result.backend = uploadResults.backend;
    }

    console.log('App generation and upload completed successfully', {
      userId,
      projectId,
      result,
    });

    return result;
  } catch (error) {
    console.error('Error in generateAndUploadAppZips:', error);
    throw new Error(`Failed to generate and upload app zips: ${error.message}`);
  }
}

/**
 * Update existing app zips with new versions
 * This should be called after each code change/regeneration
 * @param generatedCode - Object containing frontend and/or backend code structures
 * @param existingPaths - Object containing existing file paths to overwrite
 * @returns Upload results with URLs and file paths
 */
export async function updateAppZips(
  generatedCode: GeneratedAppCode,
  existingPaths: {
    frontendFilePath?: string;
    backendFilePath?: string;
  }
): Promise<StorageUploadResult> {
  try {
    console.log('Starting app update process', {
      hasFrontend: !!generatedCode.frontend,
      hasBackend: !!generatedCode.backend,
      frontendPath: existingPaths.frontendFilePath,
      backendPath: existingPaths.backendFilePath,
    });

    // Step 1: Create zip files from generated code
    const zipBuffers = await createGeneratedAppZips(generatedCode);

    // Step 2: Update files in Firebase Storage
    const result: StorageUploadResult = {
      uploadedAt: new Date().toISOString(),
    };

    if (zipBuffers.frontend && existingPaths.frontendFilePath) {
      const uploadResult = await storageService.updateZipFile(
        zipBuffers.frontend,
        existingPaths.frontendFilePath
      );

      result.frontend = uploadResult;
    }

    if (zipBuffers.backend && existingPaths.backendFilePath) {
      const uploadResult = await storageService.updateZipFile(
        zipBuffers.backend,
        existingPaths.backendFilePath
      );

      result.backend = uploadResult;
    }

    console.log('App update completed successfully', {
      result,
    });

    return result;
  } catch (error) {
    console.error('Error in updateAppZips:', error);
    throw new Error(`Failed to update app zips: ${error.message}`);
  }
}
