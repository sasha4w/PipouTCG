// Lancer via `pnpm test:e2e:cucumber` (charge .env.e2e ; API sur API_URL).
module.exports = {
  default: {
    paths: ['test/e2e/features/*.feature'],
    require: ['test/e2e/support/*.ts', 'test/e2e/steps/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress', 'json:reports/cucumber-report.json'],
    parallel: 1,
  },
};
