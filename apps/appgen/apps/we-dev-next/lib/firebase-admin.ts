import admin from "firebase-admin";

let app: admin.app.App;

if (!admin.apps.length) {
  try {
    // Initialize Firebase Admin SDK
    // You can use service account credentials or default credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;

    app = admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    throw error;
  }
} else {
  app = admin.apps[0]!;
}

export const firebaseAdmin = app;
export const storage = admin.storage();
export const bucket = storage.bucket();
