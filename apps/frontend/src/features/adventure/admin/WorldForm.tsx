import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminAdventureWorld, AdminAdventureWorldBody } from "@pipou/shared";
import { adventureService } from "../../../services/adventure.service";
import type { Booster } from "../../../services/booster.service";
import type { CardSet } from "../../../services/card-set.service";
import { apiErrorMessage } from "../../../utils/errors";
import Button from "../../../components/Button";
import { useAdminAdventureMutation } from "./useAdminAdventureMutation";
import "../../../components/manager.css";
import "./AdventureManager.css";

interface Props {
  /** null : création. */
  world: AdminAdventureWorld | null;
  worlds: AdminAdventureWorld[];
  cardSets: CardSet[];
  boosters: Booster[];
  onDone: () => void;
}

export default function WorldForm({ world, worlds, cardSets, boosters, onDone }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AdminAdventureWorldBody>({
    name: world?.name ?? "",
    cardSetId: world?.cardSetId ?? 0,
    boosterId: world?.boosterId ?? 0,
    order: world?.order ?? worlds.length + 1,
    isActive: world?.isActive ?? false,
    prerequisiteIds: world?.prerequisiteIds ?? [],
  });

  const save = useAdminAdventureMutation(
    (body: AdminAdventureWorldBody) =>
      world
        ? adventureService.updateWorld(world.id, body)
        : adventureService.createWorld(body),
    onDone,
  );

  const setBoosters = boosters.filter((b) => b.cardSet.id === form.cardSetId);
  const boosterValue = setBoosters.some((b) => b.id === form.boosterId)
    ? form.boosterId
    : 0;
  const otherWorlds = worlds.filter((w) => w.id !== world?.id);
  const valid =
    form.name.trim() !== "" &&
    form.cardSetId > 0 &&
    boosterValue > 0 &&
    Number.isInteger(form.order) &&
    form.order >= 1;

  const togglePrerequisite = (id: number) =>
    setForm((f) => ({
      ...f,
      prerequisiteIds: f.prerequisiteIds.includes(id)
        ? f.prerequisiteIds.filter((p) => p !== id)
        : [...f.prerequisiteIds, id],
    }));

  return (
    <div className="manager-form">
      <p className="manager-form__title">
        {world ? t("adventure_admin.edit_world") : t("adventure_admin.new_world")}
      </p>
      {save.error && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(save.error) ?? t("adventure_admin.error_generic")}
        </p>
      )}

      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="adv-world-name">
          {t("adventure_admin.world.name")}
        </label>
        <input
          id="adv-world-name"
          className="manager-form__input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="manager-form__grid">
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="adv-world-set">
            {t("adventure_admin.world.card_set")}
          </label>
          <select
            id="adv-world-set"
            className="manager-form__select"
            value={form.cardSetId}
            onChange={(e) =>
              setForm({ ...form, cardSetId: Number(e.target.value), boosterId: 0 })
            }
          >
            <option value={0}>{t("adventure_admin.world.choose")}</option>
            {cardSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="adv-world-booster">
            {t("adventure_admin.world.booster")}
          </label>
          <select
            id="adv-world-booster"
            className="manager-form__select"
            value={boosterValue}
            onChange={(e) => setForm({ ...form, boosterId: Number(e.target.value) })}
          >
            <option value={0}>{t("adventure_admin.world.choose")}</option>
            {setBoosters.map((booster) => (
              <option key={booster.id} value={booster.id}>
                {booster.name}
              </option>
            ))}
          </select>
          {form.cardSetId > 0 && setBoosters.length === 0 && (
            <span className="adv-admin__reason">
              {t("adventure_admin.world.no_booster")}
            </span>
          )}
        </div>
      </div>

      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="adv-world-order">
          {t("adventure_admin.world.order")}
        </label>
        <input
          id="adv-world-order"
          className="manager-form__input"
          type="number"
          min={1}
          value={form.order}
          onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
        />
      </div>

      {otherWorlds.length > 0 && (
        <div className="manager-form__row">
          <span className="manager-form__label">
            {t("adventure_admin.world.prerequisites")}
          </span>
          <div className="adv-admin__checks">
            {otherWorlds.map((other) => (
              <label key={other.id} className="adv-admin__check">
                <input
                  type="checkbox"
                  checked={form.prerequisiteIds.includes(other.id)}
                  onChange={() => togglePrerequisite(other.id)}
                />
                {other.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="adv-admin__check">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        {t("adventure_admin.world.active")}
      </label>

      <Button
        className="manager-form__submit"
        disabled={!valid || save.isPending}
        onClick={() => save.mutate({ ...form, boosterId: boosterValue })}
      >
        {save.isPending
          ? t("adventure_admin.saving")
          : world
            ? t("adventure_admin.save")
            : t("adventure_admin.create")}
      </Button>
    </div>
  );
}
