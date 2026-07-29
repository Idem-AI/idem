import minioConnection from '../config/minio.config';
import logger from '../config/logger';
import { Readable } from 'stream';
import { convertSvgToPng, resolveSvgContent } from './logo-import.service';
import { LogoAssetUrls, LogoModel } from '../models/logo.model';

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

/**
 * URLs of all SVG files uploaded to object storage for a logo.
 * Mirrors the inline SVG fields of LogoModel, but with hosted URLs instead of markup.
 */
export interface LogoSvgUrls {
  svg: string;
  iconSvg?: string;
  variations?: {
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
  };
}

/**
 * Content hashes of every stored code file, used to compute the delta between
 * the workspace and the bucket so only changed files are re-uploaded.
 */
export interface ProjectCodeManifest {
  version: number;
  updatedAt: string;
  files: Record<string, string>;
}

/**
 * Rendered size (px) of the PNG logo assets uploaded to the bucket.
 * 512 is enough for slides/flyers/brand-book <img> while staying lightweight.
 */
const LOGO_PNG_SIZE = 512;

export class StorageService {
  private get client() {
    return minioConnection.getClient();
  }
  private get bucketName() {
    return minioConnection.getBucketName();
  }

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
   * Rasterize a single logo SVG to PNG and upload it to the bucket.
   *
   * Accepts either inline SVG markup or a hosted URL (legacy data where the SVG
   * field was replaced by a `.svg` URL) — the source is resolved to SVG first,
   * then converted to PNG. Never throws: on any failure it logs and returns
   * `undefined` so a single bad variation can't abort the whole upload.
   *
   * @param svgOrUrl - Inline SVG markup or a URL pointing to an SVG
   * @param fileName - Target PNG file name (e.g. "logo-primary.png")
   * @param folderPath - Destination folder in the bucket
   * @returns The public PNG URL, or undefined when it couldn't be produced
   */
  private async uploadSvgAsPng(
    svgOrUrl: string | undefined,
    fileName: string,
    folderPath: string
  ): Promise<string | undefined> {
    if (!svgOrUrl || !svgOrUrl.trim()) return undefined;

    try {
      const svgContent = await resolveSvgContent(svgOrUrl);
      const pngBuffer = await convertSvgToPng(svgContent, LOGO_PNG_SIZE, LOGO_PNG_SIZE);
      const result = await this.uploadFile(pngBuffer, fileName, folderPath, 'image/png');
      return result.downloadURL;
    } catch (error: any) {
      logger.warn(`Skipping PNG asset upload for ${fileName}: ${error.message}`);
      return undefined;
    }
  }

  // ─── SVG file upload helpers ────────────────────────────────────────────────

  /**
   * Upload a single SVG string to MinIO and return its public URL.
   * Convenience wrapper around {@link uploadFile} with SVG content-type.
   */
  async uploadSvgFile(
    svgContent: string,
    fileName: string,
    folderPath: string
  ): Promise<string> {
    const result = await this.uploadFile(svgContent, fileName, folderPath, 'image/svg+xml');
    return result.downloadURL;
  }

