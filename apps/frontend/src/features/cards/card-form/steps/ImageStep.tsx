import type { Image } from "../../../../services/image.service";
import type { StepProps } from "./stepTypes";

export type UploadMode = "existing" | "new";

export interface ImageChoice {
  mode: UploadMode;
  selectedId: number | null;
  name: string;
  file: File | null;
}

export default function ImageStep({
  form,
  patch,
  images,
  image,
  onImage,
}: StepProps & {
  images: Image[];
  image: ImageChoice;
  onImage: (p: Partial<ImageChoice>) => void;
}) {
  return (
    <div className="manager-form">
      <p className="manager-form__title">
        Lore et image <span className="bm-optional">(optionnels)</span>
      </p>
      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="card-lore">
          Lore
        </label>
        <textarea
          id="card-lore"
          className="manager-form__textarea"
          value={form.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Texte d'ambiance de la carte…"
        />
      </div>

      <div className="manager-form__row">
        <label className="manager-form__label" htmlFor="card-image-source">
          Source
        </label>
        <select
          id="card-image-source"
          className="manager-form__select"
          value={image.mode}
          onChange={(e) =>
            onImage({
              mode: e.target.value as UploadMode,
              selectedId: null,
              file: null,
              name: "",
            })
          }
        >
          <option value="existing">Image existante</option>
          <option value="new">Upload nouvelle image</option>
        </select>
      </div>

      {image.mode === "existing" ? (
        <div className="manager-form__row">
          <select
            className="manager-form__select"
            aria-label="Image existante"
            value={image.selectedId ?? ""}
            onChange={(e) =>
              onImage({ selectedId: Number(e.target.value) || null })
            }
          >
            <option value="">-- Aucune image --</option>
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-image-name">
              Nom de l'image
            </label>
            <input
              id="card-image-name"
              className="manager-form__input"
              value={image.name}
              onChange={(e) => onImage({ name: e.target.value })}
              placeholder="Nom de l'image"
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-image-file">
              Fichier
            </label>
            <input
              id="card-image-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => onImage({ file: e.target.files?.[0] ?? null })}
              style={{ fontSize: "0.82rem" }}
            />
            <span className="bm-optional">
              Un SVG est converti en WebP avant l'envoi.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
