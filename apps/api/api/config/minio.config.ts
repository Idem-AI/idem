import * as Minio from 'minio';
import logger from './logger';

export class MinIOConnection {
  private static instance: MinIOConnection;
  private client: Minio.Client;
  private bucketName: string;

  private constructor() {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'idem-storage2';

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    logger.info('MinIO client initialized', {
      endPoint,
      port,
      useSSL,
      bucketName: this.bucketName,
    });
  }

  public static getInstance(): MinIOConnection {
    if (!MinIOConnection.instance) {
      MinIOConnection.instance = new MinIOConnection();
    }
    return MinIOConnection.instance;
  }

  public async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);

      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`Bucket created: ${this.bucketName}`);
      } else {
        logger.info(`Bucket already exists: ${this.bucketName}`);
      }

      // Always set bucket policy to allow public read access (even if bucket already exists)
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
      logger.info(`Bucket policy set for public read access: ${this.bucketName}`);
    } catch (error: any) {
      logger.error('Error ensuring bucket exists', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  public getClient(): Minio.Client {
    return this.client;
  }

  public getBucketName(): string {
    return this.bucketName;
  }

  public getPublicUrl(objectName: string): string {
    // Use MINIO_PUBLIC_URL if set (for production with custom domain)
    // Otherwise fallback to constructing URL from ENDPOINT and PORT (for local dev)
    const publicUrl = process.env.MINIO_PUBLIC_URL;

    if (publicUrl) {
      // Remove trailing slash if present
      const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      return `${baseUrl}/${this.bucketName}/${objectName}`;
    }

    // Fallback to old behavior for backward compatibility
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';

    return `${protocol}://${endPoint}:${port}/${this.bucketName}/${objectName}`;
  }
}

export default MinIOConnection.getInstance();
