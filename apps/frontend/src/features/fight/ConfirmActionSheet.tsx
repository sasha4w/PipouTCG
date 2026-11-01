import { useRef } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import { IconAlert } from "../../components/Icons";
import type { ConfirmText } from "./pendingAction";
import "./ConfirmActionSheet.css";

interface Props {
  text: ConfirmText;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation commune à toute utilisation de carte. */
export default function ConfirmActionSheet({
  text,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  // Un second appui avant la fermeture ne doit pas rejouer l'action.
  const sent = useRef(false);

  const confirm = () => {
    if (sent.current) return;
    sent.current = true;
    onConfirm();
  };

  return (
    <BottomSheet
      title={t(text.key, text.params)}
      closeLabel={t("fight.confirm.close")}
      onClose={onCancel}
    >
      {text.warning && (
        <p className="cas-warning" role="alert">
          <IconAlert size={18} />
          <span>{t(text.warning.key, text.warning.params)}</span>
        </p>
      )}
      <div className="cas-actions">
        <button type="button" className="cas-btn" onClick={onCancel}>
          {t("fight.confirm.cancel")}
        </button>
        <button
          type="button"
          className="cas-btn cas-btn--primary"
          onClick={confirm}
        >
          {t("fight.confirm.confirm")}
        </button>
      </div>
    </BottomSheet>
  );
}
