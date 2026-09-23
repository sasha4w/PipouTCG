import { Given, When, Then } from '@cucumber/cucumber';
import { expect, request } from '@playwright/test';
import { ApiWorld, HttpMethod, tokenFromLogin } from '../support/world';
import { setGold } from '../support/fixtures';

// Comptes créés par le BeforeAll (hooks.ts) : ne pas les ré-inscrire
const EXISTING_ACCOUNTS = [
  process.env.TEST_USER_EMAIL || '',
  process.env.ADMIN_EMAIL || '',
].filter(Boolean);

function credentials(emailVar: string, passwordVar: string) {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    throw new Error(`${emailVar} et ${passwordVar} doivent être définis`);
  }
  return { email, password };
}

// ─────────────────────────────────────────────
// GIVEN — Authentification & setup
// ─────────────────────────────────────────────

Given(
  'je suis connecté en tant que joueur test',
  async function (this: ApiWorld) {
    const { email, password } = credentials(
      'TEST_USER_EMAIL',
      'TEST_USER_PASSWORD',
    );
    await this.loginAs(email, password);
  },
);

Given(
  'je suis connecté en tant que {string} avec le mot de passe {string}',
  async function (this: ApiWorld, rawEmail: string, password: string) {
    const email = resolvePath(rawEmail, this.createdIds);
    if (!EXISTING_ACCOUNTS.includes(email)) {
      await this.apiContext.post('/auth/register', {
        data: {
          username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_'),
          email,
          password,
        },
      });
    }
    await this.loginAs(email, password);
  },
);

Given("je suis connecté en tant qu'admin", async function (this: ApiWorld) {
  const { email, password } = credentials('ADMIN_EMAIL', 'ADMIN_PASSWORD');
  await this.loginAs(email, password);
});

Given(
  'un utilisateur {string} avec le mot de passe {string} existe',
  async function (this: ApiWorld, rawEmail: string, password: string) {
    const email = resolvePath(rawEmail, this.createdIds);
    // 409 acceptable (déjà créé)
    await this.apiContext.post('/auth/register', {
      data: {
        username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_'),
        email,
        password,
      },
    });
  },
);

Given(
  "{string} possède {int} pièces d'or",
  async function (this: ApiWorld, email: string, gold: number) {
    await setGold(resolvePath(email, this.createdIds), gold);
  },
);

Given(
  "un booster existe avec l'id sauvegardé sous {string}",
  function (this: ApiWorld, key: string) {
    expect(
      this.createdIds[key],
      `Aucun id sauvegardé sous "${key}"`,
    ).toBeTruthy();
  },
);

Given(
  "j'ai un booster dans mon inventaire avec l'id {string}",
  function (this: ApiWorld, key: string) {
    expect(
      this.createdIds[key],
      `Aucun id sauvegardé sous "${key}"`,
    ).toBeTruthy();
  },
);

// ─────────────────────────────────────────────
// WHEN — Requêtes HTTP
// ─────────────────────────────────────────────

const methodOf = (verb: string) => verb.toLowerCase() as HttpMethod;
const parseBody = (world: ApiWorld, body: string): unknown =>
  JSON.parse(resolvePath(body, world.createdIds));

When(
  "j'envoie une requête GET sur {string} sans authentification",
  async function (this: ApiWorld, path: string) {
    const anonymous = await request.newContext({ baseURL: this.baseUrl });
    await this.send(
      'get',
      resolvePath(path, this.createdIds),
      undefined,
      anonymous,
    );
    await anonymous.dispose();
  },
);

When(
  "j'envoie une requête POST sur {string} sans authentification",
  async function (this: ApiWorld, path: string) {
    const anonymous = await request.newContext({ baseURL: this.baseUrl });
    await this.send(
      'post',
      resolvePath(path, this.createdIds),
      undefined,
      anonymous,
    );
    await anonymous.dispose();
  },
);

When(
  "j'envoie une requête POST non authentifiée sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    const anonymous = await request.newContext({ baseURL: this.baseUrl });
    await this.send('post', path, parseBody(this, body), anonymous);
    await anonymous.dispose();
  },
);

When(
  "j'envoie une requête GET sur {string}",
  async function (this: ApiWorld, path: string) {
    await this.send('get', path);
  },
);

When(
  "j'envoie une requête POST sur {string} avec le body:",
  async function (this: ApiWorld, path: string, body: string) {
    await this.send('post', path, parseBody(this, body));
  },
);

When(
  /^j'envoie une requête (GET|POST|PATCH|DELETE) authentifiée sur "([^"]*)"$/,
  async function (this: ApiWorld, verb: string, path: string) {
    await this.send(methodOf(verb), resolvePath(path, this.createdIds));
  },
);

When(
  /^j'envoie une requête (POST|PUT|PATCH) authentifiée sur "([^"]*)" avec le body:$/,
  async function (this: ApiWorld, verb: string, path: string, body: string) {
    await this.send(
      methodOf(verb),
      resolvePath(path, this.createdIds),
      parseBody(this, body),
    );
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

Then('la réponse pose le cookie de session', function (this: ApiWorld) {
  expect(tokenFromLogin(this.response), 'Pas de cookie "token"').toBeTruthy();
});

Then('la réponse est un tableau', function (this: ApiWorld) {
  expect(Array.isArray(this.responseBody)).toBe(true);
});

Then(
  'la réponse contient au moins {int} élément',
  function (this: ApiWorld, count: number) {
    const body = this.responseBody;
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBeGreaterThanOrEqual(count);
  },
);

Then(
  "je sauvegarde l'id sous {string}",
  function (this: ApiWorld, key: string) {
    const { id } = this.bodyObject();
    expect(typeof id, `Pas d'id numérique dans la réponse`).toBe('number');
    this.createdIds[key] = id as number;
  },
);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function resolvePath(path: string, ids: Record<string, number>): string {
  return path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const id = ids[key];
    if (!id) throw new Error(`Aucun id sauvegardé sous "${key}"`);
    return String(id);
  });
}
