import { constants, createBrotliCompress } from 'node:zlib';
import type { GameState } from '../fights/interfaces/game-state.interface';

/** Clés retirées de l'état : texte, événements d'animation, identité réseau. */
const DROPPED_KEYS = new Set(['log', 'pendingEvents', 'socketId', 'username']);

/** État sérialisé pour la trace (cartes de base comprises, telles qu'en partie). */
export function snapshotState(game: GameState): string {
  return JSON.stringify(game, (key, value: unknown) =>
    DROPPED_KEYS.has(key) ? undefined : value,
  );
}

/**
 * Trace NDJSON compressée en brotli au fil de la partie : seuls les morceaux
 * compressés restent en mémoire. La fenêtre de 1 Mo couvre une quinzaine
 * d'états, ce qui suffit à profiter de leur ressemblance.
 */
export class TraceWriter {
  lines = 0;
  private readonly stream = createBrotliCompress({
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 5,
      [constants.BROTLI_PARAM_LGWIN]: 20,
    },
  });
  private readonly chunks: Buffer[] = [];
  private readonly result: Promise<Buffer>;

  constructor() {
    this.stream.on('data', (chunk: Buffer) => this.chunks.push(chunk));
    this.result = new Promise((resolve, reject) => {
      this.stream.once('end', () => resolve(Buffer.concat(this.chunks)));
      this.stream.once('error', reject);
    });
    // Après abort(), personne n'attend le résultat
    this.result.catch(() => undefined);
  }

  /** Ajoute une ligne (objet JSON déjà sérialisé). */
  writeLine(json: string): void {
    this.stream.write(json + '\n');
    this.lines += 1;
  }

  finish(): Promise<Buffer> {
    this.stream.end();
    return this.result;
  }

  abort(): void {
    this.stream.destroy();
    this.chunks.length = 0;
  }
}
