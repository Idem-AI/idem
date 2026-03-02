import { SDK } from 'casdoor-nodejs-sdk';
import logger from './logger';

interface CasdoorConfig {
  endpoint: string;
  clientId: string;
  clientSecret: string;
  certificate: string;
  orgName: string;
  appName?: string;
}

class CasdoorService {
  private sdk: SDK | null = null;
  private config: CasdoorConfig;

  constructor() {
    this.config = {
      endpoint: process.env.CASDOOR_ENDPOINT || 'http://localhost:8000',
      clientId: process.env.CASDOOR_CLIENT_ID || '',
      clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
      certificate: process.env.CASDOOR_CERTIFICATE || '',
      orgName: process.env.CASDOOR_ORGANIZATION || 'idem',
      appName: process.env.CASDOOR_APPLICATION || 'idem-api',
    };
  }

  async initialize(): Promise<void> {
    try {
      this.sdk = new SDK(this.config);
      logger.info('Casdoor SDK initialized successfully', {
        endpoint: this.config.endpoint,
        organization: this.config.orgName,
        application: this.config.appName,
      });
    } catch (error: any) {
      logger.error('Failed to initialize Casdoor SDK', { error: error.message });
      throw error;
    }
  }

  getSdk(): any {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized. Call initialize() first.');
    }
    return this.sdk;
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.getSignInUrl(redirectUri);
  }

  async parseJwtToken(token: string): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.parseJwtToken(token);
  }

  async getUser(name: string): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.getUser(name);
  }

  async getUserByEmail(email: string): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    const response = await this.sdk.getUsers();
    return response.data.data.find((u: any) => u.email === email);
  }

  async updateUser(user: any): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.updateUser(user);
  }

  async deleteUser(user: any): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.deleteUser(user);
  }

  async addUser(user: any): Promise<any> {
    if (!this.sdk) {
      throw new Error('Casdoor SDK not initialized');
    }
    return this.sdk.addUser(user);
  }
}

export const casdoorService = new CasdoorService();
