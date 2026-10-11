import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Patchnote publié par un admin, visible par tous les joueurs. */
@Entity('patchnote')
export class Patchnote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
