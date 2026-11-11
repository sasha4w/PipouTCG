import { useEffect, useState } from "react";
import { MatchEndReason, type RankedResultPayload } from "@pipou/shared";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import {
  IconArrowRight,
  IconCheck,
  IconHand,
  IconSkull,
  IconSwords,
  IconTrophy,
} from "../../components/Icons";
import "./FightLobby.css";

type LobbyStatus = "idle" | "queued" | "selecting" | "finished";

/** Attente au-delà de laquelle on propose de jouer contre l'IA. */
const AI_HINT_AFTER_S = 30;

/** Variation signée : « +16 », « −16 », « ±0 ». */
function formatDelta(delta: number): string {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `−${-delta}`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Temps passé en file ; après un moment, propose l'Aventure. */
function QueueWait({ onPlayAi }: { onPlayAi: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <p className="lobby-muted" role="status">
        {t("fight.lobby.elapsed", { time: formatElapsed(elapsed) })}
      </p>
      {elapsed >= AI_HINT_AFTER_S && (
        <div className="lobby-ai-hint">
          <p className="lobby-muted">{t("fight.lobby.noOpponent")}</p>
          <Button variant="ghost-bordeaux" onClick={onPlayAi}>
            {t("fight.lobby.playAi")}
          </Button>
        </div>
      )}
    </>
  );
}

interface Props {
  status: LobbyStatus;
  selectedDeck: number | null;
  /** Nom du deck choisi ; absent tant que la liste des decks charge. */
  deckName?: string;
  opponentName: string;
  userId: number;
  winner?: number;
  endReason?: string;
  /** Classement après la partie ; absent si le serveur ne l'a pas envoyé. */
  ranked?: RankedResultPayload | null;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onSubmitDeck: () => void;
  onReplay: () => void;
  /** Quitte la file pour un combat contre l'IA. */
  onPlayAi: () => void;
}

export default function FightLobby({
  status,
  selectedDeck,
  deckName,
  opponentName,
  userId,
  winner,
  endReason,
  ranked,
  onJoinQueue,
  onLeaveQueue,
  onSubmitDeck,
  onReplay,
  onPlayAi,
}: Props) {
  const { t } = useTranslation();
  const deckLabel = deckName ?? `#${selectedDeck}`;
  if (status === "finished") {
    const draw = endReason === MatchEndReason.DOUBLE_KO;
    const won = !draw && winner === userId;
    return (
      <div className="lobby-center">
        <div className="lobby-result-icon">
          {draw ? (
            <IconHand size={72} />
          ) : won ? (
            <IconTrophy size={72} />
          ) : (
            <IconSkull size={72} />
          )}
        </div>
        <h2
          className={`lobby-hero-title ${draw ? "" : won ? "lobby-hero-title--win" : "lobby-hero-title--loss"}`}
        >
          {t(
            draw
              ? "fight.lobby.draw"
              : won
                ? "fight.lobby.win"
                : "fight.lobby.loss",
          )}
        </h2>
        {endReason && (
          <p className="lobby-muted">
            {t(`fight.endReason.${endReason}`, { defaultValue: endReason })}
          </p>
        )}
        {ranked && (
          <p className="lobby-elo">
            <span className="lobby-elo__label">ELO</span>
            <span className="lobby-elo__value">{ranked.elo}</span>
            <span
              className={`lobby-elo__delta${
                ranked.delta > 0
                  ? " lobby-elo__delta--up"
                  : ranked.delta < 0
                    ? " lobby-elo__delta--down"
                    : ""
              }`}
              aria-label={t("fight.lobby.eloDelta", {
                delta: formatDelta(ranked.delta),
              })}
            >
              {formatDelta(ranked.delta)}
            </span>
          </p>
        )}
        <Button size="lg" onClick={onReplay}>
          {t("fight.lobby.replay")}
        </Button>
      </div>
    );
  }

  if (status === "selecting") {
    return (
      <div className="lobby-center">
        <h2 className="lobby-hero-title">
          <IconSwords size={28} /> {t("fight.lobby.found")}
        </h2>
        <p className="lobby-hero-sub">
          <Trans
            i18nKey="fight.lobby.facing"
            values={{ name: opponentName }}
            components={{ b: <strong /> }}
          />
        </p>
        <p className="lobby-muted">{t("fight.lobby.confirmDeck")}</p>
        {selectedDeck ? (
          <div className="lobby-deck-chosen">
            {t("fight.lobby.deckReady", { name: deckLabel })}
          </div>
        ) : (
          <p className="lobby-deck-warning">{t("fight.lobby.pickDeck")}</p>
        )}
        <Button size="lg" onClick={onSubmitDeck} disabled={!selectedDeck}>
          {t("fight.lobby.start")}
          <IconArrowRight size={16} />
        </Button>
      </div>
    );
  }

  // idle | queued
  return (
    <div className="lobby-center">
      <h2 className="lobby-hero-title">
        <IconSwords size={28} /> {t("fight.lobby.ready")}
      </h2>
      <p className="lobby-hero-sub">{t("fight.lobby.intro")}</p>

      {selectedDeck ? (
        <div className="lobby-deck-chosen">
          <IconCheck size={14} /> {t("fight.lobby.deckSelected")}{" "}
          <span className="lobby-deck-id">{deckLabel}</span>
        </div>
      ) : (
        <p className="lobby-muted lobby-muted--mb">
          {t("fight.lobby.pickDeckFirst")}
        </p>
      )}

      {status === "idle" ? (
        <Button size="lg" onClick={onJoinQueue} disabled={!selectedDeck}>
          {t("fight.lobby.search")}
        </Button>
      ) : (
        <>
          <div className="lobby-queue-anim">
            <span className="lobby-dot" />
            <span className="lobby-dot" />
            <span className="lobby-dot" />
          </div>
          <p className="lobby-muted">{t("fight.lobby.waiting")}</p>
          <QueueWait onPlayAi={onPlayAi} />
          <Button variant="danger" onClick={onLeaveQueue}>
            {t("fight.lobby.cancel")}
          </Button>
        </>
      )}
    </div>
  );
}
