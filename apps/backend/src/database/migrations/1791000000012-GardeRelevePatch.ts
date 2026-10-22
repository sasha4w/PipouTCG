import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { GARDE_PATCHES } from '../garde-2026-10-patches';

/** Patch Garde / Relève / Teros : 15 cartes existantes mises à jour. */
export class GardeRelevePatch1791000000012 implements MigrationInterface {
  name = 'GardeRelevePatch1791000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      GARDE_PATCHES,
      'up',
      new Logger('GardeRelevePatch'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      GARDE_PATCHES,
      'down',
      new Logger('GardeRelevePatch'),
    );
  }
}
