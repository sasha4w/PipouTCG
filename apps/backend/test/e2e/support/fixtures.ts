import { APIRequestContext, request } from '@playwright/test';
import { createConnection } from 'mysql2/promise';
import { apiUrl, tokenFromLogin } from './world';

/**
 * Ids des données créées une fois avant la suite, utilisables dans les
 * features via `{clé}` (chemins et corps JSON). Les scénarios qui en créent
 * d'autres les sauvegardent avec « je sauvegarde l'id sous … ».
 */
export const fixtures: Record<string, number> = {};

export const ADMIN_STARTING_GOLD = 10_000;
export const PLAYER_STARTING_GOLD = 500;
/** Hors de portée du joueur test : sert aux cas « pas assez d'or ». */
export const UNAFFORDABLE_PRICE = 100_000;

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} doit être défini (voir .env.e2e)`);
  return value;
}

async function expectJson(
  label: string,
  res: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<Record<string, unknown>> {
  if (!res.ok()) {
    throw new Error(
      `${label} a échoué (HTTP ${res.status()}): ${await res.text()}`,
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

async function idOf(
  label: string,
  res: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<number> {
  const { id } = await expectJson(label, res);
  if (typeof id !== 'number')
    throw new Error(`${label} : pas d'id dans la réponse`);
  return id;
}

/** Contexte HTTP connecté (l'API lit le JWT dans le cookie `token`). */
async function loggedIn(email: string, password: string) {
  const anonymous = await request.newContext({ baseURL: apiUrl() });
  const res = await anonymous.post('/auth/login', {
    data: { email, password },
  });
  const token = tokenFromLogin(res);
  await anonymous.dispose();
  if (!token)
    throw new Error(`Connexion impossible pour ${email}: ${res.status()}`);
  return request.newContext({
    baseURL: apiUrl(),
    extraHTTPHeaders: { Cookie: `token=${token}` },
  });
}

async function registerAccounts(
  accounts: { email: string; password: string }[],
) {
  const ctx = await request.newContext({ baseURL: apiUrl() });
  for (const { email, password } of accounts) {
    const res = await ctx.post('/auth/register', {
      data: {
        username: email.split('@')[0].replace(/\W/g, '_'),
        email,
        password,
      },
    });
    if (!res.ok() && res.status() !== 409) {
      throw new Error(
        `Inscription de ${email} impossible: ${await res.text()}`,
      );
    }
  }
  await ctx.dispose();
}

function connectDb() {
  return createConnection({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: requireEnv('DB_NAME'),
  });
}

/** Repart d'une base vide à chaque lancement : les scénarios sont rejouables. */
async function truncateAllTables() {
  const db = await connectDb();
  const [rows] = await db.query(
    'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
  );
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { name } of rows as { name: string }[]) {
    await db.query(`TRUNCATE TABLE \`${name}\``);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  await db.end();
}

/** Aucune route ne permet de créditer de l'or : SQL direct (setup de test). */
export async function setGold(email: string, gold: number) {
  const db = await connectDb();
  await db.execute('UPDATE `user` SET `gold` = ? WHERE `email` = ?', [
    gold,
    email,
  ]);
  await db.end();
}

/** Aucune route ne permet de devenir admin : SQL direct. */
async function grantAdmin(email: string) {
  const db = await connectDb();
  await db.execute('UPDATE `user` SET `is_admin` = 1 WHERE `email` = ?', [
    email,
  ]);
  await db.end();
  await setGold(email, ADMIN_STARTING_GOLD);
}

async function seedCatalog(admin: APIRequestContext) {
  const suffix = Date.now();
  fixtures.setId = await idOf(
    'Création du set',
    await admin.post('/card-sets', { data: { name: `E2E Set ${suffix}` } }),
  );

  for (const [index, rarity] of RARITIES.entries()) {
    const id = await idOf(
      `Création de la carte ${rarity}`,
      await admin.post('/cards', {
        data: {
          name: `E2E ${rarity} ${suffix}`,
          rarity,
          type: 'monster',
          atk: 10,
          hp: 10,
          cardSetId: fixtures.setId,
        },
      }),
    );
    if (index === 0) fixtures.cardId = id;
    if (index === 1) fixtures.cardId2 = id;
  }

  fixtures.boosterId = await idOf(
    'Création du booster payant',
    await admin.post('/boosters', {
      data: {
        name: `E2E Booster ${suffix}`,
        price: UNAFFORDABLE_PRICE,
        cardNumber: 5,
        cardSetId: fixtures.setId,
      },
    }),
  );
  fixtures.cheapBoosterId = await idOf(
    'Création du booster à 1 or',
    await admin.post('/boosters', {
      data: {
        name: `E2E Cheap ${suffix}`,
        price: 1,
        cardNumber: 5,
        cardSetId: fixtures.setId,
      },
    }),
  );

  fixtures.bundleId = await idOf(
    'Création du bundle',
    await admin.post('/bundles', {
      data: { name: `E2E Bundle ${suffix}`, price: UNAFFORDABLE_PRICE },
    }),
  );
  await expectJson(
    'Contenu du bundle',
    await admin.post(`/bundles/${fixtures.bundleId}/contents`, {
      data: { items: [{ cardId: fixtures.cardId, quantity: 2 }] },
    }),
  );
}

async function userId(ctx: APIRequestContext, label: string) {
  const res = await ctx.get('/users/me');
  return idOf(label, res);
}

/** Comptes + catalogue, sur une base locale uniquement. */
export async function seedAll() {
  const dbHost = requireEnv('DB_HOST');
  if (!['127.0.0.1', 'localhost', 'db'].includes(dbHost)) {
    throw new Error(
      `Tests e2e refusés : DB_HOST=${dbHost} n'est pas une base locale. Utiliser .env.e2e.`,
    );
  }

  const player = {
    email: requireEnv('TEST_USER_EMAIL'),
    password: requireEnv('TEST_USER_PASSWORD'),
  };
  const admin = {
    email: requireEnv('ADMIN_EMAIL'),
    password: requireEnv('ADMIN_PASSWORD'),
  };

  await truncateAllTables();
  await registerAccounts([player, admin]);
  await grantAdmin(admin.email);
  await setGold(player.email, PLAYER_STARTING_GOLD);

  const adminCtx = await loggedIn(admin.email, admin.password);
  await seedCatalog(adminCtx);
  fixtures.adminUserId = await userId(adminCtx, 'Profil admin');
  await adminCtx.dispose();

  const playerCtx = await loggedIn(player.email, player.password);
  fixtures.testUserId = await userId(playerCtx, 'Profil joueur');
  await playerCtx.dispose();
}
