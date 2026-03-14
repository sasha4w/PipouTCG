import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ApiWorld } from '../support/world';

// Comptes existants en base qui ne doivent pas être re-créés
const EXISTING_ACCOUNTS = [
  process.env.TEST_USER_EMAIL || '',
  process.env.ADMIN_EMAIL || '',
].filter(Boolean);

// ─────────────────────────────────────────────
// GIVEN — Authentification & setup
// ─────────────────────────────────────────────

Given(
  'je suis connecté en tant que joueur test',
  async function (this: ApiWorld) {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'TEST_USER_EMAIL et TEST_USER_PASSWORD doivent être définis dans .env',
      );
    }

    const res = await this.apiContext.post('/auth/login', {
      data: { email, password },
    });

    const body = await res.json();
    const token = body.access_token;
    expect(token, `Pas de token pour le joueur test`).toBeTruthy();

    this.authTokens[email] = token;
    await this.setAuthToken(token);
  },
);

Given(
  'je suis connecté en tant que {string} avec le mot de passe {string}',
  async function (this: ApiWorld, email: string, password: string) {
    // Skip le register pour les comptes déjà existants en base
    if (!EXISTING_ACCOUNTS.includes(email)) {
      await this.apiContext.post('/auth/register', {
        data: {
          username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_'),
          email,
          password,
        },
      });
    }

    const res = await this.apiContext.post('/auth/login', {
      data: { email, password },
    });

    const body = await res.json();
    const token = body.access_token;
    expect(token, `Pas de token pour ${email}`).toBeTruthy();

    this.authTokens[email] = token;
    await this.setAuthToken(token);
  },
);

Given("je suis connecté en tant qu'admin", async function (this: ApiWorld) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env',
    );
  }

  const res = await this.apiContext.post('/auth/login', {
    data: { email, password },
  });

  const body = await res.json();
  expect(body.access_token, 'Pas de token admin').toBeTruthy();
  await this.setAuthToken(body.access_token);
});

Given(
  'un utilisateur {string} avec le mot de passe {string} existe',
  async function (this: ApiWorld, email: string, password: string) {
    await this.apiContext.post('/auth/register', {
      data: {
        username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_'),
        email,
        password,
      },
    });
    // 409 acceptable (déjà créé)
  },
);

Given(
  "un booster existe avec l'id sauvegardé sous {string}",
  async function (this: ApiWorld, key: string) {
    expect(
      this.createdIds[key],
      `Aucun id sauvegardé sous "${key}"`,
    ).toBeTruthy();
  },
);

Given(
  "j'ai un booster dans mon inventaire avec l'id {string}",
  async function (this: ApiWorld, key: string) {
    expect(
      this.createdIds[key],
      `Aucun id sauvegardé sous "${key}"`,
    ).toBeTruthy();
  },
);

Given(
  "j'ai une carte dans mon inventaire avec l'id {string}",
  async function (this: ApiWorld, _key: string) {
    // Ce step suppose que la carte existe dans l'inventaire via des seeds
    // ou un setup préalable. Pour les tests complets, initialiser ici.
  },
);

Given(
  "j'ai une quête complétée avec l'id {string}",
  async function (this: ApiWorld, _key: string) {
    // Suppose qu'une quête est complétée via seed/setup.
  },
);

// ─────────────────────────────────────────────
// WHEN — Requêtes HTTP
// ─────────────────────────────────────────────

When(
  "j'envoie une requête GET sur {string} sans authentification",
  async function (this: ApiWorld, path: string) {
    const ctx = await (
      await import('@playwright/test')
    ).request.newContext({
      baseURL: this.baseUrl,
    });
    this.response = await ctx.get(path);
    this.responseBody = await this.response.json().catch(() => null);
    await ctx.dispose();
  },
);

When(
  "j'envoie une requête GET authentifiée sur {string}",
  async function (this: ApiWorld, path: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.get(resolvedPath);
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête POST sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    this.response = await this.apiContext.post(path, {
      data: JSON.parse(body),
    });
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête POST authentifiée sur {string}",
  async function (this: ApiWorld, path: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.post(resolvedPath);
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête POST authentifiée sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.post(resolvedPath, {
      data: JSON.parse(body),
    });
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête PUT authentifiée sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.put(resolvedPath, {
      data: JSON.parse(body),
    });
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête PATCH authentifiée sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.patch(resolvedPath, {
      data: JSON.parse(body),
    });
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête PATCH authentifiée sur {string}",
  async function (this: ApiWorld, path: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.patch(resolvedPath);
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête DELETE authentifiée sur {string}",
  async function (this: ApiWorld, path: string) {
    const resolvedPath = resolvePath(path, this.createdIds);
    this.response = await this.apiContext.delete(resolvedPath);
    this.responseBody = await this.response.json().catch(() => null);
  },
);

When(
  "j'envoie une requête GET sur {string}",
  async function (this: ApiWorld, path: string) {
    this.response = await this.apiContext.get(path);
    this.responseBody = await this.response.json().catch(() => null);
  },
);

// ─────────────────────────────────────────────
// THEN — Assertions
// ─────────────────────────────────────────────

Then(
  'le statut de réponse est {int}',
  function (this: ApiWorld, status: number) {
    expect(
      this.response.status(),
      `Body reçu: ${JSON.stringify(this.responseBody, null, 2)}`,
    ).toBe(status);
  },
);

Then(
  'la réponse contient un champ {string}',
  function (this: ApiWorld, field: string) {
    expect(this.responseBody).toHaveProperty(field);
  },
);

Then('la réponse est un tableau', function (this: ApiWorld) {
  expect(Array.isArray(this.responseBody)).toBe(true);
});

Then(
  'la réponse contient au moins {int} élément',
  function (this: ApiWorld, count: number) {
    expect(Array.isArray(this.responseBody)).toBe(true);
    expect(this.responseBody.length).toBeGreaterThanOrEqual(count);
  },
);

Then(
  "je sauvegarde l'id sous {string}",
  function (this: ApiWorld, key: string) {
    expect(this.responseBody.id, `Pas d'id dans la réponse`).toBeTruthy();
    this.createdIds[key] = this.responseBody.id;
  },
);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function resolvePath(path: string, ids: Record<string, number>): string {
  return path.replace(/\{(\w+)\}/g, (_, key) => {
    const id = ids[key];
    if (!id) throw new Error(`Aucun id sauvegardé sous "${key}"`);
    return String(id);
  });
}
