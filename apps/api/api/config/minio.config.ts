import * as Minio from 'minio';
import logger from './logger';

class MinioService {
  private client: Minio.Client | null = null;
  private bucketName: string;
  private isConnected: boolean = false;

  constructor() {
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'idem-storage';
  }

  async initialize(): Promise<void> {
    try {
      this.client = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
      });

      // Vérifier si le bucket existe, sinon le créer
      const bucketExists = await this.client.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`MinIO bucket created: ${this.bucketName}`);

        // Définir la politique publique pour le bucket (optionnel)
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }

      this.isConnected = true;
      logger.info('MinIO client initialized successfully', {
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        bucket: this.bucketName,
      });
    } catch (error: any) {
      logger.error('Failed to initialize MinIO client', { error: error.message });
      throw error;
    }
  }

  getClient(): Minio.Client {
    if (!this.client || !this.isConnected) {
      throw new Error('MinIO client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  getBucketName(): string {
    return this.bucketName;
  }

  async uploadFile(
    objectName: string,
    filePath: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      await this.client.fPutObject(this.bucketName, objectName, filePath, metadata || {});
      logger.info(`File uploaded to MinIO: ${objectName}`);
      
      // Retourner l'URL publique
      return this.getPublicUrl(objectName);
    } catch (error: any) {
      logger.error('Failed to upload file to MinIO', { 
        objectName, 
        error: error.message 
      });
      throw error;
    }
  }

  async uploadBuffer(
    objectName: string,
    buffer: Buffer,
    size: number,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      await this.client.putObject(this.bucketName, objectName, buffer, size, metadata || {});
      logger.info(`Buffer uploaded to MinIO: ${objectName}`);
      
      return this.getPublicUrl(objectName);
    } catch (error: any) {
      logger.error('Failed to upload buffer to MinIO', { 
        objectName, 
        error: error.message 
      });
      throw error;
    }
  }

  async downloadFile(objectName: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const chunks: Buffer[] = [];
      const stream = await this.client.getObject(this.bucketName, objectName);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error: any) {
      logger.error('Failed to download file from MinIO', { 
        objectName, 
        error: error.message 
      });
      throw error;
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      await this.client.removeObject(this.bucketName, objectName);
      logger.info(`File deleted from MinIO: ${objectName}`);
    } catch (error: any) {
      logger.error('Failed to delete file from MinIO', { 
        objectName, 
        error: error.message 
      });
      throw error;
    }
  }

  async getPresignedUrl(objectName: string, expirySeconds: number = 3600): Promise<string> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      return await this.client.presignedGetObject(this.bucketName, objectName, expirySeconds);
    } catch (error: any) {
      logger.error('Failed to generate presigned URL', { 
        objectName, 
        error: error.message 
      });
      throw error;
    }
  }

  getPublicUrl(objectName: string): string {
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    try {
      const objectsList: string[] = [];
      const stream = this.client.listObjects(this.bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            objectsList.push(obj.name);
          }
        });
        stream.on('end', () => resolve(objectsList));
        stream.on('error', reject);
      });
    } catch (error: any) {
      logger.error('Failed to list files from MinIO', { error: error.message });
      throw error;
    }
  }
}

export const minioService = new MinioService();
