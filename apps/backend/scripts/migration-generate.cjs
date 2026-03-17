const { spawnSync } = require('node:child_process');

// Usage:
//   npm run migration:generate -- InitSchema
//   npm run migration:generate -- add-user-reset-token
const name = process.argv[2];
if (!name) {
  console.error('Missing migration name.\n\nUsage:\n  npm run migration:generate -- InitSchema');
  process.exit(1);
}

const migrationPath = `src/database/migrations/${name}`;

const res = spawnSync(
  'dotenv',
  [
    '-e',
    '.env',
    '--',
    'node',
    '-r',
    'ts-node/register',
    '-r',
    'tsconfig-paths/register',
    './node_modules/typeorm/cli.js',
    '-d',
    'src/database/data-source.ts',
    'migration:generate',
    migrationPath,
  ],
  { stdio: 'inherit', shell: true },
);

process.exit(res.status ?? 1);

