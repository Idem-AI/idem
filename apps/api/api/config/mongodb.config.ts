import mongoose from 'mongoose';
import logger from './logger';

export class MongoDBConnection {
  private static instance: MongoDBConnection;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoDBConnection {
    if (!MongoDBConnection.instance) {
      MongoDBConnection.instance = new MongoDBConnection();
    }
    return MongoDBConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    try {
      let mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        const host = process.env.MONGODB_HOST || 'localhost';
        const port = process.env.MONGODB_PORT || '27017';
        const database = process.env.MONGODB_DATABASE || 'idem';
        const username = process.env.MONGODB_USERNAME || 'admin';
        const password = process.env.MONGODB_PASSWORD || 'admin123';
        
        // Construction de l'URI complète avec encodage sécurisé
        mongoUri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;
      }
      
      // Masquer le mot de passe pour les logs (sécurité)
      const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, `//${process.env.MONGODB_USERNAME || 'admin'}:***@`);
      logger.info(`Attempting to connect to MongoDB with URI: ${maskedUri}`);
      
      // Décommentez temporairement cette ligne en LOCAL uniquement si vous devez vraiment vérifier le mot de passe en clair :
      // console.log(`[DEBUG] CLEAR TEXT MONGODB URI:`, mongoUri);
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        database: mongoose.connection.name,
      });

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { error: error.message });
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });
    } catch (error: any) {
      logger.error('Failed to connect to MongoDB', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected successfully');
    } catch (error: any) {
      logger.error('Error disconnecting from MongoDB', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  public getConnection(): typeof mongoose {
    return mongoose;
  }

  public isConnectionActive(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

export default MongoDBConnection.getInstance();
