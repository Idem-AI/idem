export const environment = {
  environment: 'prod',
  isBeta: true,
  waitlistUrl: 'https://forms.gle/gP7fr8te9qMUovad6',
  analytics: {
    enabled: true, // Analytics enabled in production only
  },
  casdoor: {
    endpoint: 'https://auth.idem.africa',
    clientId: 'your-client-id', // À configurer en production
    clientSecret: 'your-client-secret',
    organization: 'idem',
    application: 'idem-dashboard',
    redirectUri: 'https://console.idem.africa/auth/callback',
  },
  services: {
    domain: 'https://idem.africa',
    dashboard: {
      url: 'https://console.idem.africa',
    },
    api: {
      url: 'https://api.idem.africa',
      version: 'v1',
      llmModel: 'gpt-3.5-turbo',
    },
    webgen: {
      url: 'https://appgen.idem.africa',
    },
    diagen: {
      url: 'http://chart.idem.africa',
    },
  },
};
