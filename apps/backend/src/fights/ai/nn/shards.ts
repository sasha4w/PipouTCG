import { fork } from 'node:child_process';
import { extname } from 'node:path';

/** Valeur de `--name` sur la ligne de commande. */
export function arg(name: string): string | undefined {
  const k = process.argv.indexOf(`--${name}`);
  return k >= 0 ? process.argv[k + 1] : undefined;
}

export function num(name: string, fallback: number): number {
  const raw = arg(name);
  return raw === undefined ? fallback : Number(raw);
}

/**
 * Relance `script` dans `workers` processus, chacun avec `--shard k --shards n`
 * en plus de `args`. Rejette si un processus échoue.
 */
export async function forkShards(
  script: string,
  args: string[],
  workers: number,
): Promise<void> {
  const ts = extname(script) === '.ts';
  await Promise.all(
    Array.from(
      { length: workers },
      (_, shard) =>
        new Promise<void>((resolve, reject) => {
          const child = fork(
            script,
            [...args, '--shard', String(shard), '--shards', String(workers)],
            {
              execArgv: ts
                ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
                : [],
              env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
            },
          );
          child.once('exit', (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`Processus ${shard} arrêté (code ${code})`)),
          );
        }),
    ),
  );
}
