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
  return (
    <div className="mh-section">
      <h2 className="mh-title">📜 Historique des matchs</h2>

      {myStats && (
        <div className="mh-stats-row">
          <div className="mh-stat-box">
            <span className="mh-stat-num">{myStats.elo}</span>
            <span className="mh-stat-label">ELO</span>
          </div>
          <div className="mh-stat-box">
            <span className="mh-stat-num mh-stat-num--win">{myStats.wins}</span>
            <span className="mh-stat-label">Victoires</span>
          </div>
          <div className="mh-stat-box">
            <span className="mh-stat-num mh-stat-num--loss">
              {myStats.losses}
            </span>
            <span className="mh-stat-label">Défaites</span>
          </div>
        </div>
      )}

      {!history?.data?.length ? (
        <p className="mh-muted">Aucun match joué.</p>
      ) : (
        <div className="mh-list">
          {history.data.map((m) => {
            console.log(
              "match:",
              m.id,
              "winner:",
              m.winner,
              "myUserId:",
              myUserId,
            ); // ← ajoute cette ligne
            const won = m.winner?.id === myUserId;
            return (
              <div
                key={m.id}
                className={`mh-row ${won ? "mh-row--win" : "mh-row--loss"}`}
              >
                <div className="mh-row-icon">{won ? "🏆" : "💀"}</div>
                <div>
                  <div className="mh-row-players">
                    {m.player1.username} vs {m.player2.username}
                  </div>
                  <div className="mh-row-meta">
                    {m.totalTurns} tours · {m.endReason ?? ""} ·{" "}
                    {m.endedAt
                      ? new Date(m.endedAt).toLocaleDateString("fr-FR")
                      : ""}
                  </div>
                </div>
                <div
                  className={`mh-row-result ${won ? "mh-row-result--win" : "mh-row-result--loss"}`}
                >
                  {won ? "Victoire" : "Défaite"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
