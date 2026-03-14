import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { APIRequestContext, request } from '@playwright/test';

export interface UserTokens {
  accessToken: string;
  userId?: number;
}

export class ApiWorld extends World {
  apiContext!: APIRequestContext;
  response!: any;
  responseBody!: any;
  baseUrl = process.env.API_URL || 'http://localhost:3000';

  // Stockage des tokens et données entre les steps
  authTokens: Record<string, string> = {};
  createdIds: Record<string, number> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }

  async initApiContext(token?: string) {
    this.apiContext = await request.newContext({
      baseURL: this.baseUrl,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  async disposeApiContext() {
    await this.apiContext?.dispose();
  }

  /** Recrée le contexte avec un nouveau token */
  async setAuthToken(token: string) {
    await this.disposeApiContext();
    await this.initApiContext(token);
  }
}

setWorldConstructor(ApiWorld);