  /**
   * Upload ALL SVG assets of a logo (primary, icon, and every variation) to the
   * bucket in parallel and return their public URLs.
   *
   * Each non-empty SVG field is uploaded as a separate `.svg` file. The returned
   * {@link LogoSvgUrls} object can be used to replace the inline SVG markup in
   * the logo model.
   *
   * @param logo - Logo carrying inline SVG content (svg/iconSvg/variations)
   * @param userId - User ID for folder structure
   * @param projectId - Project ID for folder structure
   * @returns URLs of the uploaded SVG files
   */
  async uploadAllLogoSvgs(
    logo: Pick<LogoModel, 'svg' | 'iconSvg' | 'variations'>,
    userId: string,
    projectId: string
  ): Promise<LogoSvgUrls> {
    const folderPath = `users/${userId}/projects/${projectId}/logos`;

    logger.info(`Uploading logo SVG assets`, { userId, projectId, folderPath });

    const wt = logo.variations?.withText;
    const io = logo.variations?.iconOnly;

    // Helper: upload if content is inline SVG (not a URL, not empty)
    const maybeUpload = async (
      content: string | undefined,
      name: string
    ): Promise<string | undefined> => {
      if (!content || !content.trim()) return undefined;
      // Skip if already a URL (legacy data or already uploaded)
      if (/^https?:\/\//i.test(content.trim())) return content.trim();
      try {
        return await this.uploadSvgFile(content, name, folderPath);
      } catch (error: any) {
        logger.warn(`Skipping SVG upload for ${name}: ${error.message}`);
        return undefined;
      }
    };

    const [
      svgUrl,
      iconUrl,
      wtLight,
      wtDark,
      wtMono,
      ioLight,
      ioDark,
      ioMono,
    ] = await Promise.all([
      this.uploadSvgFile(logo.svg, 'logo-primary.svg', folderPath),
      maybeUpload(logo.iconSvg, 'logo-icon.svg'),
      maybeUpload(wt?.lightBackground, 'logo-with-text-light.svg'),
      maybeUpload(wt?.darkBackground, 'logo-with-text-dark.svg'),
      maybeUpload(wt?.monochrome, 'logo-with-text-mono.svg'),
      maybeUpload(io?.lightBackground, 'logo-icon-light.svg'),
      maybeUpload(io?.darkBackground, 'logo-icon-dark.svg'),
      maybeUpload(io?.monochrome, 'logo-icon-mono.svg'),
    ]);

    const result: LogoSvgUrls = { svg: svgUrl };
    if (iconUrl) result.iconSvg = iconUrl;

    if (wtLight || wtDark || wtMono) {
      result.variations = {
        ...result.variations,
        withText: {
          ...(wtLight ? { lightBackground: wtLight } : {}),
          ...(wtDark ? { darkBackground: wtDark } : {}),
          ...(wtMono ? { monochrome: wtMono } : {}),
        },
      };
    }
    if (ioLight || ioDark || ioMono) {
      result.variations = {
        ...result.variations,
        iconOnly: {
          ...(ioLight ? { lightBackground: ioLight } : {}),
          ...(ioDark ? { darkBackground: ioDark } : {}),
          ...(ioMono ? { monochrome: ioMono } : {}),
        },
      };
    }

    logger.info(`Logo SVG assets uploaded`, {
      userId,
      projectId,
      uploaded: Object.keys(result),
    });

    return result;
  }

  // ─── PNG rasterization upload ──────────────────────────────────────────────

  /**
   * Upload the PNG assets of a logo (primary + icon + every variation) to the
   * bucket and return their public URLs.
   *
   * IMPORTANT — SVG vs PNG distinction:
   *  - The SVG source is stored as hosted .svg files in the bucket (uploaded via
   *    {@link uploadAllLogoSvgs}). The `svg`/`iconSvg`/`variations.*` fields
   *    now contain MinIO URLs rather than inline markup.
   *  - This method resolves those URLs to SVG content, rasterizes to PNG, and
   *    uploads the PNGs. The returned {@link LogoAssetUrls} is stored alongside
   *    the SVG URLs (as `logo.assetUrls`) and used wherever the logo must be
   *    referenced as a raster image (pitch deck, flyers, brand book).
   *
   * @param logo - Logo carrying SVG source (inline markup OR hosted URLs)
   * @param userId - User ID for folder structure
   * @param projectId - Project ID for folder structure
   * @returns URLs of the uploaded PNG assets (fields omitted when unavailable)
   */
  async uploadProjectLogoAssets(
    logo: Pick<LogoModel, 'svg' | 'iconSvg' | 'variations'>,
    userId: string,
    projectId: string
  ): Promise<LogoAssetUrls> {
    const folderPath = `users/${userId}/projects/${projectId}/logos`;

    logger.info(`Uploading logo PNG assets`, { userId, projectId, folderPath });

    const wt = logo.variations?.withText;
    const io = logo.variations?.iconOnly;

    // Upload everything in parallel — each call is self-contained and safe.
    const [
      primary,
      icon,
      wtLight,
      wtDark,
      wtMono,
      ioLight,
      ioDark,
      ioMono,
    ] = await Promise.all([
      this.uploadSvgAsPng(logo.svg, 'logo-primary.png', folderPath),
      this.uploadSvgAsPng(logo.iconSvg, 'logo-icon.png', folderPath),
      this.uploadSvgAsPng(wt?.lightBackground, 'logo-with-text-light.png', folderPath),
      this.uploadSvgAsPng(wt?.darkBackground, 'logo-with-text-dark.png', folderPath),
      this.uploadSvgAsPng(wt?.monochrome, 'logo-with-text-mono.png', folderPath),
      this.uploadSvgAsPng(io?.lightBackground, 'logo-icon-light.png', folderPath),
      this.uploadSvgAsPng(io?.darkBackground, 'logo-icon-dark.png', folderPath),
      this.uploadSvgAsPng(io?.monochrome, 'logo-icon-mono.png', folderPath),
    ]);

    const assetUrls: LogoAssetUrls = {};
    if (primary) assetUrls.primary = primary;
    if (icon) assetUrls.icon = icon;
    if (wtLight || wtDark || wtMono) {
      assetUrls.withText = {
        ...(wtLight ? { lightBackground: wtLight } : {}),
        ...(wtDark ? { darkBackground: wtDark } : {}),
        ...(wtMono ? { monochrome: wtMono } : {}),
      };
    }
    if (ioLight || ioDark || ioMono) {
      assetUrls.iconOnly = {
        ...(ioLight ? { lightBackground: ioLight } : {}),
        ...(ioDark ? { darkBackground: ioDark } : {}),
        ...(ioMono ? { monochrome: ioMono } : {}),
      };
    }

    logger.info(`Logo PNG assets uploaded`, {
      userId,
      projectId,
      uploaded: Object.keys(assetUrls),
    });

    return assetUrls;
  }

  /**
   * Upload logo variations to MinIO Storage as raw SVG files.
   * @deprecated Prefer {@link uploadProjectLogoAssets}, which rasterizes the
   * logo to PNG and keeps the SVG inline. Kept for backward compatibility.
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

  // ---------------------------------------------------------------------------
  // Incremental project code storage
  //
  // Generated code lives in the bucket as individual objects plus a manifest of
  // content hashes, so an update only rewrites the files that actually changed
  // instead of pushing a full ZIP on every message (which piled up one archive
  // per save and was never pruned).
  //
  //   users/{userId}/projects/{projectId}/code/manifest.json
  //   users/{userId}/projects/{projectId}/code/files/<relative path>
  // ---------------------------------------------------------------------------

  private codeFolderPath(projectId: string, userId?: string): string {
    return userId
      ? `users/${userId}/projects/${projectId}/code`
      : `projects/${projectId}/code`;
  }

  /**
   * Normalizes a workspace path into a safe object key suffix.
   * Returns null for paths that would escape the project folder.
   */
  private normalizeCodePath(filePath: string): string | null {
    const cleaned = filePath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!cleaned) return null;
    if (cleaned.split('/').some((segment) => segment === '..' || segment === '.')) return null;
    return cleaned;
  }

