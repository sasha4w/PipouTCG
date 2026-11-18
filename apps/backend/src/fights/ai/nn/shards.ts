import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { extname } from 'node:path';

/** Valeur de `--name` sur la ligne de commande ; erreur si le flag n'a pas de valeur. */
export function arg(name: string): string | undefined {
  const k = process.argv.indexOf(`--${name}`);
  if (k < 0) return undefined;
  const value = process.argv[k + 1];
  if (value === undefined || value.startsWith('--'))
    throw new Error(`--${name} attend une valeur`);
  return value;
}

export function num(name: string, fallback: number): number {
  const raw = arg(name);
  return raw === undefined ? fallback : Number(raw);
}

/**
 * Relance `script` dans `workers` processus, chacun avec `--shard k --shards n`
 * en plus de `args`. Rejette si un processus échoue, et arrête alors tous les
 * autres (de même sur SIGINT/SIGTERM).
 */
export async function forkShards(
  script: string,
  args: string[],
  workers: number,
): Promise<void> {
  const ts = extname(script) === '.ts';
  const children: ChildProcess[] = [];
  const killAll = () => {
    for (const c of children) if (c.exitCode === null) c.kill();
  };
  const onSignal = () => {
    killAll();
    process.exit(1);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
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
            children.push(child);
            child.once('error', (err) => {
              killAll();
              reject(err);
            });
            child.once('exit', (code) => {
              if (code === 0) resolve();
              else {
                killAll();
                reject(new Error(`Processus ${shard} arrêté (code ${code})`));
              }
            });
          }),
      ),
    );
  } finally {
    killAll();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}
