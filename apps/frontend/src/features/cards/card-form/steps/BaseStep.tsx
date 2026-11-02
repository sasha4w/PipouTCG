import { Archetype, DrakonElement, DrakonStage, Rarity } from "@pipou/shared";
import type { CardSet } from "../../../../services/card-set.service";
import type { StepProps } from "./stepTypes";

export default function BaseStep({
  form,
  patch,
  sets,
}: StepProps & { sets: CardSet[] }) {
  return (
    <div className="manager-form">
      <p className="manager-form__title">Identité</p>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="card-name">
          Nom *
        </label>
        <input
          id="card-name"
          className="manager-form__input"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Nom de la carte"
          autoFocus
        />
      </div>
      <div className="manager-form__grid">
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-set">
            Card Set *
          </label>
          <select
            id="card-set"
            className="manager-form__select"
            value={form.cardSetId}
            onChange={(e) => patch({ cardSetId: Number(e.target.value) })}
          >
            <option value={0}>-- Choisir --</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-rarity">
            Rareté
          </label>
          <select
            id="card-rarity"
            className="manager-form__select"
            value={form.rarity}
            onChange={(e) => patch({ rarity: e.target.value as Rarity })}
          >
            {Object.values(Rarity).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="manager-form__grid">
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-cost">
            Coût (0 à 3)
          </label>
          <input
            id="card-cost"
            className="manager-form__input"
            type="number"
            min={0}
            max={3}
            value={form.cost ?? 0}
            onChange={(e) => patch({ cost: Number(e.target.value) })}
          />
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-archetype">
            Archétype
          </label>
          <select
            id="card-archetype"
            className="manager-form__select"
            value={form.archetype ?? ""}
            onChange={(e) =>
              patch({ archetype: (e.target.value || undefined) as Archetype })
            }
          >
            <option value="">--</option>
            {Object.values(Archetype).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="manager-form__grid">
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-element">
            Élément
          </label>
          <select
            id="card-element"
            className="manager-form__select"
            value={form.element ?? ""}
            onChange={(e) =>
              patch({
                element: (e.target.value || undefined) as DrakonElement,
              })
            }
          >
            <option value="">--</option>
            {Object.values(DrakonElement).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-stage">
            Stade
          </label>
          <select
            id="card-stage"
            className="manager-form__select"
            value={form.stage ?? ""}
            onChange={(e) =>
              patch({ stage: (e.target.value || undefined) as DrakonStage })
            }
          >
            <option value="">--</option>
            {Object.values(DrakonStage).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="card-lineage">
          Lignée
        </label>
        <input
          id="card-lineage"
          className="manager-form__input"
          value={form.lineage ?? ""}
          maxLength={50}
          onChange={(e) => patch({ lineage: e.target.value || undefined })}
          placeholder="ex. feros"
        />
      </div>
    </div>
  );
}
