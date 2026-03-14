const config = {
  default: {
    paths: ['test/e2e/features/*.feature'],
    require: ['test/e2e/support/*.ts', 'test/e2e/steps/*.ts'],
    requireModule: ['ts-node/register'],
    timeout: 15000,
    format: [
      'progress-bar',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
    parallel: 1,
    publishQuiet: true,
  },
};
export default config;
