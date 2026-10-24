import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fightService } from "../../services/fight.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import "./Leaderboard.css";
interface LeaderboardEntry {
  id: number;
  userId: number;
  wins: number;
  losses: number;
  elo: number;
  user: { id: number; username: string };
}

const TIER_CONFIG = [
  { min: 1800, id: "legendary", color: "#f39c12", icon: "👑" },
  { min: 1600, id: "diamond", color: "#4fc1a6", icon: "💎" },
  { min: 1400, id: "gold", color: "#f1c40f", icon: "🥇" },
  { min: 1200, id: "silver", color: "#95a5a6", icon: "🥈" },
  { min: 0, id: "bronze", color: "#cd7f32", icon: "🥉" },
];

function getTier(elo: number) {
  return (
    TIER_CONFIG.find((t) => elo >= t.min) ?? TIER_CONFIG[TIER_CONFIG.length - 1]
  );
}

export default function Leaderboard({ myUserId }: { myUserId?: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: QUERY_KEYS.leaderboard,
    queryFn: () => fightService.getLeaderboard(),
    refetchInterval: 30_000,
  });

  return (
    <div className="wrapper">
      <h2 className="title">🏆 {t("fight.leaderboard.title")}</h2>

      {isLoading ? (
        <p className="muted">{t("fight.leaderboard.loading")}</p>
      ) : !data?.length ? (
        <p className="muted">{t("fight.leaderboard.empty")}</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <tbody>
              {data.map((entry, idx) => {
                const tier = getTier(entry.elo);
                const tierLabel = t(`fight.leaderboard.tier.${tier.id}`);
                const total = entry.wins + entry.losses;
                const winrate = total
                  ? Math.round((entry.wins / total) * 100)
                  : 0;

                const isMe = entry.userId === myUserId;

                const rankStr =
                  idx === 0
                    ? "🥇"
                    : idx === 1
                      ? "🥈"
                      : idx === 2
                        ? "🥉"
                        : `#${idx + 1}`;

                return (
                  <tr key={entry.id} className={`tr ${isMe ? "me-row" : ""}`}>
                    <td colSpan={7} className="leaderboardCardCell">
                      <div className="leaderboardCard">
                        <div className="rankBlock">
                          <div className="rankMedal">{rankStr}</div>
                        </div>

                        <div className="playerBlock">
                          <div
                            className="avatar"
                            style={{ background: tier.color }}
                          >
                            {entry.user.username[0].toUpperCase()}
                          </div>

                          <div className="playerInfos">
                            <div className="player-name">
                              {entry.user.username}
                              {isMe && (
                                <span className="meBadge">
                                  {t("fight.leaderboard.you")}
                                </span>
                              )}
                            </div>

                            <div className="tierLabel">
                              {tier.icon} {tierLabel}
                            </div>
                          </div>
                        </div>

                        <div className="statsBlock">
                          <div className="eloBlock">
                            <span
                              className="eloNum"
                              style={{ color: tier.color }}
                            >
                              {entry.elo}
                            </span>

                            <span
                              className="tierChip"
                              style={{
                                borderColor: tier.color,
                                color: tier.color,
                              }}
                            >
                              {tierLabel}
                            </span>
                          </div>

                          <div className="miniStats">
                            <span className="wins">
                              {t("fight.leaderboard.wins", {
                                count: entry.wins,
                              })}
                            </span>
                            <span className="losses">
                              {t("fight.leaderboard.losses", {
                                count: entry.losses,
                              })}
                            </span>
                          </div>

                          <div className="winrateWrap">
                            <div
                              className="winrateBar"
                              style={{ width: `${winrate}%` }}
                            />
                            <span className="winrateNum">{winrate}%</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
