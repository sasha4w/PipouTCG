import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import "./TurnBanner.css";

interface Props {
  isMyTurn: boolean;
  turnNumber: number;
}

const DURATION_MS = 1200;

/** « À toi de jouer ! » sur fond assombri, au début de mon tour. */
export default function TurnBanner({ isMyTurn, turnNumber }: Props) {
  const { t } = useTranslation();
  const { reduced } = useAnimationPrefs();
  const [visible, setVisible] = useState(isMyTurn && turnNumber > 0);
  const [wasMyTurn, setWasMyTurn] = useState(isMyTurn);

  // Le tour change de main : la bannière ne concerne que mon début de tour
  if (wasMyTurn !== isMyTurn) {
    setWasMyTurn(isMyTurn);
    setVisible(isMyTurn);
  }

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(id);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className={`tb${reduced ? " tb--still" : ""}`} role="status">
      <span className="tb-text">{t("fight.yourTurn")}</span>
    </div>
  );
}
