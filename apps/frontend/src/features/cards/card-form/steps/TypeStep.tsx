import { CardType, SupportType } from "@pipou/shared";
import type { CreateCardData } from "../../../../services/card.service";
import { SUPPORT_LABELS } from "./stepTypes";

export default function TypeStep({
  form,
  onType,
  onSupportType,
}: {
  form: CreateCardData;
  onType: (t: CardType) => void;
  onSupportType: (s: SupportType | "") => void;
}) {
  return (
    <div className="manager-form">
      <p className="manager-form__title">Type de carte</p>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="card-type">
          Type de carte
        </label>
        <select
          id="card-type"
          className="manager-form__select"
          value={form.type}
          onChange={(e) => onType(e.target.value as CardType)}
        >
          <option value={CardType.MONSTER}>Monstre</option>
          <option value={CardType.SUPPORT}>Support</option>
        </select>
      </div>
      {form.type === CardType.SUPPORT && (
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-support-type">
            Type de support
          </label>
          <select
            id="card-support-type"
            className="manager-form__select"
            value={form.supportType || ""}
            onChange={(e) => onSupportType(e.target.value as SupportType | "")}
          >
            <option value="">-- Sélectionner --</option>
            {Object.values(SupportType).map((st) => (
              <option key={st} value={st}>
                {SUPPORT_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
