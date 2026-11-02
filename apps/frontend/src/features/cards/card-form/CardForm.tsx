import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CardType,
  ChargeMode,
  SupportType,
  cardKindOf,
} from "@pipou/shared";
import { cardService } from "../../../services/card.service";
import type { Card, CreateCardData } from "../../../services/card.service";
import { cardSetService } from "../../../services/card-set.service";
import type { CardSet } from "../../../services/card-set.service";
import { imageService } from "../../../services/image.service";
import type { Image } from "../../../services/image.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage } from "../../../utils/errors";
import Button from "../../../components/Button";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
} from "../../../components/Icons";
import EffectEditor from "./effect-editor/EffectEditor";
import CardPreview from "./CardPreview";
import {
  emptyForm,
  formProblems,
  fromCard,
  hasTypeFields,
  toCardPayload,
} from "./cardPayload";
import { prepareCardImage } from "./svgToWebp";
import TypeStep from "./steps/TypeStep";
import BaseStep from "./steps/BaseStep";
import TypeFieldsStep from "./steps/TypeFieldsStep";
import ImageStep from "./steps/ImageStep";
import type { ImageChoice } from "./steps/ImageStep";
import "./CardForm.css";

type StepId = "type" | "base" | "fields" | "effects" | "image";

const STEP_LABELS: Record<StepId, string> = {
  type: "Type",
  base: "Identité",
  fields: "Réglages",
  effects: "Effets",
  image: "Image",
};

const NO_SETS: CardSet[] = [];
const NO_IMAGES: Image[] = [];

const IMAGE_ERRORS: Record<string, string> = {
  invalid_svg: "Ce SVG est illisible.",
  unsupported_image: "Format d'image non pris en charge (PNG, JPEG, WebP, SVG).",
};

function submitErrorMessage(err: unknown): string {
  if (err instanceof Error && IMAGE_ERRORS[err.message])
    return IMAGE_ERRORS[err.message];
  return apiErrorMessage(err) || "Erreur lors de la sauvegarde";
}

