/**
 * MongoDB : le même cluster que l'API IDEM, des collections à iVision (`ivision_*`).
 * Les marques scannées, les conversations, les vidéos et les visuels d'iVision y vivent ;
 * les projets IDEM restent la propriété de l'API IDEM (lus par sa passerelle interne).
 */
import mongoose from 'mongoose';
import logger from './logger';

export async function connectDatabase(): Promise<void> {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || '27017';
    const database = process.env.MONGODB_DATABASE || 'idem';
    const username = process.env.MONGODB_USERNAME || 'admin';
    const password = process.env.MONGODB_PASSWORD || 'admin123';
    uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=admin`;
  }
  await mongoose.connect(uri, { maxPoolSize: 10, minPoolSize: 1, serverSelectionTimeoutMS: 5000 });
  logger.info('db.connected', { event: 'db.connected', host: mongoose.connection.host, database: mongoose.connection.name });
}

/** Une collection d'iVision (documents typés à la lecture, schéma libre). */
export function collection<T extends object>(name: 'brands' | 'sessions' | 'videos' | 'visuals' | 'references' | 'scans') {
  return mongoose.connection.collection<T & { _id: string }>(`ivision_${name}`);
}

export function databaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
