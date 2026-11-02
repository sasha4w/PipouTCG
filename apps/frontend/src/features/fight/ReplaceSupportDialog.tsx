import { useRef } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import type { CardInstance } from "./fight.types";
import "./ConfirmActionSheet.css";

interface Props {
  card: string;
  candidates: CardInstance[];
  kind?: "equipment" | "terrain";
  onConfirm: (replaceInstanceId: string) => void;
  onCancel: () => void;
}

/** Confirme le remplacement d'un équipement ou d'un Terrain ; choix si deux accessoires. */
export function ReplaceSupportDialog({
  card,
  candidates,
  kind = "equipment",
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const sent = useRef(false);
  const single = candidates.length === 1 ? candidates[0]! : null;

  const confirm = (id: string) => {
    if (sent.current) return;
    sent.current = true;
    onConfirm(id);
  };

  const title = single
    ? t(
        kind === "terrain"
          ? "fight.confirm.replaceTerrain"
          : "fight.confirm.replaceEquipment",
        { old: single.baseCard.name, card },
      )
    : t("fight.confirm.chooseAccessory");

  return (
    <BottomSheet title={title} closeLabel={t("fight.confirm.close")} onClose={onCancel}>
      {!single && (
        <div className="cas-actions" style={{ flexDirection: "column" }}>
          {candidates.map((c) => (
            <button
              key={c.instanceId}
              type="button"
              className="cas-btn"
              onClick={() => confirm(c.instanceId)}
            >
              {c.baseCard.name}
            </button>
          ))}
        </div>
      )}
      <div className="cas-actions">
        <button type="button" className="cas-btn" onClick={onCancel}>
          {t("fight.confirm.cancel")}
        </button>
        {single && (
          <button
            type="button"
            className="cas-btn cas-btn--primary"
            onClick={() => confirm(single.instanceId)}
          >
            {t("fight.confirm.confirm")}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