/** Création et édition d'une carte, Monstre ou Support, effets compris. */
export default function CardForm({
  card,
  onDone,
}: {
  card: Card | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState<CreateCardData>(
    card ? fromCard(card) : emptyForm,
  );
  const [image, setImage] = useState<ImageChoice>({
    mode: "existing",
    selectedId: card?.image?.id ?? null,
    name: "",
    file: null,
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setsQuery = useQuery({
    queryKey: QUERY_KEYS.cardSetOptions,
    queryFn: () => cardSetService.findAll(1, 100),
  });
  const imagesQuery = useQuery({
    queryKey: QUERY_KEYS.imageOptions,
    queryFn: () => imageService.findAll(),
  });
  const sets = setsQuery.data?.data ?? NO_SETS;
  const images = imagesQuery.data ?? NO_IMAGES;

  const kind = cardKindOf({ type: form.type, supportType: form.supportType });
  const steps = useMemo<StepId[]>(
    () => [
      "type",
      "base",
      ...(hasTypeFields(form) ? (["fields"] as const) : []),
      "effects",
      "image",
    ],
    [form],
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = step === "image";
  const problems = formProblems(form);

  const previewUrl = useMemo(
    () =>
      image.mode === "new" && image.file
        ? URL.createObjectURL(image.file)
        : (images.find((i) => i.id === image.selectedId)?.url ?? null),
    [image, images],
  );
  useEffect(
    () => () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const patch = (p: Partial<CreateCardData>) => setForm((f) => ({ ...f, ...p }));

  const onType = (type: CardType) =>
    setForm((f) => ({
      ...f,
      type,
      ...(type === CardType.SUPPORT ? { atk: 0, hp: 0, cost: 0 } : {}),
    }));
  const onSupportType = (st: SupportType | "") =>
    setForm((f) => ({
      ...f,
      supportType: st || undefined,
      equipmentSlot: st === SupportType.EQUIPMENT ? f.equipmentSlot : undefined,
      isTerrain: st === SupportType.PERSISTENT ? f.isTerrain : undefined,
      chargeMax: st === SupportType.CHARGE ? (f.chargeMax ?? 3) : undefined,
      chargeMode: st === SupportType.CHARGE ? ChargeMode.ONE_SHOT : undefined,
    }));

  const stepError = (): string | null => {
    if (step === "type" && form.type === CardType.SUPPORT && !form.supportType)
      return "Choisis un type de support.";
    if (step === "base") {
      if (!form.name.trim()) return "Le nom est requis.";
      if (!form.cardSetId) return "Veuillez sélectionner un Card Set.";
    }
    if (
      step === "fields" &&
      form.supportType === SupportType.EQUIPMENT &&
      !form.equipmentSlot
    )
      return "Choisis un emplacement.";
    return null;
  };

  const goNext = () => {
    const err = stepError();
    if (err) return setError(err);
    setError("");
    setStepIndex((i) => i + 1);
  };
  const goPrev = () => {
    setError("");
    setStepIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    if (problems.length > 0) return;
    setSaving(true);
    try {
      const data = toCardPayload(form);
      if (image.mode === "new" && image.file && image.name) {
        const ready = await prepareCardImage(image.file);
        data.imageId = (await imageService.upload(ready, image.name)).id;
      } else if (image.mode === "existing" && image.selectedId) {
        data.imageId = image.selectedId;
      }
      if (card) await cardService.update(card.id, data);
      else await cardService.create(data);
      onDone();
    } catch (err) {
      console.error(err);
      setError(submitErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manager">
      <div className="manager__header">
        <Button variant="ghost-bordeaux" onClick={onDone}>
          <IconArrowLeft size={16} />
          Retour
        </Button>
        <h2 className="manager__title">{card ? "Modifier" : "Nouvelle"} carte</h2>
      </div>

      <div className="bm-stepper">
        {steps.map((id, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={id} className="bm-stepper__item">
              {i < steps.length - 1 && (
                <div
                  className={`bm-stepper__line${done ? " bm-stepper__line--done" : ""}`}
                />
              )}
              <button
                type="button"
                className={`bm-stepper__dot${active ? " bm-stepper__dot--active" : done ? " bm-stepper__dot--done" : ""}`}
                onClick={() => {
                  if (done) {
                    setError("");
                    setStepIndex(i);
                  }
                }}
                disabled={!done && !active}
                aria-label={STEP_LABELS[id]}
              >
                {done ? <IconCheck size={14} /> : i + 1}
              </button>
              <span
                className={`bm-stepper__label${active ? " bm-stepper__label--active" : ""}`}
              >
                {STEP_LABELS[id]}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="manager-error">{error}</p>}

      <div className="card-form__layout">
        <div className="card-form__main">
          {step === "type" && (
            <TypeStep form={form} onType={onType} onSupportType={onSupportType} />
          )}
          {step === "base" && <BaseStep form={form} patch={patch} sets={sets} />}
          {step === "fields" && <TypeFieldsStep form={form} patch={patch} />}
          {step === "effects" && (
            <div className="manager-form">
              <p className="manager-form__title">Effets</p>
              <EffectEditor
                kind={kind}
                value={form.effects ?? []}
                onChange={(effects) => patch({ effects })}
              />
            </div>
          )}
          {step === "image" && (
            <ImageStep
              form={form}
              patch={patch}
              images={images}
              image={image}
              onImage={(p) => setImage((c) => ({ ...c, ...p }))}
            />
          )}
        </div>
        <CardPreview form={form} imageUrl={previewUrl} />
      </div>

      {isLast && problems.length > 0 && (
        <ul className="card-form__problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="bm-nav">
        {stepIndex > 0 ? (
          <Button variant="ghost-bordeaux" onClick={goPrev}>
            <IconArrowLeft size={16} />
            Précédent
          </Button>
        ) : (
          <div />
        )}
        {isLast ? (
          <Button
            className="manager-form__submit"
            onClick={handleSubmit}
            disabled={saving || problems.length > 0}
          >
            {saving ? "..." : card ? "Modifier" : "Créer la carte"}
          </Button>
        ) : (
          <Button className="manager-form__submit" onClick={goNext}>
            Suivant
            <IconArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
