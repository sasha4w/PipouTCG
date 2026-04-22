import "./FightLobby.css";

type LobbyStatus = "idle" | "queued" | "selecting" | "finished";

interface Props {
  status: LobbyStatus;
  selectedDeck: number | null;
  opponentName: string;
  userId: number;
  winner?: number;
  endReason?: string;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onSubmitDeck: () => void;
  onReplay: () => void;
}

export default function FightLobby({
  status,
  selectedDeck,
  opponentName,
  userId,
  winner,
  endReason,
  onJoinQueue,
  onLeaveQueue,
  onSubmitDeck,
  onReplay,
}: Props) {
  if (status === "finished") {
    const won = winner === userId;
    return (
      <div className="lobby-center">
        <div className="lobby-result-icon">{won ? "🏆" : "💀"}</div>
        <h2 className={`lobby-hero-title ${won ? "lobby-hero-title--win" : "lobby-hero-title--loss"}`}>
          {won ? "Victoire !" : "Défaite"}
        </h2>
        <p className="lobby-muted">{endReason}</p>
        <button onClick={onReplay} className="lobby-btn-big">
          Rejouer
        </button>
      </div>
    );
  }

  if (status === "selecting") {
    return (
      <div className="lobby-center">
        <h2 className="lobby-hero-title">⚔️ Adversaire trouvé !</h2>
        <p className="lobby-hero-sub">
          Tu affrontes <strong>{opponentName}</strong>
        </p>
        <p className="lobby-muted">Confirme ton deck pour commencer</p>
        {selectedDeck ? (
          <div className="lobby-deck-chosen">Deck #{selectedDeck} prêt</div>
        ) : (
          <p className="lobby-deck-warning">Sélectionne un deck via le widget « Decks »</p>
        )}
        <button
          onClick={onSubmitDeck}
          disabled={!selectedDeck}
          className={`lobby-btn-big${!selectedDeck ? " lobby-btn-big--disabled" : ""}`}
        >
          Lancer la partie →
        </button>
      </div>
    );
  }

  // idle | queued
  return (
    <div className="lobby-center">
      <h2 className="lobby-hero-title">⚔️ Prêt au combat ?</h2>
      <p className="lobby-hero-sub">Rejoins la file d'attente et affronte un adversaire en 1v1</p>

      {selectedDeck ? (
        <div className="lobby-deck-chosen">
          ✓ Deck sélectionné <span className="lobby-deck-id">#{selectedDeck}</span>
        </div>
      ) : (
        <p className="lobby-muted lobby-muted--mb">
          Sélectionne un deck via le widget « Decks » avant de combattre
        </p>
      )}

      {status === "idle" ? (
        <button
          onClick={onJoinQueue}
          disabled={!selectedDeck}
          className={`lobby-btn-big${!selectedDeck ? " lobby-btn-big--disabled" : ""}`}
        >
          🔍 Rechercher une partie
        </button>
      ) : (
        <>
          <div className="lobby-queue-anim">
            <span className="lobby-dot" />
            <span className="lobby-dot" />
            <span className="lobby-dot" />
          </div>
          <p className="lobby-muted">En attente d'un adversaire…</p>
          <button onClick={onLeaveQueue} className="lobby-btn-cancel">
            Annuler
          </button>
        </>
      )}
    </div>
  );
}