  private async getObjectAsString(objectPath: string): Promise<string | null> {
    try {
      const stream = await this.client.getObject(this.bucketName, objectPath);
      const chunks: Buffer[] = [];
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', resolve);
      });
      return Buffer.concat(chunks).toString('utf8');
    } catch (error: any) {
      // NoSuchKey is an expected miss, not a failure.
      if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') return null;
      throw error;
    }
  }

  /** Runs `worker` over `items` with a bounded number of concurrent calls. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    });

    await Promise.all(runners);
    return results;
  }

  /**
   * Reads the content-hash manifest describing what is currently stored.
   * Returns null when the project has never been synced with this format.
   */
  async getProjectCodeManifest(
    projectId: string,
    userId?: string
  ): Promise<ProjectCodeManifest | null> {
    const manifestPath = `${this.codeFolderPath(projectId, userId)}/manifest.json`;

    try {
      const raw = await this.getObjectAsString(manifestPath);
      if (!raw) return null;

      const manifest = JSON.parse(raw) as ProjectCodeManifest;
      return manifest?.files ? manifest : null;
    } catch (error: any) {
      logger.warn(`Unable to read the project code manifest`, {
        projectId,
        userId,
        error: error.message,
      });
      return null;
    }
  }

  private async saveProjectCodeManifest(
    projectId: string,
    userId: string | undefined,
    manifest: ProjectCodeManifest
  ): Promise<void> {
    await this.uploadFile(
      JSON.stringify(manifest),
      'manifest.json',
      this.codeFolderPath(projectId, userId),
      'application/json'
    );
  }

  /**
   * Applies an incremental change set to the stored code: writes the added or
   * modified files, removes the deleted ones and rewrites the manifest.
   *
   * @param upserts - Map of path -> content for files to write
   * @param deletions - Paths to remove from storage
   * @param manifest - Content hashes of the full resulting file set
   */
  async syncProjectCodeFiles(
    projectId: string,
    userId: string | undefined,
    upserts: Record<string, string>,
    deletions: string[],
    manifest: Record<string, string>
  ): Promise<{ written: number; deleted: number; total: number }> {
    const folderPath = this.codeFolderPath(projectId, userId);
    const filesPrefix = `${folderPath}/files`;

    const writable = Object.entries(upserts)
      .map(([path, content]) => ({ path: this.normalizeCodePath(path), content }))
      .filter((entry): entry is { path: string; content: string } => entry.path !== null);

    const removable = deletions
      .map((path) => this.normalizeCodePath(path))
      .filter((path): path is string => path !== null);

    logger.info(`Syncing project code to MinIO Storage`, {
      projectId,
      userId,
      upserts: writable.length,
      deletions: removable.length,
    });

    await this.mapWithConcurrency(writable, 12, async ({ path, content }) => {
      const buffer = Buffer.from(content, 'utf8');
      await this.client.putObject(
        this.bucketName,
        `${filesPrefix}/${path}`,
        Readable.from(buffer),
        buffer.length,
        {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-amz-meta-uploaded-at': new Date().toISOString(),
        }
      );
    });

    if (removable.length > 0) {
      await this.mapWithConcurrency(removable, 12, async (path) => {
        try {
          await this.client.removeObject(this.bucketName, `${filesPrefix}/${path}`);
        } catch (error: any) {
          // Deleting an object that is already gone is not an error here.
          logger.warn(`Unable to delete stored code file ${path}`, {
            projectId,
            error: error.message,
          });
        }
      });
    }

    const normalizedManifest: Record<string, string> = {};
    for (const [path, hash] of Object.entries(manifest)) {
      const normalized = this.normalizeCodePath(path);
      if (normalized) normalizedManifest[normalized] = hash;
    }

    await this.saveProjectCodeManifest(projectId, userId, {
      version: 1,
      updatedAt: new Date().toISOString(),
      files: normalizedManifest,
    });

    logger.info(`Project code synced successfully`, {
      projectId,
      userId,
      written: writable.length,
      deleted: removable.length,
      total: Object.keys(normalizedManifest).length,
    });

    return {
      written: writable.length,
      deleted: removable.length,
      total: Object.keys(normalizedManifest).length,
    };
  }

  /**
   * Reads back every file listed in the manifest.
   * Returns null when the project has no manifest-based storage yet.
   */
  async downloadProjectCodeFiles(
    projectId: string,
    userId?: string
  ): Promise<Record<string, string> | null> {
    const manifest = await this.getProjectCodeManifest(projectId, userId);
    if (!manifest) return null;

    const paths = Object.keys(manifest.files);
    if (paths.length === 0) return {};

    const filesPrefix = `${this.codeFolderPath(projectId, userId)}/files`;
    const files: Record<string, string> = {};

    await this.mapWithConcurrency(paths, 12, async (path) => {
      const content = await this.getObjectAsString(`${filesPrefix}/${path}`);
      if (content !== null) files[path] = content;
    });

    logger.info(`Loaded ${Object.keys(files).length} code files from MinIO Storage`, {
      projectId,
      userId,
      expected: paths.length,
    });

    return files;
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
