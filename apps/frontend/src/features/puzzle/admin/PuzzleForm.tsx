import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { PuzzleObjectiveType } from "@pipou/shared";
import type { PuzzleObjective, PuzzleSaveBody } from "@pipou/shared";
import Button from "../../../components/Button";
import "../../../components/manager.css";

export interface PuzzleFormValues {
  title: string;
  description: string;
  objective: PuzzleObjective;
  rewardGold?: number;
  rewardXp?: number;
}

interface Props {
  initial?: PuzzleFormValues;
  /** Monstres adverses parmi lesquels choisir la cible. */
  targets: { instanceId: string; name: string }[];
  /** Plafond des primes à prendre (primes de J1 dans le sandbox). Absent : 100. */
  maxPrimes?: number;
  pending?: boolean;
  /** Message d'erreur serveur, affiché sous le formulaire. */
  error?: string | null;
  submitLabel: string;
  onSubmit: (body: PuzzleSaveBody) => void;
  onCancel: () => void;
}

const OBJECTIVE_TYPES = Object.values(PuzzleObjectiveType);

/** Entier saisi ; vide ou invalide : undefined. */
function toInt(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** Formulaire de défi, partagé entre l'édition en ligne et l'enregistrement depuis le sandbox. */
export default function PuzzleForm({
  initial,
  targets,
  maxPrimes = 100,
  pending = false,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<PuzzleObjectiveType>(
    initial?.objective.type ?? PuzzleObjectiveType.WIN_GAME,
  );
  const [target, setTarget] = useState(initial?.objective.targetInstanceId ?? "");
  const [primes, setPrimes] = useState(String(initial?.objective.primes ?? 1));
  const [gold, setGold] = useState(initial?.rewardGold?.toString() ?? "");
  const [xp, setXp] = useState(initial?.rewardXp?.toString() ?? "");

  const primesValue = toInt(primes);
  const primesValid =
    primesValue !== undefined && primesValue >= 1 && primesValue <= maxPrimes;
  const valid =
    title.trim().length > 0 &&
    (type !== PuzzleObjectiveType.DESTROY_MONSTER || target !== "") &&
    (type !== PuzzleObjectiveType.TAKE_PRIMES || primesValid);

  function submit() {
    const objective: PuzzleObjective = { type };
    if (type === PuzzleObjectiveType.DESTROY_MONSTER)
      objective.targetInstanceId = target;
    if (type === PuzzleObjectiveType.TAKE_PRIMES) objective.primes = primesValue;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      objective,
      rewardGold: toInt(gold),
      rewardXp: toInt(xp),
    });
  }

  return (
    <form
      className="manager-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !pending) submit();
      }}
    >
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor={`${uid}-title`}>
          {t("puzzle.admin.f_title")}
        </label>
        <input
          id={`${uid}-title`}
          className="manager-form__input"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor={`${uid}-desc`}>
          {t("puzzle.admin.f_description")}
        </label>
        <textarea
          id={`${uid}-desc`}
          className="manager-form__textarea"
          maxLength={255}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor={`${uid}-type`}>
          {t("puzzle.admin.f_objective")}
        </label>
        <select
          id={`${uid}-type`}
          className="manager-form__select"
          value={type}
          onChange={(e) => setType(e.target.value as PuzzleObjectiveType)}
        >
          {OBJECTIVE_TYPES.map((o) => (
            <option key={o} value={o}>
              {t(`puzzle.admin.obj_${o}`)}
            </option>
          ))}
        </select>
      </div>
      {type === PuzzleObjectiveType.DESTROY_MONSTER && (
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor={`${uid}-target`}>
            {t("puzzle.admin.f_target")}
          </label>
          <select
            id={`${uid}-target`}
            className="manager-form__select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">{t("puzzle.admin.no_target")}</option>
            {targets.map((m) => (
              <option key={m.instanceId} value={m.instanceId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {type === PuzzleObjectiveType.TAKE_PRIMES && (
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor={`${uid}-primes`}>
            {t("puzzle.admin.f_primes")}
          </label>
          <input
            id={`${uid}-primes`}
            className="manager-form__input"
            type="number"
            min={1}
            max={maxPrimes}
            value={primes}
            onChange={(e) => setPrimes(e.target.value)}
          />
        </div>
      )}
      <div className="manager-form__grid">
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor={`${uid}-gold`}>
            {t("puzzle.admin.f_gold")}
          </label>
          <input
            id={`${uid}-gold`}
            className="manager-form__input"
            type="number"
            min={0}
            max={10000}
            value={gold}
            onChange={(e) => setGold(e.target.value)}
          />
        </div>
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor={`${uid}-xp`}>
            {t("puzzle.admin.f_xp")}
          </label>
          <input
            id={`${uid}-xp`}
            className="manager-form__input"
            type="number"
            min={0}
            max={5000}
            value={xp}
            onChange={(e) => setXp(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="manager-error" role="alert">
          {error}
        </p>
      )}
      <div className="manager-form__actions">
        <Button type="submit" className="manager-form__submit" disabled={!valid || pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost-bordeaux" onClick={onCancel}>
          {t("puzzle.admin.cancel")}
        </Button>
      </div>
    </form>
  );
}
