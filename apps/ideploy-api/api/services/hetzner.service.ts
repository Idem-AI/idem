/**
 * Hetzner Cloud API client — port of Coolify's HetznerService. Stateless:
 * constructed with a decrypted API token.
 */
import axios, { AxiosInstance } from 'axios';

export class HetznerService {
  private http: AxiosInstance;

  constructor(token: string) {
    this.http = axios.create({
      baseURL: 'https://api.hetzner.cloud/v1',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });
  }

  async getLocations(): Promise<unknown[]> {
    const { data } = await this.http.get('/locations');
    return data.locations ?? [];
  }

  async getServerTypes(): Promise<unknown[]> {
    const { data } = await this.http.get('/server_types');
    return data.server_types ?? [];
  }

  async getImages(): Promise<unknown[]> {
    const { data } = await this.http.get('/images', { params: { type: 'system' } });
    return data.images ?? [];
  }

  async uploadSshKey(name: string, publicKey: string): Promise<{ id: number }> {
    const { data } = await this.http.post('/ssh_keys', { name, public_key: publicKey });
    return data.ssh_key;
  }

  async createServer(params: {
    name: string;
    server_type: string;
    image: string;
    location?: string;
    ssh_keys?: number[];
    user_data?: string;
  }): Promise<unknown> {
    const { data } = await this.http.post('/servers', params);
    return data;
  }

  async getServer(serverId: number): Promise<unknown> {
    const { data } = await this.http.get(`/servers/${serverId}`);
    return data.server;
  }

  async deleteServer(serverId: number): Promise<void> {
    await this.http.delete(`/servers/${serverId}`);
  }
}
