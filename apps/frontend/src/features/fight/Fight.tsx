import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  fightService,
  type PaginatedMatches,
  type PlayerStats,
} from "../../services/fight.service";
import DeckWidget from "../deck/DeckWidget";
import Leaderboard from "./Leaderboard";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "waiting" | "draw" | "main" | "battle" | "end" | "finished";
type Tab = "fight" | "history" | "leaderboard";

interface MonsterOnBoard {
  instanceId: string;
  card: {
    id: number;
    name: string;
    atk: number;
    hp: number;
    rarity: string;
    cost: number;
    image?: { url: string };
  };
  currentHp: number;
  mode: "attack" | "guard";
  equipments: { id: number; name: string }[];
  atkBuff: number;
  hpBuff: number;
  hasAttackedThisTurn: boolean;
}

interface MyState {
  userId: number;
  username: string;
  primes: number;
  hand: {
    id: number;
    name: string;
    type: string;
    atk: number;
    hp: number;
    cost: number;
    rarity: string;
    supportType?: string;
  }[];
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: ({ id: number; name: string; supportType: string } | null)[];
  recycleEnergy: number;
  graveyard: { id: number; name: string }[];
  banished: { id: number; name: string }[];
}

interface OppState {
  userId: number;
  username: string;
  primes: number;
  handCount: number;
  deckCount: number;
  monsterZones: (MonsterOnBoard | null)[];
  supportZones: ({ id: number; name: string } | null)[];
  graveyard: { id: number; name: string }[];
  banished: { id: number; name: string }[];
}

interface GameState {
  matchId: number;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  me: MyState;
  opponent: OppState;
  log: string[];
  winner?: number;
  endReason?: string;
}

// MatchRecord est importé depuis fight.service (type Match)

const RARITY_COLOR: Record<string, string> = {
  common: "#a8a8a8",
  uncommon: "#4fc1a6",
  rare: "#4a90d9",
  epic: "#9b59b6",
  legendary: "#f39c12",
  secret: "#e74c3c",
};
const PHASE_LABEL: Record<Phase, string> = {
  waiting: "Attente",
  draw: "Pioche",
  main: "Principale",
  battle: "Combat",
  end: "Fin de tour",
  finished: "Terminé",
};

