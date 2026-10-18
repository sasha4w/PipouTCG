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
  async getValues(userId: number): Promise<{
    values: Record<AchievementFamily, number>;
    totalSets: number;
    totalWorlds: number;
  }> {
    const [user, fights, streak, cards, sets, adventure, worlds] =
      await Promise.all([
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
        this.dataSource
          .getRepository(PlayerStats)
          .findOne({ where: { userId } }),
        this.dataSource
          .getRepository(LoginStreak)
          .findOne({ where: { userId } }),
        this.dataSource.query<
          { uniqueCards: string | number; highRarity: string | number }[]
        >(
          `SELECT COUNT(DISTINCT uc.card_id) AS uniqueCards,
                COALESCE(SUM(CASE WHEN c.rarity IN (${HIGH_RARITY_SQL}) THEN uc.quantity ELSE 0 END), 0) AS highRarity
           FROM user_card uc JOIN card c ON c.id = uc.card_id
          WHERE uc.user_id = ?`,
          [userId],
        ),
        this.dataSource.query<
          { total: string | number; owned: string | number }[]
        >(
          `SELECT COUNT(c.id) AS total, COUNT(owned.card_id) AS owned
           FROM card_set s
           JOIN card c ON c.card_set_id = s.id
           LEFT JOIN (SELECT DISTINCT card_id FROM user_card WHERE user_id = ?) owned
             ON owned.card_id = c.id
          GROUP BY s.id`,
          [userId],
        ),
        // won IS NULL = combat non terminé : ignoré partout. « Joué » =
        // gagné ou au moins 2 tours (cf. countsAsPlayed, adventure-rules).
        this.dataSource.query<
          {
            played: string | number;
            won: string | number;
            worldsCompleted: string | number;
          }[]
        >(
          `SELECT
            (SELECT COUNT(*) FROM adventure_match WHERE user_id = ? AND won IS NOT NULL AND (won = 1 OR turns >= 2)) AS played,
            (SELECT COUNT(*) FROM adventure_match WHERE user_id = ? AND won = 1) AS won,
            (SELECT COUNT(*)
               FROM adventure_world w
              WHERE w.is_active = 1
                AND EXISTS (
                  SELECT 1
                    FROM adventure_opponent o
                    JOIN adventure_match m ON m.opponent_id = o.id
                   WHERE o.world_id = w.id AND o.position = 5
                     AND m.user_id = ? AND m.won = 1
                )) AS worldsCompleted`,
          [userId, userId, userId],
        ),
        this.dataSource.query<{ total: string | number }[]>(
          'SELECT COUNT(*) AS total FROM adventure_world WHERE is_active = 1',
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
      adventure: {
        worldsCompleted: Number(adventure[0]?.worldsCompleted ?? 0),
        won: Number(adventure[0]?.won ?? 0),
        played: Number(adventure[0]?.played ?? 0),
      },
    });
    return {
      values,
      totalSets: setRows.length,
      totalWorlds: Number(worlds[0]?.total ?? 0),
    };
  }
}
