import type { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { planBalancePatch } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';

/**
 * Applique des patchs de cartes (avant / après) dans un sens, sans jamais
 * écraser une carte modifiée à la main (avertissement à la place).
 */
export async function applyBalancePatches(
  queryRunner: QueryRunner,
  patches: BalancePatch[],
  direction: 'up' | 'down',
  logger: Logger,
): Promise<void> {
  for (const patch of patches) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `atk`, `hp`, `cost`, `effects` FROM `card` WHERE `name` = ?',
      [from.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      atk: number;
      hp: number;
      cost: number;
      effects: unknown;
    }[];
    const current = rows[0];
    const decision = planBalancePatch(current, patch, direction);
    if (decision === 'apply' && current) {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `atk` = ?, `hp` = ?, `cost` = ?, `effects` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.atk,
          to.hp,
          to.cost,
          to.effects === null ? null : JSON.stringify(to.effects),
          current.id,
        ],
      );
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte « ${from.name} » : absente ou différente de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
