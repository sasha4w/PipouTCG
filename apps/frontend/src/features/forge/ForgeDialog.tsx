import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FORGE_COST,
  Rarity,
  isForgeable,
  nextForgeRarity,
} from "@pipou/shared";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { IconDust, IconForge } from "../../components/Icons";
import { forgeService } from "../../services/forge.service";
import type { UserCollection } from "../../services/user.service";
import { apiErrorMessage } from "../../utils/errors";
import { canSubmitForge, selectionTotal } from "./forgeSelection";
import type { ForgeSelection } from "./forgeSelection";
import { useInvalidateAfterForge, useUsableByCard } from "./useForge";
import "./Forge.css";

interface Props {
  collection: UserCollection;
  onClose: () => void;
}

type SetCards = UserCollection["sets"][number]["cards"];

const FORGE_RARITIES = Object.keys(FORGE_COST) as Rarity[];

/** Raretés forgeables pour lesquelles le set contient au moins une carte possédée. */
function inputRarities(cards: SetCards): Rarity[] {
  return FORGE_RARITIES.filter((r) =>
    cards.some((c) => c.owned && c.rarity === r),
  );
}

export default function ForgeDialog({ collection, onClose }: Props) {
  const { t } = useTranslation();
  const usableByCard = useUsableByCard();
  const invalidate = useInvalidateAfterForge();

  const [setChoice, setSetChoice] = useState<number | null>(null);
  const [rarityChoice, setRarityChoice] = useState<Rarity | null>(null);
  const [selection, setSelection] = useState<ForgeSelection>({});
  const [targetId, setTargetId] = useState<number | null>(null);

  const forgeableSets = collection.sets.filter(
    (s) => inputRarities(s.cards).length > 0,
  );
  const set =
    forgeableSets.find((s) => s.id === setChoice) ?? forgeableSets[0];
  const rarities = set ? inputRarities(set.cards) : [];
  const rarity =
    rarityChoice && rarities.includes(rarityChoice)
      ? rarityChoice
      : rarities[0];

  const cost = rarity && isForgeable(rarity) ? (FORGE_COST[rarity] ?? 0) : 0;
  const targetRarity = rarity ? nextForgeRarity(rarity) : null;
  const inputs = set
    ? set.cards.filter((c) => c.owned && c.rarity === rarity)
    : [];
  const targets = set
    ? set.cards.filter((c) => c.rarity === targetRarity)
    : [];
  const total = selectionTotal(selection);
  const ready = canSubmitForge(selection, cost) && targetId !== null;

  const mutation = useMutation({
    mutationFn: () =>
      forgeService.forge({
        inputs: Object.entries(selection)
          .filter(([, quantity]) => quantity > 0)
          .map(([cardId, quantity]) => ({ cardId: Number(cardId), quantity })),
        targetCardId: targetId as number,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const resetPicks = () => {
    setSelection({});
    setTargetId(null);
    mutation.reset();
  };

  const change = (cardId: number, delta: number, max: number) => {
    setSelection((prev) => {
      const next = Math.min(max, Math.max(0, (prev[cardId] ?? 0) + delta));
      return { ...prev, [cardId]: next };
    });
  };

  return (
    <BottomSheet
      title={t("forge.title")}
      closeLabel={t("forge.close")}
      onClose={onClose}
    >
      {!set || !rarity ? (
        <p className="forge__empty">{t("forge.no_forgeable")}</p>
      ) : (
        <div className="forge">
          <label className="forge__field">
            <span>{t("forge.set")}</span>
            <select
              className="forge__select"
              value={set.id}
              onChange={(e) => {
                setSetChoice(Number(e.target.value));
                setRarityChoice(null);
                resetPicks();
              }}
            >
              {forgeableSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="forge__field">
            <span>{t("forge.rarity")}</span>
            <select
              className="forge__select"
              value={rarity}
              onChange={(e) => {
                setRarityChoice(e.target.value as Rarity);
                resetPicks();
              }}
            >
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {t(`rarity.${r.toLowerCase()}`)} ({FORGE_COST[r]})
                </option>
              ))}
            </select>
          </label>

          <div className="forge__section">
            <div className="forge__section-head">
              <span>{t("forge.cards_to_give")}</span>
              <span
                className={`forge__counter${total === cost ? " forge__counter--full" : ""}`}
              >
                {t("forge.counter", { n: total, cost })}
              </span>
            </div>
            <ul className="forge__list">
              {inputs.map((c) => {
                const usable = usableByCard.get(c.id) ?? 0;
                const picked = selection[c.id] ?? 0;
                const canAdd = picked < usable && total < cost;
                return (
                  <li key={c.id} className="forge__row">
                    <span className="forge__row-name">{c.name}</span>
                    <span className="forge__row-usable">
                      {t("forge.usable", { count: usable })}
                    </span>
                    <span className="forge__stepper">
                      <Button
                        size="icon"
                        variant="ghost-gold"
                        aria-label={t("forge.remove", { name: c.name })}
                        disabled={picked === 0}
                        onClick={() => change(c.id, -1, usable)}
                      >
                        -
                      </Button>
                      <span className="forge__qty">{picked}</span>
                      <Button
                        size="icon"
                        variant="ghost-gold"
                        aria-label={t("forge.add", { name: c.name })}
                        disabled={!canAdd}
                        onClick={() => change(c.id, 1, usable)}
                      >
                        +
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <label className="forge__field">
            <span>{t("forge.target")}</span>
            <select
              className="forge__select"
              value={targetId ?? ""}
              onChange={(e) =>
                setTargetId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">{t("forge.target_placeholder")}</option>
              {targets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.owned
                    ? c.name
                    : t("forge.target_missing", { name: c.name })}
                </option>
              ))}
            </select>
          </label>

          {mutation.isError && (
            <p className="forge__error" role="alert">
              {apiErrorMessage(mutation.error) ?? t("forge.error")}
            </p>
          )}

          <Button
            fullWidth
            disabled={!ready || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <IconForge size={16} color="currentColor" />
            {mutation.isPending ? t("forge.confirming") : t("forge.confirm")}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

/** Solde de poussière affiché à côté des boutons de forge. */
export function DustBalance({ dust }: { dust: number }) {
  const { t } = useTranslation();
  return (
    <span className="forge-dust" title={t("forge.dust")}>
      <IconDust size={16} color="currentColor" />
      {dust.toLocaleString()}
    </span>
  );
}
