export const environment = {
  environment: 'dev',
  isBeta: true, // Set to true to show normal login page in development
  waitlistUrl: 'https://forms.gle/YourDevGoogleFormUrlHere', // Development waitlist form URL
  analytics: {
    enabled: false,
  },
  casdoor: {
    endpoint: 'http://localhost:8000',
    clientId: 'f8863b0307010542890e', // À configurer après création de l'application Casdoor
    clientSecret: '195448dec70f4a0f0572702ebb9e13ee2aa5b1bd',
    organization: 'idem',
    application: 'idem-dashboard',
    redirectUri: 'http://localhost:4200/auth/callback',
  },
  services: {
    domain: 'https://idem.africa',
    dashboard: {
      url: 'http://localhost:4200',
    },
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
