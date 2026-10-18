import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ADVENTURE_DAILY_CAP_DEFAULT } from '@pipou/shared';

/** Réglages globaux de l'aventure (ligne unique, id = 1). */
@Entity('adventure_settings')
export class AdventureSettings {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({
    name: 'daily_cap',
    type: 'int',
    default: ADVENTURE_DAILY_CAP_DEFAULT,
  })
  dailyCap!: number;
}
