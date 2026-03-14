import {
  Before,
  After,
  BeforeAll,
  setDefaultTimeout,
} from '@cucumber/cucumber';
import { ApiWorld } from './world';
setDefaultTimeout(15000);
BeforeAll(async function () {
  const { request } = await import('@playwright/test');
  const ctx = await request.newContext({ baseURL: 'http://localhost:3000' });
  // Appelle une route de cleanup si tu en as une
  await ctx.dispose();
});
// Démarre l'API context avant chaque scénario
Before(async function (this: ApiWorld) {
  await this.initApiContext();
});

// Nettoie après chaque scénario
After(async function (this: ApiWorld) {
  await this.disposeApiContext();
});
