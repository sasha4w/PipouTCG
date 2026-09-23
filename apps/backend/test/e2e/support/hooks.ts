import {
  Before,
  After,
  BeforeAll,
  setDefaultTimeout,
} from '@cucumber/cucumber';
import { ApiWorld } from './world';
import { fixtures, seedAll } from './fixtures';

setDefaultTimeout(15000);

// Comptes + catalogue créés une fois sur la base locale (voir fixtures.ts)
BeforeAll({ timeout: 60000 }, async function () {
  await seedAll();
});

// Démarre l'API context avant chaque scénario, avec les ids des fixtures
Before(async function (this: ApiWorld) {
  this.createdIds = { ...fixtures };
  await this.initApiContext();
});

// Nettoie après chaque scénario
After(async function (this: ApiWorld) {
  await this.disposeApiContext();
});
