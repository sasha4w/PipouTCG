import { useTranslation } from "react-i18next";
import type { PuzzleSaveBody, SandboxState } from "@pipou/shared";
import Button from "../../../components/Button";
import { IconClose } from "../../../components/Icons";
import PuzzleForm from "./PuzzleForm";

interface Props {
  state: SandboxState;
  pending: boolean;
  onSubmit: (body: PuzzleSaveBody) => void;
  onClose: () => void;
}

/** Enregistre la position du sandbox comme défi : la cible vient du plateau adverse de J1. */
export default function SavePuzzleDialog({ state, pending, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const view = state.views.p1;
  const targets = view.opponent.monsterZones.flatMap((m) =>
    m ? [{ instanceId: m.instanceId, name: m.card.baseCard.name }] : [],
  );

  return (
    <>
      <div className="sb-sheet-backdrop" onClick={onClose} />
      <div
        className="sb-sheet"
        role="dialog"
        aria-label={t("puzzle.admin.save_puzzle_title")}
      >
        <div className="sb-sheet__head">
          <div className="sb-sheet__tabs">
            <strong>{t("puzzle.admin.save_puzzle_title")}</strong>
          </div>
          <Button
            size="icon"
            variant="ghost-bordeaux"
            aria-label={t("puzzle.admin.cancel")}
            onClick={onClose}
          >
            <IconClose size={16} />
          </Button>
        </div>
        <div className="sb-sheet__body">
          <PuzzleForm
            targets={targets}
            maxPrimes={Math.max(1, view.me.primes)}
            pending={pending}
            submitLabel={t("puzzle.admin.save_submit")}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </>
  );
}
