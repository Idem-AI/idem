export const environment = {
  environment: 'dev',
  isBeta: true, // Set to true to show normal login page in development
  waitlistUrl: 'https://forms.gle/YourDevGoogleFormUrlHere', // Development waitlist form URL
  analytics: {
    enabled: false,
  },
  firebase: {
    apiKey: 'AIzaSyCsUpHmK5-o4hp8_HldvlaLU2gLOUVeHgY',
    authDomain: 'lexis-ia.firebaseapp.com',
    projectId: 'lexis-ia',
    storageBucket: 'lexis-ia.firebasestorage.app',
    messagingSenderId: '78825247320',
    appId: '1:78825247320:web:2a69ba8ceabad513f3f02d',
    measurementId: 'G-1YQGTP97EJ',
  },
  services: {
    domain: 'https://idem.africa',
    api: {
      url: 'http://localhost:3001',
      version: 'v1',
      llmModel: 'gpt-3.5-turbo',
    },
    webgen: {
      url: 'http://localhost:5173',
    },
    diagen: {
      url: 'http://localhost:3002',
    },
  },
};
