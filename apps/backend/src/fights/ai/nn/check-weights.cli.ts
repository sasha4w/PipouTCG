import { PARITY_TOLERANCE, parityError } from './mlp';
import { readWeights } from './weights';

/**
 * Vérifie qu'un fichier de poids est lisible et que l'inférence TypeScript
 * retrouve les sorties PyTorch figées à l'export.
 *
 *   pnpm --filter @pipou/backend ai:check-weights <poids.json>
 */
const path = process.argv[2];
if (!path) {
  console.error('Usage : ai:check-weights <poids.json>');
  process.exit(1);
}
try {
  const w = readWeights(path);
  const error = parityError(w);
  const ok = error <= PARITY_TOLERANCE;
  console.log(
    `Parité génération ${w.generation} : écart max ${error.toExponential(2)} (${ok ? 'OK' : 'REFUSÉ'})`,
  );
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
