import { Injectable, Logger } from '@nestjs/common';

export const TURN_TIMEOUT_MS = 90_000;

@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);
  private timeouts = new Map<number, NodeJS.Timeout>();

  /** (Re)lance le compte à rebours du match ; onTimeout est appelé s'il expire. */
  schedule(matchId: number, onTimeout: () => Promise<void> | void): void {
    this.clear(matchId);
    const handle = setTimeout(() => {
      this.timeouts.delete(matchId);
      // Rejet non géré dans un setTimeout = arrêt du processus Node : on le rattrape
      Promise.resolve()
        .then(onTimeout)
        .catch((err: unknown) =>
          this.logger.error(
            `Timeout du match ${matchId} en échec`,
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }, TURN_TIMEOUT_MS);
    this.timeouts.set(matchId, handle);
  }

  clear(matchId: number): void {
    const existing = this.timeouts.get(matchId);
    if (existing) clearTimeout(existing);
    this.timeouts.delete(matchId);
  }

  has(matchId: number): boolean {
    return this.timeouts.has(matchId);
  }
}
