const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'src/.env' });

const envFile = `export const environment = {
  environment: 'prod',
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
  },
  services: {
    api: {
      url: '${process.env.API_URL}',
      version: '${process.env.API_VERSION}',
      llmModel: '${process.env.API_LLM_MODEL}',
    },
    webgen: {
      url: '${process.env.WEBGEN_URL}',
    },
    diagen: {
      url: '${process.env.DIAGEN_URL}',
    },
  },
};`;

// Définir le chemin du dossier
const envDir = path.join(__dirname, './src/environments');

// Vérifier et créer le dossier s'il n'existe pas
if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
    console.log(`📁 Created directory: ${envDir}`);
}

// Définir les chemins des fichiers
const targetPath = path.join(envDir, 'environment.ts');
const targetDevPath = path.join(envDir, 'environment.development.ts');

function createFileIfNotExists(filePath, content) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Successfully created: ${filePath}`);
    } else {
        console.log(`⚠️ File already exists: ${filePath}`);
    }
}

// Créer les fichiers uniquement s'ils n'existent pas
createFileIfNotExists(targetPath, envFile);
createFileIfNotExists(targetDevPath, envFile);
