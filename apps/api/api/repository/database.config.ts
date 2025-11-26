export enum SGBDType {
  FIRESTORE = 'firestore',
  // MONGODB = 'mongodb', // Example for future SGBD
  // POSTGRESQL = 'postgresql', // Example for future SGBD
}

export const activeSGBD: SGBDType = SGBDType.FIRESTORE;
