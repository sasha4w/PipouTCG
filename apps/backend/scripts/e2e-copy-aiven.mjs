// Copie la base distante (Aiven, lue via .env) dans le MySQL local de l'e2e
// (docker-compose, .env.e2e), pour lancer l'e2e sur les vraies données :
//   pnpm e2e:copy-aiven && pnpm e2e:api   (puis)   E2E_RESET=false pnpm test:e2e:cucumber
//
// Lecture seule côté Aiven (mysqldump --single-transaction). Le dump contient des
// données de joueurs (hash de mots de passe compris) : il reste dans .e2e/, ignoré par git.
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workDir = join(backendDir, '.e2e');
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', 'db'];

function readEnv(file) {
  const env = {};
  for (const line of readFileSync(join(backendDir, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function run(command, args, { env = {}, stdin, stdout } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: backendDir,
      env: { ...process.env, ...env },
      stdio: [stdin ? 'pipe' : 'ignore', stdout ? 'pipe' : 'inherit', 'inherit'],
    });
    if (stdin) createReadStream(stdin).pipe(child.stdin);
    if (stdout) child.stdout.pipe(createWriteStream(stdout));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} ${args[0]} a échoué (code ${code})`)),
    );
  });
}

const source = readEnv('.env');
const target = readEnv('.env.e2e');

if (LOCAL_HOSTS.includes(source.DB_HOST)) {
  throw new Error('.env pointe déjà sur une base locale : rien à copier.');
}
if (!LOCAL_HOSTS.includes(target.DB_HOST)) {
  throw new Error(`Cible refusée : .env.e2e doit pointer sur une base locale (DB_HOST=${target.DB_HOST}).`);
}

mkdirSync(workDir, { recursive: true });
const dumpFile = join(workDir, 'aiven-dump.sql');
const sslArgs = [];
if (source.DB_SSL_CA_BASE64) {
  writeFileSync(join(workDir, 'aiven-ca.pem'), Buffer.from(source.DB_SSL_CA_BASE64, 'base64'));
  sslArgs.push('--ssl-ca=/work/aiven-ca.pem', '--ssl-mode=VERIFY_CA');
}

console.log(`Dump de ${source.DB_NAME} depuis ${source.DB_HOST.replace(/^[^.]+/, '***')} (lecture seule)…`);
await run(
  'docker',
  [
    'run', '--rm', '-e', 'MYSQL_PWD', '-v', `${workDir}:/work`, 'mysql:8.4',
    'mysqldump', ...sslArgs,
    '-h', source.DB_HOST, '-P', source.DB_PORT || '3306', '-u', source.DB_USER,
    '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF',
    '--skip-triggers', source.DB_NAME,
  ],
  { env: { MYSQL_PWD: source.DB_PASSWORD }, stdout: dumpFile },
);

console.log(`Chargement dans la base locale ${target.DB_NAME}…`);
const mysql = (...sql) => [
  'compose', 'exec', '-T', '-e', 'MYSQL_PWD', 'db', 'mysql', '-u', target.DB_USER, ...sql,
];
await run('docker', mysql('-e', `DROP DATABASE IF EXISTS \`${target.DB_NAME}\`; CREATE DATABASE \`${target.DB_NAME}\`;`), {
  env: { MYSQL_PWD: target.DB_PASSWORD },
});
await run('docker', mysql(target.DB_NAME), {
  env: { MYSQL_PWD: target.DB_PASSWORD },
  stdin: dumpFile,
});

console.log('Copie terminée. Lancer l\'API e2e puis : E2E_RESET=false pnpm test:e2e:cucumber');
