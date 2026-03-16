export enum SGBDType {
  MONGODB = 'mongodb',
  FIRESTORE = 'firestore', // Kept for backward compatibility during migration
}

export const activeSGBD: SGBDType = SGBDType.MONGODB;
