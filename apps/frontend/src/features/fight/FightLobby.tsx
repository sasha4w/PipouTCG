import { MatchEndReason } from "@pipou/shared";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { IconArrowRight } from "../../components/Icons";
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
  const { t } = useTranslation();
  if (status === "finished") {
    const draw = endReason === MatchEndReason.DOUBLE_KO;
    const won = !draw && winner === userId;
    return (
      <div className="lobby-center">
        <div className="lobby-result-icon">
          {draw ? "🤝" : won ? "🏆" : "💀"}
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
        <Button size="lg" onClick={onReplay}>
          {t("fight.lobby.replay")}
        </Button>
      </div>
    );
  }

  if (status === "selecting") {
    return (
      <div className="lobby-center">
        <h2 className="lobby-hero-title">⚔️ {t("fight.lobby.found")}</h2>
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
            {t("fight.lobby.deckReady", { id: selectedDeck })}
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
      <h2 className="lobby-hero-title">⚔️ {t("fight.lobby.ready")}</h2>
      <p className="lobby-hero-sub">{t("fight.lobby.intro")}</p>

      {selectedDeck ? (
        <div className="lobby-deck-chosen">
          ✓ {t("fight.lobby.deckSelected")}{" "}
          <span className="lobby-deck-id">#{selectedDeck}</span>
        </div>
      ) : (
        <p className="lobby-muted lobby-muted--mb">
          {t("fight.lobby.pickDeckFirst")}
        </p>
      )}

      {status === "idle" ? (
        <Button size="lg" onClick={onJoinQueue} disabled={!selectedDeck}>
          🔍 {t("fight.lobby.search")}
        </Button>
      ) : (
        <>
          <div className="lobby-queue-anim">
            <span className="lobby-dot" />
            <span className="lobby-dot" />
            <span className="lobby-dot" />
          </div>
          <p className="lobby-muted">{t("fight.lobby.waiting")}</p>
          <Button variant="danger" onClick={onLeaveQueue}>
            {t("fight.lobby.cancel")}
          </Button>
        </>
      )}
    </div>
  );
}
