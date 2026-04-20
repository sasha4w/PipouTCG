import { useQuery } from "@tanstack/react-query";
import { fightService } from "../../services/fight.service";
import { QUERY_KEYS } from "../../utils/querykeys";

interface LeaderboardEntry {
  id: number;
  userId: number;
  wins: number;
  losses: number;
  elo: number;
  user: { id: number; username: string };
}

const TIER_CONFIG = [
  { min: 1800, label: "Légendaire", color: "#f39c12", icon: "👑" },
  { min: 1600, label: "Diamant", color: "#4fc1a6", icon: "💎" },
  { min: 1400, label: "Or", color: "#f1c40f", icon: "🥇" },
  { min: 1200, label: "Argent", color: "#95a5a6", icon: "🥈" },
  { min: 0, label: "Bronze", color: "#cd7f32", icon: "🥉" },
];

function getTier(elo: number) {
  return (
    TIER_CONFIG.find((t) => elo >= t.min) ?? TIER_CONFIG[TIER_CONFIG.length - 1]
  );
}

export default function Leaderboard({ myUserId }: { myUserId?: number }) {
  const { data, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: QUERY_KEYS.leaderboard,
    queryFn: () => fightService.getLeaderboard(),
    refetchInterval: 30_000,
  });

  return (
    <div style={s.wrapper}>
      <h2 style={s.title}>🏆 Classement ELO</h2>

      {isLoading ? (
        <p style={s.muted}>Chargement…</p>
      ) : !data?.length ? (
        <p style={s.muted}>Aucun joueur classé pour l'instant.</p>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={{ ...s.th, textAlign: "left" }}>Joueur</th>
                <th style={s.th}>Rang</th>
                <th style={s.th}>ELO</th>
                <th style={s.th}>V</th>
                <th style={s.th}>D</th>
                <th style={s.th}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, idx) => {
                const tier = getTier(entry.elo);
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
                  <tr
                    key={entry.id}
                    style={{
                      ...s.tr,
                      background: isMe
                        ? "rgba(122,28,59,0.07)"
                        : idx % 2 === 0
                          ? "#fdf6f0"
                          : "#fff",
                      fontWeight: isMe ? 700 : 400,
                    }}
                  >
                    <td style={{ ...s.td, textAlign: "center", fontSize: 18 }}>
                      {rankStr}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ ...s.avatar, background: tier.color }}>
                        {entry.user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {entry.user.username}
                          {isMe && <span style={s.meBadge}> vous</span>}
                        </div>
                        <div style={s.tierLabel}>
                          {tier.icon} {tier.label}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span
                        style={{
                          ...s.tierChip,
                          borderColor: tier.color,
                          color: tier.color,
                        }}
                      >
                        {tier.icon} {tier.label}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span style={{ ...s.eloNum, color: tier.color }}>
                        {entry.elo}
                      </span>
                    </td>
                    <td
                      style={{ ...s.td, textAlign: "center", color: "#27ae60" }}
                    >
                      {entry.wins}
                    </td>
                    <td
                      style={{ ...s.td, textAlign: "center", color: "#e74c3c" }}
                    >
                      {entry.losses}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <div style={s.winrateWrap}>
                        <div
                          style={{ ...s.winrateBar, width: `${winrate}%` }}
                        />
                        <span style={s.winrateNum}>{winrate}%</span>
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

const s: Record<string, React.CSSProperties> = {
  wrapper: { fontFamily: "Comfortaa, sans-serif", color: "#2c1a12" },
  title: {
    fontFamily: "Lilita One, sans-serif",
    color: "#7a1c3b",
    fontSize: 22,
    margin: "0 0 20px",
  },
  muted: { color: "#aaa", fontSize: 13 },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 14,
    border: "1.5px solid #f0ddd0",
    boxShadow: "0 2px 10px rgba(122,28,59,0.06)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "12px 14px",
    textAlign: "center",
    background: "#7a1c3b",
    color: "#fff",
    fontFamily: "Lilita One, sans-serif",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  tr: { transition: "background .15s" },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #f0e8e2",
    verticalAlign: "middle",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "Lilita One, sans-serif",
    fontSize: 16,
    flexShrink: 0,
  },
  tierLabel: { fontSize: 11, color: "#aaa", marginTop: 1 },
  tierChip: {
    border: "1.5px solid",
    borderRadius: 99,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
  },
  meBadge: {
    background: "#7a1c3b",
    color: "#fff",
    borderRadius: 99,
    padding: "1px 8px",
    fontSize: 11,
    marginLeft: 6,
  },
  eloNum: { fontFamily: "Lilita One, sans-serif", fontSize: 17 },
  winrateWrap: {
    position: "relative",
    background: "#f0e8e2",
    borderRadius: 99,
    height: 16,
    width: 80,
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  winrateBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    background: "rgba(122,28,59,0.25)",
    transition: "width .3s",
  },
  winrateNum: {
    position: "relative",
    fontSize: 11,
    fontWeight: 700,
    color: "#7a1c3b",
  },
};
