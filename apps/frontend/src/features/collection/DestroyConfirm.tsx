import { useState } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { IconAlert, IconDust, IconTrash } from "../../components/Icons";
import { HIGH_RARITIES, hasHighRarity, type DestroyLine } from "./ownedCards";
import "./DestroyTab.css";

interface Props {
  lines: DestroyLine[];
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Récapitulatif de ce qui va être détruit ; rien n'est détruit avant « Détruire ». */
export default function DestroyConfirm({
  lines,
  pending,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const [understood, setUnderstood] = useState(false);
  const total = lines.reduce((sum, l) => sum + l.dust, 0);
  const high = hasHighRarity(lines);
  const highNames = lines
    .filter((l) => HIGH_RARITIES.includes(l.card.rarity))
    .map((l) => l.card.name)
    .join(", ");

  return (
    <BottomSheet
      title={t("collection.destroy_confirm_title")}
      closeLabel={t("collection.close")}
      onClose={onCancel}
    >
      <div className="destroy-confirm">
        <ul className="destroy-confirm__lines">
          {lines.map((l) => (
            <li key={l.card.id} className="destroy-confirm__line">
              <span className="destroy-confirm__name">{l.card.name}</span>
              <span>×{l.quantity}</span>
              <span className="destroy-confirm__dust">
                <IconDust size={14} color="currentColor" />
                {l.dust}
              </span>
            </li>
          ))}
        </ul>
        <p className="destroy-confirm__total">
          <IconDust size={16} color="currentColor" />
          {t("collection.destroy_total", { dust: total })}
        </p>

        {high && (
          <div className="destroy-confirm__warning">
            <p>
              <IconAlert size={16} color="currentColor" />
              {t("collection.destroy_warning", { names: highNames })}
            </p>
            <label className="destroy-confirm__understand">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              {t("collection.destroy_understand")}
            </label>
          </div>
        )}

        {error && (
          <p className="destroy-confirm__error" role="alert">
            {error}
          </p>
        )}

        <div className="destroy-confirm__actions">
          <Button variant="ghost-gold" disabled={pending} onClick={onCancel}>
            {t("collection.destroy_cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={pending || lines.length === 0 || (high && !understood)}
            onClick={onConfirm}
          >
            <IconTrash size={16} color="currentColor" />
            {pending
              ? t("collection.destroy_pending")
              : t("collection.destroy_submit")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
