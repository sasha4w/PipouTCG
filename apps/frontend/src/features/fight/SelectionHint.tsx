import { useEffect, useState } from "react";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import "./SelectionHint.css";

interface Props {
  /** Indication à montrer ; vide : rien. */
  text: string;
  /** Change quand la sélection change : l'indication réapparaît alors. */
  resetKey: string | number | null;
}

const DURATION_MS = 3000;

/** Indication au centre de l'écran, clignotante pendant 3 s. */
export default function SelectionHint({ text, resetKey }: Props) {
  const { reduced } = useAnimationPrefs();
  const token = `${resetKey}|${text}`;
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Rien à montrer : la prochaine sélection, même identique, la remontrera
  if (!text && dismissed !== null) setDismissed(null);

  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => setDismissed(token), DURATION_MS);
    return () => clearTimeout(id);
  }, [token, text]);

  if (!text || dismissed === token) return null;
  return (
    <div className={`sh${reduced ? " sh--still" : ""}`} role="status">
      <span className="sh-text">{text}</span>
    </div>
  );
}
