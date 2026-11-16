import { existsSync } from 'node:fs';

/** Charge ENV_FILE (ou .env) avant que la source de données ne lise process.env. */
const envFile = process.env.ENV_FILE ?? '.env';
if (existsSync(envFile)) process.loadEnvFile(envFile);
