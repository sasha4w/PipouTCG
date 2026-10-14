import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Patchnote } from './patchnote.entity';

/** Un patchnote lu par un joueur (évite d'écrire une ligne par joueur à chaque patch). */
@Entity('patchnote_read')
export class PatchnoteRead {
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @PrimaryColumn({ name: 'patchnote_id' })
  patchnoteId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_patchnote_read_user',
  })
  user!: User;

  @ManyToOne(() => Patchnote, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'patchnote_id',
    foreignKeyConstraintName: 'fk_patchnote_read_patchnote',
  })
  patchnote!: Patchnote;

  @CreateDateColumn({
    name: 'read_at',
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  readAt!: Date;
}
