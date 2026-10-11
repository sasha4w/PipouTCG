import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Un patchnote lu par un joueur (évite d'écrire une ligne par joueur à chaque patch). */
@Entity('patchnote_read')
export class PatchnoteRead {
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @PrimaryColumn({ name: 'patchnote_id' })
  patchnoteId!: number;

  @CreateDateColumn({
    name: 'read_at',
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  readAt!: Date;
}
