import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_NAMES } from './features';
import type { LearnedWeights } from './learned-eval';
import type { Sample } from './selfplay-data';
import { train, weightsModule } from './train';

/**
 * Entraîne la note sur des positions d'auto-jeu, ou adopte un fichier de poids.
 *
 *   pnpm --filter @pipou/backend ai:train train <données.jsonl> [autres.jsonl…]
 *     --generation <n> --out <poids.json> [--date AAAA-MM-JJ]
 *   pnpm --filter @pipou/backend ai:train adopt <poids.json>
 *
 * `adopt` réécrit `learned-weights.ts` : à faire seulement après les contrôles
 * (banc de positions, miroir).
 */
function raw(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function runTrain(files: string[]): void {
  const out = raw('out');
  const generation = Number(raw('generation'));
  if (files.length === 0 || !out || !Number.isInteger(generation))
    throw new Error(
      'Usage : ai:train train <données.jsonl…> --generation <n> --out <poids.json>',
    );
  const samples: Sample[] = [];
  for (const file of files)
    for (const line of readFileSync(file, 'utf8').split('\n'))
      if (line) samples.push(JSON.parse(line) as Sample);
  // La date est une étiquette : elle n'entre dans aucun calcul
  const date = raw('date') ?? new Date().toISOString().slice(0, 10);
  const { weights, byArchetype } = train(samples, generation, date);
  writeFileSync(out, JSON.stringify(weights, null, 2));

  console.log(
    `Génération ${generation} : ${weights.positions} positions, ${(100 * weights.holdoutAccuracy).toFixed(1)} % de vainqueurs bien prédits (parties mises de côté).`,
  );
  for (const [a, r] of Object.entries(byArchetype)) {
    console.log(
      `\n${a} : ${r.positions} positions, précision ${(100 * r.accuracy).toFixed(1)} %, perte ${r.loss.toFixed(4)}`,
    );
    const row = weights.weights[a as keyof typeof weights.weights];
    FEATURE_NAMES.map((name, i) => ({ name, w: row[i] }))
      .sort((x, y) => Math.abs(y.w) - Math.abs(x.w))
      .slice(0, 10)
      .forEach(({ name, w }) =>
        console.log(`  ${name.padEnd(16)} ${w >= 0 ? '+' : ''}${w.toFixed(4)}`),
      );
  }
  console.log(`\nPoids : ${out}`);
}

function runAdopt(file: string | undefined): void {
  if (!file) throw new Error('Usage : ai:train adopt <poids.json>');
  const weights = JSON.parse(readFileSync(file, 'utf8')) as LearnedWeights;
  const target = join(__dirname, 'learned-weights.ts');
  writeFileSync(target, weightsModule(weights));
  console.log(`Génération ${weights.generation} adoptée : ${target}`);
}

const [command, ...rest] = process.argv.slice(2);
const positional = rest.filter(
  (arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--'),
);
if (command === 'train') runTrain(positional);
else if (command === 'adopt') runAdopt(positional[0]);
else throw new Error('Commande attendue : train ou adopt');
