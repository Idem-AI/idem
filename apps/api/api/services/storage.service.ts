import minioConnection from '../config/minio.config';
import logger from '../config/logger';
import { Readable } from 'stream';

export interface UploadResult {
  fileName: string;
  downloadURL: string;
  filePath: string;
}

export interface LogoVariationSetUpload {
  lightBackground?: UploadResult;
  darkBackground?: UploadResult;
  monochrome?: UploadResult;
}

export interface LogoVariationsUpload {
  primaryLogo?: UploadResult;
  iconSvg?: UploadResult;
  withText?: LogoVariationSetUpload;
  iconOnly?: LogoVariationSetUpload;
}

export class StorageService {
  private client = minioConnection.getClient();
  private bucketName = minioConnection.getBucketName();

  constructor() {
    logger.info('StorageService initialized with MinIO');
  }

  /**
   * Initialize the storage service by ensuring bucket exists
   */
  async initialize(): Promise<void> {
    await minioConnection.ensureBucketExists();
  }

  /**
   * Upload a single file to MinIO Storage
   * @param fileContent - The file content as string or Buffer
   * @param fileName - Name of the file
   * @param folderPath - Path where to store the file (e.g., "users/userId/projects/projectId")
   * @param contentType - MIME type of the file
   * @returns Upload result with download URL
   */
  async uploadFile(
    fileContent: string | Buffer,
    fileName: string,
    folderPath: string,
    contentType: string = 'image/svg+xml'
  ): Promise<UploadResult> {
    try {
      const filePath = `${folderPath}/${fileName}`;

      logger.info(`Uploading file to MinIO Storage`, {
        fileName,
        folderPath,
        filePath,
        contentType,
      });

      // Convert string content to Buffer if needed
      const buffer =
        typeof fileContent === 'string' ? Buffer.from(fileContent, 'utf8') : fileContent;

      // Create a readable stream from buffer
      const stream = Readable.from(buffer);

      // Upload the file
      await this.client.putObject(this.bucketName, filePath, stream, buffer.length, {
        'Content-Type': contentType,
        'x-amz-meta-uploaded-at': new Date().toISOString(),
      });

      // Get the public URL
      const downloadURL = minioConnection.getPublicUrl(filePath);

      logger.info(`File uploaded successfully`, {
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
      logger.error(`Error uploading file to MinIO Storage`, {
        fileName,
        folderPath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload file ${fileName}: ${error.message}`);
    }
  }

  /**
   * Upload logo variations to MinIO Storage
   * @param variations - Object containing logo variations (SVG content)
   * @param userId - User ID for folder structure
   * @param projectId - Project ID for folder structure
   * @returns Object with download URLs for each variation
   */
  async uploadLogoVariations(
    primaryLogo: string,
    iconSvg: string | undefined,
    variations: {
      withText?: {
        lightBackground?: string;
        darkBackground?: string;
        monochrome?: string;
      };
      iconOnly?: {
        lightBackground?: string;
        darkBackground?: string;
        monochrome?: string;
      };
    },
    userId: string,
    projectId: string
  ): Promise<LogoVariationsUpload> {
    try {
      const folderPath = `users/${userId}/projects/${projectId}/logos`;
      const results: LogoVariationsUpload = {};

      logger.info(`Starting logo variations upload`, {
        userId,
        projectId,
        folderPath,
        variationsCount: Object.keys(variations).length,
      });

      // Upload primary logo
      results.primaryLogo = await this.uploadFile(
        primaryLogo,
        'logo-primary.svg',
        folderPath,
        'image/svg+xml'
      );

      // Upload icon SVG if provided
      if (iconSvg) {
        results.iconSvg = await this.uploadFile(
          iconSvg,
          'logo-icon.svg',
          folderPath,
          'image/svg+xml'
        );
      }

      // Upload withText variations
      if (variations.withText) {
        results.withText = {};

        if (variations.withText.lightBackground) {
          results.withText.lightBackground = await this.uploadFile(
            variations.withText.lightBackground,
            'logo-with-text-light.svg',
            folderPath,
            'image/svg+xml'
          );
        }

        if (variations.withText.darkBackground) {
          results.withText.darkBackground = await this.uploadFile(
            variations.withText.darkBackground,
            'logo-with-text-dark.svg',
            folderPath,
            'image/svg+xml'
          );
        }

        if (variations.withText.monochrome) {
          results.withText.monochrome = await this.uploadFile(
            variations.withText.monochrome,
            'logo-with-text-mono.svg',
            folderPath,
            'image/svg+xml'
          );
        }
      }

      // Upload iconOnly variations
      if (variations.iconOnly) {
        results.iconOnly = {};

        if (variations.iconOnly.lightBackground) {
          results.iconOnly.lightBackground = await this.uploadFile(
            variations.iconOnly.lightBackground,
            'logo-icon-light.svg',
            folderPath,
            'image/svg+xml'
          );
        }

        if (variations.iconOnly.darkBackground) {
          results.iconOnly.darkBackground = await this.uploadFile(
            variations.iconOnly.darkBackground,
            'logo-icon-dark.svg',
            folderPath,
            'image/svg+xml'
          );
        }

        if (variations.iconOnly.monochrome) {
          results.iconOnly.monochrome = await this.uploadFile(
            variations.iconOnly.monochrome,
            'logo-icon-mono.svg',
            folderPath,
            'image/svg+xml'
          );
        }
      }

      logger.info(`Logo variations uploaded successfully`, {
        userId,
        projectId,
        uploadedVariations: Object.keys(results),
      });

      return results;
    } catch (error: any) {
      logger.error(`Error uploading logo variations`, {
        userId,
        projectId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload logo variations: ${error.message}`);
    }
  }

  /**
   * Delete files from MinIO Storage
   * @param filePaths - Array of file paths to delete
   */
  async deleteFiles(filePaths: string[]): Promise<void> {
    try {
      logger.info(`Deleting files from MinIO Storage`, {
        filePaths,
        count: filePaths.length,
      });

      const deletePromises = filePaths.map(async (filePath) => {
        await this.client.removeObject(this.bucketName, filePath);
        logger.info(`File deleted successfully: ${filePath}`);
      });

      await Promise.all(deletePromises);

      logger.info(`All files deleted successfully`, {
        deletedCount: filePaths.length,
      });
    } catch (error: any) {
      logger.error(`Error deleting files from MinIO Storage`, {
        filePaths,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Upload team member profile pictures
   * @param files - Array of uploaded files from multer
   * @param userId - User ID for folder structure
   * @param projectId - Project ID for folder structure
   * @returns Object mapping member index to upload result
   */
  async uploadTeamMemberImages(
    files: Express.Multer.File[],
    userId: string,
    projectId: string
  ): Promise<{ [memberIndex: number]: UploadResult }> {
    try {
      const folderPath = `users/${userId}/projects/${projectId}/team-members`;
      const results: { [memberIndex: number]: UploadResult } = {};

      logger.info(`Starting team member images upload`, {
        userId,
        projectId,
        folderPath,
        filesCount: files.length,
      });

      // Upload each team member image
      for (const file of files) {
        // Extract member index from fieldname (e.g., "teamMemberImage_0" -> 0)
        const memberIndexMatch = file.fieldname.match(/teamMemberImage_(\d+)/);
        if (!memberIndexMatch) {
          logger.warn(`Invalid fieldname format: ${file.fieldname}`);
          continue;
        }

        const memberIndex = parseInt(memberIndexMatch[1], 10);
        const fileExtension = file.originalname.split('.').pop() || 'jpg';
        const fileName = `team-member-${memberIndex}.${fileExtension}`;

        const uploadResult = await this.uploadFile(
          file.buffer,
          fileName,
          folderPath,
          file.mimetype || 'image/jpeg'
        );

        results[memberIndex] = uploadResult;

        logger.info(`Team member image uploaded successfully`, {
          memberIndex,
          fileName,
          downloadURL: uploadResult.downloadURL,
        });
      }

      logger.info(`All team member images uploaded successfully`, {
        userId,
        projectId,
        uploadedCount: Object.keys(results).length,
      });

      return results;
    } catch (error: any) {
      logger.error(`Error uploading team member images`, {
        userId,
        projectId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload team member images: ${error.message}`);
    }
  }

  /**
   * Upload project code as ZIP file to MinIO Storage
   * @param zipBuffer - The ZIP file content as Buffer
   * @param projectId - Project ID for folder structure
   * @param userId - User ID for folder structure (optional)
   * @returns Upload result with download URL
   */
  async uploadProjectCodeZip(
    zipBuffer: Buffer,
    projectId: string,
    userId?: string
  ): Promise<UploadResult> {
    try {
      const folderPath = userId
        ? `users/${userId}/projects/${projectId}/code`
        : `projects/${projectId}/code`;

      const fileName = `project-code-${Date.now()}.zip`;

      logger.info(`Uploading project code ZIP to MinIO Storage`, {
        projectId,
        userId,
        folderPath,
        fileName,
        zipSize: zipBuffer.length,
      });

      const uploadResult = await this.uploadFile(
        zipBuffer,
        fileName,
        folderPath,
        'application/zip'
      );

      logger.info(`Project code ZIP uploaded successfully`, {
        projectId,
        userId,
        fileName,
        downloadURL: uploadResult.downloadURL,
        zipSize: zipBuffer.length,
      });

      return uploadResult;
    } catch (error: any) {
      logger.error(`Error uploading project code ZIP`, {
        projectId,
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload project code ZIP: ${error.message}`);
    }
  }

  /**
   * Download and extract project code ZIP from MinIO Storage
   * @param projectId - Project ID for folder structure
   * @param userId - User ID for folder structure (optional)
   * @returns Extracted files as Record<string, string> or null if not found
   */
  async downloadProjectCodeZip(
    projectId: string,
    userId?: string
  ): Promise<Record<string, string> | null> {
    try {
      const folderPath = userId
        ? `users/${userId}/projects/${projectId}/code`
        : `projects/${projectId}/code`;

      logger.info(`Downloading project code ZIP from MinIO Storage`, {
        projectId,
        userId,
        folderPath,
      });

      // List files in the folder to find the latest ZIP
      const stream = this.client.listObjects(this.bucketName, folderPath, true);
      const files: any[] = [];

      await new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj));
        stream.on('error', reject);
        stream.on('end', resolve);
      });

      if (!files || files.length === 0) {
        logger.info(`No code ZIP files found for project ${projectId}`);
        return null;
      }

      // Find the most recent ZIP file
      const zipFiles = files.filter((file) => file.name.endsWith('.zip'));
      if (zipFiles.length === 0) {
        logger.info(`No ZIP files found for project ${projectId}`);
        return null;
      }

      // Sort by last modified and get the latest
      zipFiles.sort((a, b) => {
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });

      const latestZipFile = zipFiles[0];
      logger.info(`Found latest ZIP file: ${latestZipFile.name}`);

      // Download the ZIP file
      const chunks: Buffer[] = [];
      const dataStream = await this.client.getObject(this.bucketName, latestZipFile.name);

      await new Promise((resolve, reject) => {
        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('error', reject);
        dataStream.on('end', resolve);
      });

      const zipBuffer = Buffer.concat(chunks);

      // Extract the ZIP file using JSZip
      const JSZip = require('jszip');
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipBuffer);

      const extractedFiles: Record<string, string> = {};

      // Extract all files from the ZIP
      for (const [filePath, file] of Object.entries(zipContent.files)) {
        const zipFile = file as any;
        if (!zipFile.dir) {
          const content = await zipFile.async('string');
          extractedFiles[filePath] = content;
        }
      }

      logger.info(`Successfully extracted ${Object.keys(extractedFiles).length} files from ZIP`, {
        projectId,
        userId,
        zipFileName: latestZipFile.name,
      });

      return extractedFiles;
    } catch (error: any) {
      logger.error(`Error downloading project code ZIP`, {
        projectId,
        userId,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Generate a unique project ID for storage purposes
   * @returns A unique project ID
   */
  generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export a singleton instance
export const storageService = new StorageService();
