import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { NotificationType } from '@pipou/shared';
import { User } from '../users/user.entity';

/** Message de la boîte de réception d'un joueur. */
@Entity('notification')
@Index('idx_notification_user_created', ['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_notification_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  type!: NotificationType;

  /** Données propres au type, voir NotificationPayloadMap dans @pipou/shared. */
  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  /** Id de la ressource liée (user_quest pour QUEST_COMPLETED), pour marquer lu à la réclamation. */
  @Column({ name: 'ref_id', type: 'int', nullable: true, default: null })
  refId!: number | null;

  @Column({
    name: 'read_at',
    type: 'datetime',
    precision: 0,
    nullable: true,
    default: null,
  })
  readAt!: Date | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
