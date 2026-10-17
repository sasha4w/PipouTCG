import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AchievementFamily } from '@pipou/shared';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PlayerStats } from '../fights/entities/player-stats.entity';
import { LoginStreak } from '../daily-reward/login-streak.entity';
import { HIGH_RARITIES, toAchievementValues } from './achievement-values';

const HIGH_RARITY_SQL = HIGH_RARITIES.map((r) => `'${r}'`).join(', ');

@Injectable()
export class AchievementStatsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  /** Valeur de chaque famille, lue depuis les compteurs existants (rétroactif par construction). */
  async getValues(
    userId: number,
  ): Promise<{ values: Record<AchievementFamily, number>; totalSets: number }> {
    const [user, fights, streak, cards, sets] = await Promise.all([
      this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: [
          'id',
          'boostersOpened',
          'cardsBought',
          'cardsSold',
          'moneyEarned',
          'experience',
          'questsCompleted',
        ],
      }),
      this.dataSource.getRepository(PlayerStats).findOne({ where: { userId } }),
      this.dataSource.getRepository(LoginStreak).findOne({ where: { userId } }),
      this.dataSource.query(
        `SELECT COUNT(DISTINCT uc.card_id) AS uniqueCards,
                COALESCE(SUM(CASE WHEN c.rarity IN (${HIGH_RARITY_SQL}) THEN uc.quantity ELSE 0 END), 0) AS highRarity
           FROM user_card uc JOIN card c ON c.id = uc.card_id
          WHERE uc.user_id = ?`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(c.id) AS total, COUNT(owned.card_id) AS owned
           FROM card_set s
           JOIN card c ON c.card_set_id = s.id
           LEFT JOIN (SELECT DISTINCT card_id FROM user_card WHERE user_id = ?) owned
             ON owned.card_id = c.id
          GROUP BY s.id`,
        [userId],
      ),
    ]);

    const setRows = sets.map((s) => ({
      total: Number(s.total),
      owned: Number(s.owned),
    }));
    const values = toAchievementValues({
      user: user ?? {
        boostersOpened: 0,
        cardsBought: 0,
        cardsSold: 0,
        moneyEarned: 0,
        questsCompleted: 0,
      },
      level: this.usersService.calculateLevelData(user?.experience ?? 0).level,
      fights,
      longestStreak: streak?.longestStreak ?? null,
      uniqueCards: Number(cards[0]?.uniqueCards ?? 0),
      highRarity: Number(cards[0]?.highRarity ?? 0),
      sets: setRows,
    });
    return { values, totalSets: setRows.length };
  }
}
