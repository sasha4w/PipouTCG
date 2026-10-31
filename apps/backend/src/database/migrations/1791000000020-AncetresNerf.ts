import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { ANCETRES_PATCHES } from '../ancetres-2026-10-patches';

/** Appel des ancêtres ne récupère plus un autre Appel des ancêtres. */
export class AncetresNerf1791000000020 implements MigrationInterface {
  name = 'AncetresNerf1791000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      ANCETRES_PATCHES,
      'up',
      new Logger('AncetresNerf'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      ANCETRES_PATCHES,
      'down',
      new Logger('AncetresNerf'),
    );
  }
}
