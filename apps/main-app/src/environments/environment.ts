export const environment = {
  environment: 'prod',
  isBeta: true,
  waitlistUrl: 'https://forms.gle/gP7fr8te9qMUovad6',
  analytics: {
    enabled: true, // Analytics enabled in production only
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
    domain: 'https://idem-ai.com',
    api: {
      url: 'https://api.idem-ai.com',
      version: 'v1',
      llmModel: 'gpt-3.5-turbo',
    },
    webgen: {
      url: 'https://appgen.idem-ai.com',
    },
    diagen: {
      url: 'http://chart.idem-ai.com',
    },
  },
};
