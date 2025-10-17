import { bucket } from "../firebase-admin";

export interface UploadResult {
  fileName: string;
  downloadURL: string;
  filePath: string;
}

export interface GeneratedAppZips {
  frontend?: UploadResult;
  backend?: UploadResult;
}

export class StorageService {
  /**
   * Upload a zip file to Firebase Storage
   * @param fileContent - The file content as Buffer
   * @param fileName - Name of the file
   * @param folderPath - Path where to store the file (e.g., "users/userId/projects/projectId")
   * @returns Upload result with download URL
   */
  async uploadZipFile(
    fileContent: Buffer,
    fileName: string,
    folderPath: string
  ): Promise<UploadResult> {
    try {
      const filePath = `${folderPath}/${fileName}`;
      const file = bucket.file(filePath);

      console.log(`Uploading zip file to Firebase Storage`, {
        fileName,
        folderPath,
        filePath,
      });

      // Upload the file
      await file.save(fileContent, {
        metadata: {
          contentType: "application/zip",
          metadata: {
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      console.log(`Zip file uploaded successfully`, {
        fileName,
        filePath,
        downloadURL,
      });

      return {
        fileName,
        downloadURL,
        filePath,
      };
    } catch (error: any) {
      console.error(`Error uploading zip file to Firebase Storage`, {
        fileName,
        folderPath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload zip file ${fileName}: ${error.message}`);
    }
  }

  /**
   * Upload generated application zip files (frontend and/or backend)
   * @param files - Object containing frontend and/or backend zip buffers
   * @param userId - User ID for folder structure
   * @param projectId - Project ID for folder structure
   * @returns Object with download URLs for each uploaded file
   */
  async uploadGeneratedAppZips(
    files: {
      frontend?: Buffer;
      backend?: Buffer;
    },
    userId: string,
    projectId: string
  ): Promise<GeneratedAppZips> {
    try {
      const folderPath = `users/${userId}/projects/${projectId}/generated-apps`;
      const results: GeneratedAppZips = {};

      console.log(`Starting generated app zips upload`, {
        userId,
        projectId,
        folderPath,
        hasFrontend: !!files.frontend,
        hasBackend: !!files.backend,
      });

      // Upload frontend zip if provided
      if (files.frontend) {
        const timestamp = new Date().getTime();
        results.frontend = await this.uploadZipFile(
          files.frontend,
          `frontend-${timestamp}.zip`,
          folderPath
        );
      }

      // Upload backend zip if provided
      if (files.backend) {
        const timestamp = new Date().getTime();
        results.backend = await this.uploadZipFile(
          files.backend,
          `backend-${timestamp}.zip`,
          folderPath
        );
      }

      console.log(`Generated app zips uploaded successfully`, {
        userId,
        projectId,
        uploadedFiles: Object.keys(results),
      });

      return results;
    } catch (error: any) {
      console.error(`Error uploading generated app zips`, {
        userId,
        projectId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload generated app zips: ${error.message}`);
    }
  }

  /**
   * Update an existing zip file (overwrites the old one)
   * @param fileContent - The new file content as Buffer
   * @param filePath - Full path to the existing file
   * @returns Upload result with download URL
   */
  async updateZipFile(
    fileContent: Buffer,
    filePath: string
  ): Promise<UploadResult> {
    try {
      const file = bucket.file(filePath);
      const fileName = filePath.split("/").pop() || "unknown.zip";

      console.log(`Updating zip file in Firebase Storage`, {
        filePath,
      });

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Delete the old file
      await file.delete();

      // Upload the new file
      await file.save(fileContent, {
        metadata: {
          contentType: "application/zip",
          metadata: {
            uploadedAt: new Date().toISOString(),
            updated: "true",
          },
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      console.log(`Zip file updated successfully`, {
        filePath,
        downloadURL,
      });

      return {
        fileName,
        downloadURL,
        filePath,
      };
    } catch (error: any) {
      console.error(`Error updating zip file in Firebase Storage`, {
        filePath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to update zip file: ${error.message}`);
    }
  }

  /**
   * Delete a zip file from Firebase Storage
   * @param filePath - Full path to the file to delete
   */
  async deleteZipFile(filePath: string): Promise<void> {
    try {
      console.log(`Deleting zip file from Firebase Storage`, {
        filePath,
      });

      const file = bucket.file(filePath);
      const [exists] = await file.exists();

      if (!exists) {
        console.warn(`File not found, skipping deletion: ${filePath}`);
        return;
      }

      await file.delete();

      console.log(`Zip file deleted successfully: ${filePath}`);
    } catch (error: any) {
      console.error(`Error deleting zip file from Firebase Storage`, {
        filePath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to delete zip file: ${error.message}`);
    }
  }

  /**
   * Delete multiple zip files from Firebase Storage
   * @param filePaths - Array of file paths to delete
   */
  async deleteMultipleZipFiles(filePaths: string[]): Promise<void> {
    try {
      console.log(`Deleting multiple zip files from Firebase Storage`, {
        filePaths,
        count: filePaths.length,
      });

      const deletePromises = filePaths.map((filePath) =>
        this.deleteZipFile(filePath)
      );

      await Promise.all(deletePromises);

      console.log(`All zip files deleted successfully`, {
        deletedCount: filePaths.length,
      });
    } catch (error: any) {
      console.error(`Error deleting multiple zip files from Firebase Storage`, {
        filePaths,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to delete multiple zip files: ${error.message}`);
    }
  }

  /**
   * Get download URL for an existing file
   * @param filePath - Full path to the file
   * @returns Download URL
   */
  async getDownloadURL(filePath: string): Promise<string> {
    try {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (error: any) {
      console.error(`Error getting download URL`, {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to get download URL: ${error.message}`);
    }
  }

  /**
   * List all zip files for a project
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns Array of file paths
   */
  async listProjectZipFiles(
    userId: string,
    projectId: string
  ): Promise<string[]> {
    try {
      const prefix = `users/${userId}/projects/${projectId}/generated-apps/`;
      const [files] = await bucket.getFiles({ prefix });

      const filePaths = files
        .filter((file) => file.name.endsWith(".zip"))
        .map((file) => file.name);

      console.log(`Listed project zip files`, {
        userId,
        projectId,
        count: filePaths.length,
      });

      return filePaths;
    } catch (error: any) {
      console.error(`Error listing project zip files`, {
        userId,
        projectId,
        error: error.message,
      });
      throw new Error(`Failed to list project zip files: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const storageService = new StorageService();
