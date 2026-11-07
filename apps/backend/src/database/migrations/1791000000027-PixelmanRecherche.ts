import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { PIXELMAN_RECHERCHE_PATCHES } from '../pixelman-recherche-patches';

/** Pixel Ghost cherche un monstre Pixelman, Drone Éclaireur un support Pixelman. */
export class PixelmanRecherche1791000000027 implements MigrationInterface {
  name = 'PixelmanRecherche1791000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      PIXELMAN_RECHERCHE_PATCHES,
      'up',
      new Logger('PixelmanRecherche'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      PIXELMAN_RECHERCHE_PATCHES,
      'down',
      new Logger('PixelmanRecherche'),
    );
  }
}