const END_PHASE_LABEL: Record<string, string> = {
  main: "Phase de Combat →",
  battle: "Fin de Tour →",
  end: "Terminer le Tour →",
  draw: "Continuer →",
  waiting: "Continuer →",
  finished: "Continuer →",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function FightPage({
  userId,
  username,
}: {
  userId: number;
  username: string;
}) {
  const [tab, setTab] = useState<Tab>("fight");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<
    "idle" | "queued" | "selecting" | "playing" | "finished"
  >("idle");
  const [matchId, setMatchId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [selectedDeck, setSelectedDeck] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null); // hand index
  const [selectedZone, setSelectedZone] = useState<number | null>(null); // attacker zone index
  const [payIndices, setPayIndices] = useState<number[]>([]);
  const [toast, setToast] = useState<{
    msg: string;
    type: "err" | "ok";
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // History query
  const { data: history, refetch: refetchHistory } = useQuery<PaginatedMatches>(
    {
      queryKey: QUERY_KEYS.fightHistory,
      queryFn: () => fightService.getMyHistory(),
      enabled: tab === "history",
    },
  );

  const myStats = useQuery<PlayerStats>({
    queryKey: QUERY_KEYS.fightStats,
    queryFn: () => fightService.getMyStats(),
  });

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: "err" | "ok" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Turn countdown ────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setTimeLeft(90);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const socket = io(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/fights`,
      {
        auth: { token },
        transports: ["websocket"],
      },
    );
    socketRef.current = socket;

    socket.on("fight:queued", () => setStatus("queued"));
    socket.on("fight:dequeued", () => setStatus("idle"));

    socket.on(
      "fight:matched",
      ({
        matchId: mid,
        opponentName: oName,
      }: {
        matchId: number;
        opponentName: string;
      }) => {
        setMatchId(mid);
        setOpponentName(oName);
        setStatus("selecting");
        showToast(`⚔️ Adversaire trouvé : ${oName} !`, "ok");
      },
    );

    socket.on("fight:deck_accepted", () => {
      showToast("Deck accepté — en attente de l'adversaire…");
    });

    socket.on("fight:state", (state: GameState) => {
      setGameState(state);
      setStatus("playing");
      setSelectedCard(null);
      setSelectedZone(null);
      setPayIndices([]);
      if (state.isMyTurn) startCountdown();
    });

    socket.on(
      "fight:game_over",
      ({ winner, endReason }: { winner: number; endReason: string }) => {
        setStatus("finished");
        if (timerRef.current) clearInterval(timerRef.current);
        showToast(
          winner === userId
            ? `🎉 Victoire ! (${endReason})`
            : `💀 Défaite… (${endReason})`,
          winner === userId ? "ok" : "err",
        );
        setTimeout(() => refetchHistory(), 2000);
      },
    );

    socket.on("fight:error", ({ message }: { message: string }) =>
      showToast(message, "err"),
    );

    return () => {
      socket.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, showToast, startCountdown, refetchHistory]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const emit = useCallback((event: string, data: object) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinQueue = () => emit("fight:queue", {});
  const leaveQueue = () => {
    emit("fight:dequeue", {});
    setStatus("idle");
  };
  const submitDeck = () => {
    if (!selectedDeck || !matchId) return;
    emit("fight:submit_deck", { matchId, deckId: selectedDeck });
  };
  const endPhase = () => matchId && emit("fight:end_phase", { matchId });
  const surrender = () => {
    if (!matchId || !window.confirm("Abandonner ?")) return;
    emit("fight:surrender", { matchId });
  };

  const summon = () => {
    if (selectedCard === null || selectedZone === null || !matchId) return;
    emit("fight:summon", {
      matchId,
      handIndex: selectedCard,
      zoneIndex: selectedZone,
      paymentHandIndices: payIndices,
    });
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  };

  const attackMonster = (targetInstanceId: string) => {
    if (selectedZone === null || !matchId || !gameState) return;
    const attacker = gameState.me.monsterZones[selectedZone];
    if (!attacker) return;
    emit("fight:attack", {
      matchId,
      attackerInstanceId: attacker.instanceId,
      targetInstanceId,
    });
    setSelectedZone(null);
  };

  const directAttack = () => {
    if (selectedZone === null || !matchId || !gameState) return;
    const attacker = gameState.me.monsterZones[selectedZone];
    if (!attacker) return;
    emit("fight:attack", {
      matchId,
      attackerInstanceId: attacker.instanceId,
      direct: true,
    });
    setSelectedZone(null);
  };

  const changeMode = (instanceId: string, mode: "attack" | "guard") =>
    matchId && emit("fight:change_mode", { matchId, instanceId, mode });

  const recycleSupport = (zoneIndex: number) =>
    matchId && emit("fight:recycle_support", { matchId, zoneIndex });

  const playSupport = (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => {
    if (!matchId) return;
    emit("fight:play_support", {
      matchId,
      handIndex,
      ...(zoneIndex !== undefined && { zoneIndex }),
      ...(targetInstanceId !== undefined && { targetInstanceId }),
    });
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  };

  const discardCard = (handIndex: number) => {
    if (!matchId) return;
    emit("fight:discard", { matchId, handIndex });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const gs = gameState;
  const phase = gs?.phase;

  return (
    <div style={p.root}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            ...p.toast,
            background: toast.type === "err" ? "#e74c3c" : "#27ae60",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={p.tabBar}>
        {(["fight", "history", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...p.tab, ...(tab === t ? p.tabActive : {}) }}
          >
            {
              {
                fight: "⚔️ Combat",
                history: "📜 Historique",
                leaderboard: "🏆 Classement",
              }[t]
            }
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <DeckWidget
          onSelectDeck={setSelectedDeck}
          selectedDeckId={selectedDeck ?? undefined}
        />
      </div>

      {/* ══ TAB: LEADERBOARD ═══════════════════════════════════════════════ */}
      {tab === "leaderboard" && (
        <div style={p.section}>
          <Leaderboard myUserId={userId} />
        </div>
      )}

      {/* ══ TAB: HISTORY ═══════════════════════════════════════════════════ */}
      {tab === "history" && (
        <div style={p.section}>
          <h2 style={p.sectionTitle}>📜 Historique des matchs</h2>
          {myStats.data && (
            <div style={p.statsRow}>
              <div style={p.statBox}>
                <span style={p.statNum}>{myStats.data.elo}</span>
                <span style={p.statLabel}>ELO</span>
              </div>
              <div style={p.statBox}>
                <span style={{ ...p.statNum, color: "#27ae60" }}>
                  {myStats.data.wins}
                </span>
                <span style={p.statLabel}>Victoires</span>
              </div>
              <div style={p.statBox}>
                <span style={{ ...p.statNum, color: "#e74c3c" }}>
                  {myStats.data.losses}
                </span>
                <span style={p.statLabel}>Défaites</span>
              </div>
            </div>
          )}
          {!history?.data?.length ? (
            <p style={p.muted}>Aucun match joué.</p>
          ) : (
            <div style={p.historyList}>
              {history.data.map((m) => {
                const won = m.winner?.username === username;
                return (
                  <div
                    key={m.id}
                    style={{
                      ...p.historyRow,
                      borderLeft: `4px solid ${won ? "#27ae60" : "#e74c3c"}`,
                    }}
                  >
                    <div style={{ fontSize: 20 }}>{won ? "🏆" : "💀"}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {m.player1.username} vs {m.player2.username}
                      </div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>
                        {m.totalTurns} tours · {m.endReason ?? ""} ·{" "}
                        {m.endedAt
                          ? new Date(m.endedAt).toLocaleDateString("fr-FR")
                          : ""}
                      </div>
                    </div>
                    <div
                      style={{
                        marginLeft: "auto",
                        fontWeight: 700,
                        color: won ? "#27ae60" : "#e74c3c",
                      }}
                    >
                      {won ? "Victoire" : "Défaite"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: FIGHT ═════════════════════════════════════════════════════ */}
      {tab === "fight" && (
        <div style={p.fightArea}>
          {/* ─ IDLE / QUEUE ──────────────────────────────────────────────── */}
          {(status === "idle" || status === "queued") && (
            <div style={p.centerBox}>
              <h2 style={p.heroTitle}>⚔️ Prêt au combat ?</h2>
              <p style={p.heroSub}>
                Rejoins la file d'attente et affronte un adversaire en 1v1
              </p>

              {selectedDeck ? (
                <div style={p.deckChosen}>
                  ✓ Deck sélectionné{" "}
                  <span style={p.deckId}>#{selectedDeck}</span>
                </div>
              ) : (
                <p style={{ ...p.muted, marginBottom: 16 }}>
                  Sélectionne un deck via le widget « Decks » avant de combattre
                </p>
              )}

              {status === "idle" ? (
                <button
                  onClick={joinQueue}
                  disabled={!selectedDeck}
                  style={selectedDeck ? p.btnBig : p.btnBigDisabled}
                >
                  🔍 Rechercher une partie
                </button>
              ) : (
                <>
                  <div style={p.queueAnim}>
                    <span style={p.dot} />
                    <span style={p.dot} />
                    <span style={p.dot} />
                  </div>
                  <p style={p.muted}>En attente d'un adversaire…</p>
                  <button onClick={leaveQueue} style={p.btnCancel}>
                    Annuler
                  </button>
                </>
              )}
            </div>
          )}

          {/* ─ DECK SELECTION ────────────────────────────────────────────── */}
          {status === "selecting" && (
            <div style={p.centerBox}>
              <h2 style={p.heroTitle}>⚔️ Adversaire trouvé !</h2>
              <p style={p.heroSub}>
                Tu affrontes <strong>{opponentName}</strong>
              </p>
              <p style={p.muted}>Confirme ton deck pour commencer</p>
              {selectedDeck ? (
                <div style={p.deckChosen}>Deck #{selectedDeck} prêt</div>
              ) : (
                <p style={{ color: "#e74c3c", fontSize: 13 }}>
                  Sélectionne un deck via le widget « Decks »
                </p>
              )}
              <button
                onClick={submitDeck}
                disabled={!selectedDeck}
                style={selectedDeck ? p.btnBig : p.btnBigDisabled}
              >
                Lancer la partie →
              </button>
            </div>
          )}

          {/* ─ GAME OVER ─────────────────────────────────────────────────── */}
          {status === "finished" && gs && (
            <div style={p.centerBox}>
              <div style={{ fontSize: 72 }}>
                {gs.winner === userId ? "🏆" : "💀"}
              </div>
              <h2
                style={{
                  ...p.heroTitle,
                  color: gs.winner === userId ? "#27ae60" : "#e74c3c",
                }}
              >
                {gs.winner === userId ? "Victoire !" : "Défaite"}
              </h2>
              <p style={p.muted}>{gs.endReason}</p>
              <button
                onClick={() => {
                  setStatus("idle");
                  setGameState(null);
                  setMatchId(null);
                }}
                style={p.btnBig}
              >
                Rejouer
              </button>
            </div>
          )}

          {/* ─ PLAYING ───────────────────────────────────────────────────── */}
          {status === "playing" && gs && (
            <div style={p.boardWrap}>
              {/* HUD bar */}
              <div style={p.hud}>
                <div style={p.hudLeft}>
                  <span style={p.hudName}>{gs.opponent.username}</span>
                  <span style={p.hudPrimes}>
                    {"💎".repeat(gs.opponent.primes)}
                    {"○".repeat(Math.max(0, 6 - gs.opponent.primes))}
                  </span>
                  <span style={p.hudDeck}>📚 {gs.opponent.deckCount}</span>
                  <span style={p.hudHand}>🤚 {gs.opponent.handCount}</span>
                </div>
                <div style={p.hudCenter}>
                  <span style={p.phaseChip}>
                    {PHASE_LABEL[phase ?? "main"]}
                  </span>
                  <span style={p.turnNum}>Tour {gs.turnNumber}</span>
                  {gs.isMyTurn && (
                    <span
                      style={{
                        ...p.timerChip,
                        color: timeLeft < 20 ? "#e74c3c" : "#2c1a12",
                      }}
                    >
                      ⏱ {timeLeft}s
                    </span>
                  )}
                </div>
                <div style={p.hudRight}>
                  <span style={p.hudDeck}>📚 {gs.me.deckCount}</span>
                  <span style={p.hudPrimes}>
                    {"💎".repeat(gs.me.primes)}
                    {"○".repeat(Math.max(0, 6 - gs.me.primes))}
                  </span>
                  <span style={p.hudName}>{gs.me.username}</span>
                </div>
              </div>

              {/* Opponent zones */}
              <ZoneRow
                label="Adversaire — Supports"
                zones={gs.opponent.supportZones}
                isSupport
                dim
              />
              <ZoneRow
                label="Adversaire — Monstres"
                zones={gs.opponent.monsterZones}
                isOpponent
                onMonsterClick={
                  phase === "battle" && gs.isMyTurn && selectedZone !== null
                    ? (instanceId) => attackMonster(instanceId)
                    : undefined
                }
              />

              {/* Direct attack button */}
              {phase === "battle" && gs.isMyTurn && selectedZone !== null && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    margin: "8px 0",
                  }}
                >
                  <button onClick={directAttack} style={p.btnDirectAtk}>
                    ⚡ Attaque Directe
                  </button>
                </div>
              )}

              {/* My monster zones */}
              <ZoneRow
                label="Mes Monstres"
                zones={gs.me.monsterZones}
                onZoneClick={
                  gs.isMyTurn
                    ? (idx) => {
                        if (phase === "main") {
                          // Select zone to place or select attacker
                          if (selectedCard !== null) setSelectedZone(idx);
                          else if (gs.me.monsterZones[idx])
                            setSelectedZone(idx);
                        } else if (phase === "battle") {
                          const m = gs.me.monsterZones[idx];
                          if (
                            m &&
                            m.mode === "attack" &&
                            !m.hasAttackedThisTurn
                          )
                            setSelectedZone(idx);
                        }
                      }
                    : undefined
                }
                onModeChange={
                  phase === "main" && gs.isMyTurn ? changeMode : undefined
                }
                selectedZone={selectedZone}
              />

              {/* My support zones */}
              <ZoneRow
                label="Mes Supports"
                zones={gs.me.supportZones}
                isSupport
                onSupportRecycle={
                  phase === "main" && gs.isMyTurn ? recycleSupport : undefined
                }
                recycleEnergy={gs.me.recycleEnergy}
              />

              {/* Hand */}
              <div style={p.handArea}>
                <div style={p.handLabel}>Main ({gs.me.hand.length})</div>
                <div style={p.handCards}>
                  {gs.me.hand.map((card, idx) => {
                    const isPaying = payIndices.includes(idx);
                    const isSel = selectedCard === idx;
                    const isDiscardable =
                      phase === "end" && gs.isMyTurn && gs.me.hand.length > 7;
                    return (
                      <div
                        key={idx}
                        style={{
                          ...p.handCard,
                          background: isPaying
                            ? "#fce4d4"
                            : isSel
                              ? "#f8edf2"
                              : "#fff",
                          border: isDiscardable
                            ? "2px solid #e74c3c"
                            : isSel
                              ? "2px solid #7a1c3b"
                              : isPaying
                                ? "2px solid #e67e22"
                                : "1.5px solid #f0ddd0",
                          boxShadow: isSel
                            ? "0 0 0 3px rgba(122,28,59,0.2)"
                            : isDiscardable
                              ? "0 0 0 2px rgba(231,76,60,0.15)"
                              : "none",
                          cursor: isDiscardable ? "pointer" : undefined,
                        }}
                        onClick={() => {
                          if (!gs.isMyTurn) return;
                          if (phase === "main") {
                            if (isSel) {
                              setSelectedCard(null);
                              setPayIndices([]);
                              return;
                            }
                            if (
                              card.type === "monster" &&
                              selectedCard === null
                            ) {
                              setSelectedCard(idx);
                            } else if (
                              card.type === "support" &&
                              selectedCard === null
                            ) {
                              // Cartes éphémères : jouer directement
                              // Terrains/Équipements : sélectionner pour choisir une cible
                              if (
                                !card.supportType ||
                                card.supportType === "ephemeral"
                              ) {
                                playSupport(idx);
                              } else {
                                setSelectedCard(idx);
                              }
                            } else if (
                              selectedCard !== null &&
                              idx !== selectedCard
                            ) {
                              // Toggle as payment card
                              setPayIndices((prev) =>
                                prev.includes(idx)
                                  ? prev.filter((i) => i !== idx)
                                  : [...prev, idx],
                              );
                            }
                          } else if (phase === "end") {
                            // Défausse si la main dépasse 7 cartes
                            if (gs.me.hand.length > 7) {
                              discardCard(idx);
                            }
                          }
                        }}
                      >
                        <div
                          style={{
                            ...p.handRarity,
                            background: RARITY_COLOR[card.rarity] ?? "#888",
                          }}
                        />
                        <div style={p.handCardName}>{card.name}</div>
                        <div style={p.handCardMeta}>
                          {card.type === "monster"
                            ? `${card.atk}⚔ ${card.hp}❤ ${card.cost}⚡`
                            : `Support · ${card.cost}⚡`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action bar */}
              {gs.isMyTurn && (
                <div style={p.actionBar}>
                  {/* ── Invoquer un monstre ── */}
                  {phase === "main" &&
                    selectedCard !== null &&
                    gs.me.hand[selectedCard]?.type === "monster" &&
                    selectedZone !== null && (
                      <button onClick={summon} style={p.btnAction}>
                        ⬆️ Invoquer
                      </button>
                    )}

                  {/* ── Poser un terrain (sélectionné) sur une zone ── */}
                  {phase === "main" &&
                    selectedCard !== null &&
                    gs.me.hand[selectedCard]?.type === "support" &&
                    gs.me.hand[selectedCard]?.supportType === "terrain" &&
                    selectedZone !== null && (
                      <button
                        onClick={() => playSupport(selectedCard, selectedZone)}
                        style={p.btnAction}
                      >
                        🌍 Poser le Terrain
                      </button>
                    )}

                  {/* ── Équiper un monstre (sélectionné) ── */}
                  {phase === "main" &&
                    selectedCard !== null &&
                    gs.me.hand[selectedCard]?.type === "support" &&
                    gs.me.hand[selectedCard]?.supportType === "equipment" &&
                    selectedZone !== null &&
                    gs.me.monsterZones[selectedZone] && (
                      <button
                        onClick={() =>
                          playSupport(
                            selectedCard,
                            undefined,
                            gs.me.monsterZones[selectedZone!]!.instanceId,
                          )
                        }
                        style={p.btnAction}
                      >
                        🔧 Équiper
                      </button>
                    )}

                  {/* ── Alerte défausse phase end ── */}
                  {phase === "end" && gs.me.hand.length > 7 && (
                    <span style={p.discardWarning}>
                      ⚠️ Défausse {gs.me.hand.length - 7} carte
                      {gs.me.hand.length - 7 > 1 ? "s" : ""} (clique sur la
                      carte)
                    </span>
                  )}

                  <button
                    onClick={endPhase}
                    style={
                      phase === "end" && gs.me.hand.length > 7
                        ? p.btnEndPhaseDisabled
                        : p.btnEndPhase
                    }
                  >
                    {END_PHASE_LABEL[phase ?? "main"] ?? "Continuer →"}
                  </button>
                  <button onClick={surrender} style={p.btnSurrender}>
                    🏳️ Abandonner
                  </button>
                </div>
              )}

              {/* Log */}
              <div style={p.logBox}>
                {[...gs.log].reverse().map((l, i) => (
                  <div key={i} style={{ ...p.logEntry, opacity: 1 - i * 0.06 }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ZoneRow sub-component ───────────────────────────────────────────────────

function ZoneRow({
  label,
  zones,
  isSupport = false,
  isOpponent = false,
  dim = false,
  onZoneClick,
  onMonsterClick,
  onModeChange,
  onSupportRecycle,
  selectedZone,
  recycleEnergy,
}: {
  label: string;
  zones: (any | null)[];
  isSupport?: boolean;
  isOpponent?: boolean;
  dim?: boolean;
  onZoneClick?: (idx: number) => void;
  onMonsterClick?: (instanceId: string) => void;
  onModeChange?: (instanceId: string, mode: "attack" | "guard") => void;
  onSupportRecycle?: (idx: number) => void;
  selectedZone?: number | null;
  recycleEnergy?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: "#bbb",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}{" "}
        {recycleEnergy !== undefined && recycleEnergy > 0 && (
          <span style={{ color: "#e67e22" }}>⚡×{recycleEnergy}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {zones.map((zone, idx) => (
          <div
            key={idx}
            style={{
              ...z.zone,
              opacity: dim ? 0.8 : 1,
              border:
                selectedZone === idx
                  ? "2px solid #7a1c3b"
                  : zone
                    ? "1.5px solid #e0cfc8"
                    : "1.5px dashed #ddd",
              cursor:
                onZoneClick || (zone && onMonsterClick) ? "pointer" : "default",
              background: zone ? "#fdf6f0" : "#f8f4f2",
            }}
            onClick={() => {
              if (zone && onMonsterClick && zone.instanceId)
                onMonsterClick(zone.instanceId);
              else if (onZoneClick) onZoneClick(idx);
            }}
          >
            {zone ? (
              isSupport ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {zone.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>
                    {zone.supportType ?? ""}
                  </div>
                  {onSupportRecycle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSupportRecycle(idx);
                      }}
                      style={z.btnRecycle}
                    >
                      ♻️
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div
                    style={{
                      ...z.modeChip,
                      background:
                        zone.mode === "attack" ? "#fce4d4" : "#e4f0fc",
                    }}
                  >
                    {zone.mode === "attack" ? "⚔️" : "🛡️"}
                  </div>
                  <div style={z.monsterName}>{zone.card.name}</div>
                  <div style={z.monsterStats}>
                    {zone.card.atk + zone.atkBuff}⚔ {zone.currentHp}/
                    {zone.card.hp + zone.hpBuff}❤
                  </div>
                  {zone.hasAttackedThisTurn && (
                    <div style={{ fontSize: 9, color: "#aaa" }}>attaqué</div>
                  )}
                  {!isOpponent && onModeChange && (
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        justifyContent: "center",
                        marginTop: 4,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onModeChange(zone.instanceId, "attack");
                        }}
                        style={{
                          ...z.modeBtn,
                          background:
                            zone.mode === "attack" ? "#7a1c3b" : "#f0ddd0",
                          color: zone.mode === "attack" ? "#fff" : "#7a1c3b",
                        }}
                      >
                        ⚔️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onModeChange(zone.instanceId, "guard");
                        }}
                        style={{
                          ...z.modeBtn,
                          background:
                            zone.mode === "guard" ? "#7a1c3b" : "#f0ddd0",
                          color: zone.mode === "guard" ? "#fff" : "#7a1c3b",
                        }}
                      >
                        🛡️
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <span style={{ fontSize: 22, opacity: 0.2 }}>+</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const p: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#fdf6f0",
    fontFamily: "Comfortaa, sans-serif",
    color: "#2c1a12",
    display: "flex",
    flexDirection: "column",
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 999,
    padding: "12px 28px",
    borderRadius: 99,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    padding: "12px 20px",
    background: "#fff",
    borderBottom: "1.5px solid #f0ddd0",
    alignItems: "center",
    flexWrap: "wrap",
  },
  tab: {
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    color: "#aaa",
    fontWeight: 600,
  },
  tabActive: { background: "#f8edf2", color: "#7a1c3b" },
  section: { padding: "24px", maxWidth: 960, margin: "0 auto", width: "100%" },
  sectionTitle: {
    fontFamily: "Lilita One, sans-serif",
    color: "#7a1c3b",
    fontSize: 22,
    margin: "0 0 20px",
  },
  muted: { color: "#aaa", fontSize: 13 },

  statsRow: { display: "flex", gap: 16, marginBottom: 24 },
  statBox: {
    background: "#fff",
    border: "1.5px solid #f0ddd0",
    borderRadius: 14,
    padding: "16px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  statNum: {
    fontFamily: "Lilita One, sans-serif",
    fontSize: 28,
    color: "#7a1c3b",
  },
  statLabel: { fontSize: 12, color: "#aaa" },

  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historyRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#fff",
    borderRadius: 12,
    padding: "14px 18px",
    border: "1.5px solid #f0ddd0",
  },

  fightArea: { flex: 1, display: "flex", flexDirection: "column" },
  centerBox: {
    margin: "auto",
    textAlign: "center",
    padding: 40,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    maxWidth: 480,
  },
  heroTitle: {
    fontFamily: "Lilita One, sans-serif",
    fontSize: 32,
    color: "#7a1c3b",
    margin: 0,
  },
  heroSub: { fontSize: 15, color: "#888", margin: 0 },
  deckChosen: {
    background: "#f8edf2",
    color: "#7a1c3b",
    borderRadius: 99,
    padding: "8px 20px",
    fontWeight: 700,
    fontSize: 14,
  },
  deckId: { fontFamily: "Lilita One, sans-serif" },

  queueAnim: { display: "flex", gap: 8 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#7a1c3b",
    animation: "pulse 1.2s infinite",
  },

  btnBig: {
    background: "#7a1c3b",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "16px 40px",
    fontFamily: "Lilita One, sans-serif",
    fontSize: 18,
    cursor: "pointer",
  },
  btnBigDisabled: {
    background: "#ddd",
    color: "#aaa",
    border: "none",
    borderRadius: 14,
    padding: "16px 40px",
    fontFamily: "Lilita One, sans-serif",
    fontSize: 18,
    cursor: "not-allowed",
  },
  btnCancel: {
    background: "transparent",
    color: "#aaa",
    border: "1.5px solid #ddd",
    borderRadius: 10,
    padding: "10px 24px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "pointer",
  },

  boardWrap: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxWidth: 900,
    margin: "0 auto",
    width: "100%",
  },

  hud: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fff",
    borderRadius: 14,
    padding: "12px 18px",
    marginBottom: 8,
    border: "1.5px solid #f0ddd0",
  },
  hudLeft: { display: "flex", alignItems: "center", gap: 10 },
  hudRight: { display: "flex", alignItems: "center", gap: 10 },
  hudCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  hudName: {
    fontFamily: "Lilita One, sans-serif",
    fontSize: 15,
    color: "#7a1c3b",
  },
  hudPrimes: { fontSize: 14, letterSpacing: 1 },
  hudDeck: { fontSize: 12, color: "#aaa" },
  hudHand: { fontSize: 12, color: "#aaa" },
  phaseChip: {
    background: "#7a1c3b",
    color: "#fff",
    borderRadius: 99,
    padding: "4px 14px",
    fontSize: 12,
    fontFamily: "Lilita One, sans-serif",
  },
  turnNum: { fontSize: 11, color: "#aaa" },
  timerChip: {
    fontSize: 14,
    fontFamily: "Lilita One, sans-serif",
    transition: "color .5s",
  },

  handArea: { marginTop: 8 },
  handLabel: {
    fontSize: 11,
    color: "#bbb",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  handCards: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 },
  handCard: {
    minWidth: 88,
    maxWidth: 88,
    borderRadius: 10,
    padding: "8px",
    cursor: "pointer",
    transition: "transform .15s",
    flexShrink: 0,
    position: "relative",
  },
  handRarity: { width: 8, height: 8, borderRadius: "50%", marginBottom: 4 },
  handCardName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    wordBreak: "break-word",
  },
  handCardMeta: { fontSize: 10, color: "#aaa" },

  actionBar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
  },
  btnAction: {
    background: "#7a1c3b",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 700,
  },
  btnEndPhase: {
    background: "#f0ddd0",
    color: "#7a1c3b",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 700,
  },
  btnEndPhaseDisabled: {
    background: "#eee",
    color: "#bbb",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "not-allowed",
    fontWeight: 700,
  },
  discardWarning: {
    color: "#e74c3c",
    fontSize: 13,
    fontWeight: 700,
    background: "#fce9e9",
    borderRadius: 8,
    padding: "8px 14px",
  },
  btnSurrender: {
    background: "transparent",
    color: "#e74c3c",
    border: "1.5px solid #e74c3c",
    borderRadius: 10,
    padding: "10px 16px",
    fontFamily: "Comfortaa, sans-serif",
    fontSize: 13,
    cursor: "pointer",
  },
  btnDirectAtk: {
    background: "#e74c3c",
    color: "#fff",
    border: "none",
    borderRadius: 99,
    padding: "8px 24px",
    fontFamily: "Lilita One, sans-serif",
    fontSize: 15,
    cursor: "pointer",
  },

  logBox: {
    background: "#fff",
    border: "1.5px solid #f0ddd0",
    borderRadius: 12,
    padding: "12px 16px",
    maxHeight: 160,
    overflowY: "auto",
    marginTop: 8,
  },
  logEntry: {
    fontSize: 12,
    color: "#555",
    padding: "2px 0",
    borderBottom: "1px solid #f9f5f2",
  },
};

const z: Record<string, React.CSSProperties> = {
  zone: {
    flex: 1,
    minHeight: 100,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "border .15s, box-shadow .15s",
    padding: 6,
  },
  modeChip: {
    borderRadius: 99,
    fontSize: 14,
    padding: "2px 8px",
    display: "inline-block",
    marginBottom: 4,
  },
  monsterName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
    wordBreak: "break-word",
  },
  monsterStats: { fontSize: 10, color: "#888" },
  modeBtn: {
    border: "none",
    borderRadius: 6,
    padding: "3px 7px",
    cursor: "pointer",
    fontSize: 13,
  },
  btnRecycle: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    marginTop: 4,
  },
};
