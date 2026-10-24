import { MatchEndReason } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import "./MatchHistory.css";
import type {
  PaginatedMatches,
  PlayerStats,
} from "../../services/fight.service";

interface Props {
  history: PaginatedMatches | undefined;
  myStats: PlayerStats | undefined;
  username: string;
  myUserId: number;
}

export default function MatchHistory({ history, myStats, myUserId }: Props) {
  const { t, i18n } = useTranslation();
  return (
    <div className="mh-section">
      <h2 className="mh-title">📜 {t("fight.history.title")}</h2>

      {myStats && (
        <div className="mh-stats-row">
          <div className="mh-stat-box">
            <span className="mh-stat-num">{myStats.elo}</span>
            <span className="mh-stat-label">ELO</span>
          </div>
          <div className="mh-stat-box">
            <span className="mh-stat-num mh-stat-num--win">{myStats.wins}</span>
            <span className="mh-stat-label">{t("fight.history.wins")}</span>
          </div>
          <div className="mh-stat-box">
            <span className="mh-stat-num mh-stat-num--loss">
              {myStats.losses}
            </span>
            <span className="mh-stat-label">{t("fight.history.losses")}</span>
          </div>
        </div>
      )}

      {!history?.data?.length ? (
        <p className="mh-muted">{t("fight.history.empty")}</p>
      ) : (
        <div className="mh-list">
          {history.data.map((m) => {
            const draw = m.endReason === MatchEndReason.DOUBLE_KO;
            const won = !draw && m.winner?.id === myUserId;
            return (
              <div
                key={m.id}
                className={`mh-row ${won ? "mh-row--win" : "mh-row--loss"}`}
              >
                <div className="mh-row-icon">
                  {draw ? "🤝" : won ? "🏆" : "💀"}
                </div>
                <div>
                  <div className="mh-row-players">
                    {m.player1.username} vs {m.player2.username}
                  </div>
                  <div className="mh-row-meta">
                    {t("fight.history.turns", { count: m.totalTurns })}
                    {m.endReason &&
                      ` · ${t(`fight.endReason.${m.endReason}`, { defaultValue: m.endReason })}`}
                    {m.endedAt &&
                      ` · ${new Date(m.endedAt).toLocaleDateString(i18n.language)}`}
                  </div>
                </div>
                <div
                  className={`mh-row-result ${won ? "mh-row-result--win" : "mh-row-result--loss"}`}
                >
                  {t(
                    draw
                      ? "fight.history.draw"
                      : won
                        ? "fight.history.win"
                        : "fight.history.loss",
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
