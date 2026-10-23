import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AdminAdventureOpponent,
  AdminAdventureOpponentBody,
} from "@pipou/shared";
import { adventureService } from "../../../services/adventure.service";
import type { Card } from "../../../services/card.service";
import { apiErrorMessage } from "../../../utils/errors";
import Button from "../../../components/Button";
import { useAdminAdventureMutation } from "./useAdminAdventureMutation";
import "../../../components/manager.css";
import "./AdventureManager.css";

interface Props {
  opponent: AdminAdventureOpponent;
  /** Cartes du set du monde (portrait). */
  cards: Card[];
  onDone: () => void;
}

type RewardKey =
  | "firstWinGold"
  | "firstWinXp"
  | "farmGold"
  | "farmXp"
  | "farmBoosterPct"
  | "farmLegendaryPct"
  | "farmCardPct";

const REWARD_FIELDS: { key: RewardKey; label: string; max?: number }[] = [
  { key: "firstWinGold", label: "first_win_gold" },
  { key: "firstWinXp", label: "first_win_xp" },
  { key: "farmGold", label: "farm_gold" },
  { key: "farmXp", label: "farm_xp" },
  { key: "farmBoosterPct", label: "farm_booster_pct", max: 100 },
  { key: "farmLegendaryPct", label: "farm_legendary_pct", max: 100 },
  { key: "farmCardPct", label: "farm_card_pct", max: 100 },
];

export default function OpponentForm({ opponent, cards, onDone }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AdminAdventureOpponentBody>({
    name: opponent.name,
    quote: opponent.quote,
    portraitCardId: opponent.portraitCardId ?? cards[0]?.id ?? 0,
    firstWinGold: opponent.firstWinGold,
    firstWinXp: opponent.firstWinXp,
    farmGold: opponent.farmGold,
    farmXp: opponent.farmXp,
    farmBoosterPct: opponent.farmBoosterPct,
    farmLegendaryPct: opponent.farmLegendaryPct,
    // Choix de la carte : écran admin du plan 4 (la valeur actuelle est conservée)
    farmCardId: opponent.farmCardId,
    farmCardPct: opponent.farmCardPct,
  });

  const save = useAdminAdventureMutation(
    (body: AdminAdventureOpponentBody) =>
      adventureService.updateOpponent(opponent.id, body),
    onDone,
  );

  const valid =
    form.name.trim() !== "" &&
    form.portraitCardId > 0 &&
    REWARD_FIELDS.every(({ key, max }) => {
      const value = form[key];
      return (
        Number.isInteger(value) && value >= 0 && (max === undefined || value <= max)
      );
    });

  return (
    <div className="manager-form">
      <p className="manager-form__title">
        {t("adventure_admin.opponent.title", { name: opponent.name })}
      </p>
      {save.error && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(save.error) ?? t("adventure_admin.error_generic")}
        </p>
      )}

      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="adv-opp-name">
          {t("adventure_admin.opponent.name")}
        </label>
        <input
          id="adv-opp-name"
          className="manager-form__input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="adv-opp-quote">
          {t("adventure_admin.opponent.quote")}
        </label>
        <textarea
          id="adv-opp-quote"
          className="manager-form__textarea"
          value={form.quote}
          onChange={(e) => setForm({ ...form, quote: e.target.value })}
        />
      </div>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="adv-opp-portrait">
          {t("adventure_admin.opponent.portrait")}
        </label>
        <select
          id="adv-opp-portrait"
          className="manager-form__select"
          value={form.portraitCardId}
          onChange={(e) =>
            setForm({ ...form, portraitCardId: Number(e.target.value) })
          }
        >
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </div>

      <div className="manager-form__grid">
        {REWARD_FIELDS.map(({ key, label, max }) => (
          <div key={key} className="manager-form__row">
            <label className="manager-form__label" htmlFor={`adv-opp-${key}`}>
              {t(`adventure_admin.opponent.${label}`)}
            </label>
            <input
              id={`adv-opp-${key}`}
              className="manager-form__input"
              type="number"
              min={0}
              max={max}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>

      <Button
        className="manager-form__submit"
        disabled={!valid || save.isPending}
        onClick={() => save.mutate(form)}
      >
        {save.isPending ? t("adventure_admin.saving") : t("adventure_admin.save")}
      </Button>
    </div>
  );
}
