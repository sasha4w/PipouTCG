import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { APIRequestContext, APIResponse, request } from '@playwright/test';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const apiUrl = () => process.env.API_URL ?? 'http://localhost:3001';

/** Extrait le JWT du cookie `token` posé par POST /auth/login. */
export function tokenFromLogin(res: APIResponse): string | undefined {
  const setCookie = res
    .headersArray()
    .find(
      (h) =>
        h.name.toLowerCase() === 'set-cookie' && h.value.startsWith('token='),
    );
  return setCookie?.value.split(';')[0].slice('token='.length) || undefined;
}

export class ApiWorld extends World {
  apiContext!: APIRequestContext;
  response!: APIResponse;
  responseBody: unknown = null;
  baseUrl = apiUrl();

  // Stockage des tokens et données entre les steps
  authTokens: Record<string, string> = {};
  createdIds: Record<string, number> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** L'API lit le JWT dans le cookie `token` (voir JwtStrategy). */
  async initApiContext(token?: string) {
    this.apiContext = await request.newContext({
      baseURL: this.baseUrl,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        ...(token ? { Cookie: `token=${token}` } : {}),
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

  /** Se connecte, mémorise le token et authentifie les requêtes suivantes. */
  async loginAs(email: string, password: string): Promise<string> {
    const res = await this.apiContext.post('/auth/login', {
      data: { email, password },
    });
    const token = tokenFromLogin(res);
    if (!res.ok() || !token) {
      throw new Error(
        `Connexion impossible pour ${email} (HTTP ${res.status()}): ${await res.text()}`,
      );
    }
    this.authTokens[email] = token;
    await this.setAuthToken(token);
    return token;
  }

  /** Envoie la requête et mémorise statut + corps JSON pour les assertions. */
  async send(
    method: HttpMethod,
    path: string,
    data?: unknown,
    context: APIRequestContext = this.apiContext,
  ) {
    this.response = await context[method](
      path,
      data === undefined ? undefined : { data },
    );
    this.responseBody = await this.response.json().catch(() => null);
  }

  /** Corps de la dernière réponse vu comme un objet JSON. */
  bodyObject(): Record<string, unknown> {
    const body = this.responseBody;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error(`Réponse non objet: ${JSON.stringify(body)}`);
    }
    return body as Record<string, unknown>;
  }
}

setWorldConstructor(ApiWorld);
