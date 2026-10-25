import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DUST_VALUE, type Rarity } from "@pipou/shared";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { IconDust } from "../../components/Icons";
import { forgeService } from "../../services/forge.service";
import { apiErrorMessage } from "../../utils/errors";
import { useInvalidateAfterForge, useUsableByCard } from "./useForge";
import "./Forge.css";

interface Props {
  card: { id: number; name: string; rarity: Rarity };
  onClose: () => void;
}

export default function DestroyDialog({ card, onClose }: Props) {
  const { t } = useTranslation();
  const usable = useUsableByCard().get(card.id) ?? 0;
  const invalidate = useInvalidateAfterForge();
  const [choice, setChoice] = useState(1);
  const quantity = Math.min(Math.max(choice, 1), Math.max(usable, 1));
  const gain = quantity * DUST_VALUE[card.rarity];

  const mutation = useMutation({
    mutationFn: () => forgeService.destroy({ cardId: card.id, quantity }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  return (
    <BottomSheet
      title={t("forge.destroy_title")}
      closeLabel={t("forge.close")}
      onClose={onClose}
    >
      <div className="forge">
        <p className="forge__card-name">{card.name}</p>
        {usable === 0 ? (
          <p className="forge__empty">{t("forge.none_usable")}</p>
        ) : (
          <>
            <div className="forge__row">
              <span className="forge__row-name">{t("forge.quantity")}</span>
              <span className="forge__row-usable">
                {t("forge.usable", { count: usable })}
              </span>
              <span className="forge__stepper">
                <Button
                  size="icon"
                  variant="ghost-gold"
                  aria-label={t("forge.remove", { name: card.name })}
                  disabled={quantity <= 1}
                  onClick={() => setChoice(quantity - 1)}
                >
                  -
                </Button>
                <span className="forge__qty">{quantity}</span>
                <Button
                  size="icon"
                  variant="ghost-gold"
                  aria-label={t("forge.add", { name: card.name })}
                  disabled={quantity >= usable}
                  onClick={() => setChoice(quantity + 1)}
                >
                  +
                </Button>
              </span>
            </div>
            <p className="forge-dust forge-dust--gain">
              <IconDust size={16} color="currentColor" />
              {t("forge.gain", { count: gain })}
            </p>
          </>
        )}

        {mutation.isError && (
          <p className="forge__error" role="alert">
            {apiErrorMessage(mutation.error) ?? t("forge.error")}
          </p>
        )}

        <Button
          variant="danger"
          fullWidth
          disabled={usable === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t("forge.destroy_confirm")}
        </Button>
      </div>
    </BottomSheet>
  );
}
