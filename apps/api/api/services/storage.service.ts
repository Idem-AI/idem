import admin from "firebase-admin";
import logger from "../config/logger";

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
  private storage: admin.storage.Storage;
  private bucket: any;

  constructor() {
    this.storage = admin.storage();
    this.bucket = this.storage.bucket();
    logger.info("StorageService initialized");
  }

  /**
   * Upload a single file to Firebase Storage
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
    contentType: string = "image/svg+xml"
  ): Promise<UploadResult> {
    try {
      const filePath = `${folderPath}/${fileName}`;
      const file = this.bucket.file(filePath);

      logger.info(`Uploading file to Firebase Storage`, {
        fileName,
        folderPath,
        filePath,
        contentType,
      });

      // Convert string content to Buffer if needed
      const buffer =
        typeof fileContent === "string"
          ? Buffer.from(fileContent, "utf8")
          : fileContent;

      // Upload the file
      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const downloadURL = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;

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
      logger.error(`Error uploading file to Firebase Storage`, {
        fileName,
        folderPath,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to upload file ${fileName}: ${error.message}`);
    }
  }

  /**
   * Upload logo variations to Firebase Storage
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
        "logo-primary.svg",
        folderPath,
        "image/svg+xml"
      );

      // Upload icon SVG if provided
      if (iconSvg) {
        results.iconSvg = await this.uploadFile(
          iconSvg,
          "logo-icon.svg",
          folderPath,
          "image/svg+xml"
        );
      }

      // Upload withText variations
      if (variations.withText) {
        results.withText = {};
        
        if (variations.withText.lightBackground) {
          results.withText.lightBackground = await this.uploadFile(
            variations.withText.lightBackground,
            "logo-with-text-light.svg",
            folderPath,
            "image/svg+xml"
          );
        }

        if (variations.withText.darkBackground) {
          results.withText.darkBackground = await this.uploadFile(
            variations.withText.darkBackground,
            "logo-with-text-dark.svg",
            folderPath,
            "image/svg+xml"
          );
        }

        if (variations.withText.monochrome) {
          results.withText.monochrome = await this.uploadFile(
            variations.withText.monochrome,
            "logo-with-text-mono.svg",
            folderPath,
            "image/svg+xml"
          );
        }
      }

      // Upload iconOnly variations
      if (variations.iconOnly) {
        results.iconOnly = {};
        
        if (variations.iconOnly.lightBackground) {
          results.iconOnly.lightBackground = await this.uploadFile(
            variations.iconOnly.lightBackground,
            "logo-icon-light.svg",
            folderPath,
            "image/svg+xml"
          );
        }

        if (variations.iconOnly.darkBackground) {
          results.iconOnly.darkBackground = await this.uploadFile(
            variations.iconOnly.darkBackground,
            "logo-icon-dark.svg",
            folderPath,
            "image/svg+xml"
          );
        }

        if (variations.iconOnly.monochrome) {
          results.iconOnly.monochrome = await this.uploadFile(
            variations.iconOnly.monochrome,
            "logo-icon-mono.svg",
            folderPath,
            "image/svg+xml"
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
   * Delete files from Firebase Storage
   * @param filePaths - Array of file paths to delete
   */
  async deleteFiles(filePaths: string[]): Promise<void> {
    try {
      logger.info(`Deleting files from Firebase Storage`, {
        filePaths,
        count: filePaths.length,
      });

      const deletePromises = filePaths.map(async (filePath) => {
        const file = this.bucket.file(filePath);
        await file.delete();
        logger.info(`File deleted successfully: ${filePath}`);
      });

      await Promise.all(deletePromises);

      logger.info(`All files deleted successfully`, {
        deletedCount: filePaths.length,
      });
    } catch (error: any) {
      logger.error(`Error deleting files from Firebase Storage`, {
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
   * Generate a unique project ID for storage purposes
   * @returns A unique project ID
   */
  generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export a singleton instance
export const storageService = new StorageService();
