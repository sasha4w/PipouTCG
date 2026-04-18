import { useEffect, useState } from "react";
import { bannerService } from "../../services/banner.service";
import { shopService } from "../../services/shop.service";
import { imageService } from "../../services/image.service";
import type { Banner } from "../../services/banner.service";
import type { ShopBooster, ShopBundle } from "../../services/shop.service";
import type { Image } from "../../services/image.service";
import "../../components/manager.css";
import "./BannerManager.css";

// ── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "edit";

interface BannerForm {
  title: string;
  description: string;
  itemType: "BOOSTER" | "BUNDLE";
  itemId: number;
  itemName: string;
  originalPrice: number;
  bannerPrice: number;
  startDate: string;
  endDate: string;
  isPermanent: boolean;
  isActive: boolean;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toIso(local: string): string {
  return local ? new Date(local).toISOString() : "";
}

const emptyForm: BannerForm = {
  title: "",
  description: "",
  itemType: "BOOSTER",
  itemId: 0,
  itemName: "",
  originalPrice: 0,
  bannerPrice: 0,
  startDate: "",
  endDate: "",
  isPermanent: false,
  isActive: true,
};

const STEPS = [
  { label: "Général" },
  { label: "Item" },
  { label: "Prix" },
  { label: "Dates" },
  { label: "Image" },
];

// ── Composant ────────────────────────────────────────────────────────────────

export default function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [boosters, setBoosters] = useState<ShopBooster[]>([]);
  const [bundles, setBundles] = useState<ShopBundle[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [uploadMode, setUploadMode] = useState<"none" | "existing" | "new">(
    "none",
  );
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");

  // ── Chargement ──────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [bannerList, catalog, imageList] = await Promise.all([
        bannerService.findAll(),
        shopService.getCatalog(),
        imageService.findAll(),
      ]);
      setBanners(bannerList);
      setBoosters(catalog.boosters);
      setBundles(catalog.bundles);
      setImages(imageList);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const resetImageState = () => {
    setUploadMode("none");
    setSelectedImageId(null);
    setImageFile(null);
    setImageName("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    resetImageState();
    setStep(1);
    setError("");
    setView("edit");
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title,
      description: b.description ?? "",
      itemType: b.itemType,
      itemId: b.itemId,
      itemName: b.itemName,
      originalPrice: b.originalPrice,
      bannerPrice: b.bannerPrice,
      startDate: toLocalInput(b.startDate),
      endDate: toLocalInput(b.endDate),
      isPermanent: b.isPermanent,
      isActive: b.isActive,
    });
    if (b.imageUrl) {
      const match = images.find((img) => img.url === b.imageUrl);
      if (match) {
        setUploadMode("existing");
        setSelectedImageId(match.id);
      } else resetImageState();
    } else {
      resetImageState();
    }
    setImageFile(null);
    setImageName("");
    setStep(1);
    setError("");
    setView("edit");
  };

  const backToList = () => {
    setView("list");
    setEditing(null);
    setError("");
  };

  // ── Helpers formulaire ──────────────────────────────────────────────────────

  const set = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleItemSelect = (rawId: string) => {
    const id = Number(rawId);
    if (id === 0) {
      setForm((f) => ({ ...f, itemId: 0, itemName: "", originalPrice: 0 }));
      return;
    }
    if (form.itemType === "BOOSTER") {
      const b = boosters.find((x) => x.id === id);
      if (b)
        setForm((f) => ({
          ...f,
          itemId: b.id,
          itemName: b.name,
          originalPrice: b.price,
        }));
    } else {
      const b = bundles.find((x) => x.id === id);
      if (b)
        setForm((f) => ({
          ...f,
          itemId: b.id,
          itemName: b.name,
          originalPrice: b.price,
        }));
    }
  };

  // ── Validation par étape ────────────────────────────────────────────────────

  const validateStep = (s: number): string | null => {
    if (s === 1 && !form.title.trim()) return "Le titre est requis.";
    if (s === 2 && form.itemId === 0) return "Veuillez sélectionner un item.";
    if (s === 3 && form.bannerPrice > form.originalPrice)
      return "Le prix bannière ne peut pas dépasser le prix original.";
    if (s === 4) {
      if (!form.startDate) return "La date de début est requise.";
      if (!form.isPermanent && !form.endDate)
        return "La date de fin est requise.";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const goPrev = () => {
    setError("");
    setStep((s) => s - 1);
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      let resolvedImageUrl: string | undefined;
      if (uploadMode === "new" && imageFile && imageName.trim()) {
        const uploaded = await imageService.upload(imageFile, imageName.trim());
        resolvedImageUrl = uploaded.url;
      } else if (uploadMode === "existing" && selectedImageId) {
        resolvedImageUrl = images.find((i) => i.id === selectedImageId)?.url;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        imageUrl: resolvedImageUrl,
        itemType: form.itemType,
        itemId: form.itemId,
        itemName: form.itemName,
        originalPrice: form.originalPrice,
        bannerPrice: form.bannerPrice,
        startDate: toIso(form.startDate),
        endDate: form.isPermanent ? undefined : toIso(form.endDate),
        isPermanent: form.isPermanent,
        isActive: form.isActive,
      };

      if (editing) await bannerService.update(editing.id, payload);
      else await bannerService.create(payload as Omit<Banner, "id">);

      backToList();
      load();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette bannière ?")) return;
    try {
      await bannerService.remove(id);
      load();
    } catch {
      setError("Erreur lors de la suppression.");
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const updated = await bannerService.toggleActive(id);
      setBanners((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b)),
      );
    } catch {
      setError("Erreur lors du toggle.");
    }
  };

  // ── Badge statut ─────────────────────────────────────────────────────────────

  const StatusBadge = ({ banner }: { banner: Banner }) => {
    const now = new Date();
    const start = new Date(banner.startDate);
    const end = banner.endDate ? new Date(banner.endDate) : null;
    if (!banner.isActive)
      return (
        <span className="manager-item__badge manager-item__badge--inactive">
          Inactif
        </span>
      );
    if (start > now)
      return (
        <span className="manager-item__badge manager-item__badge--pending">
          À venir
        </span>
      );
    if (end && end < now)
      return (
        <span className="manager-item__badge manager-item__badge--expired">
          Expiré
        </span>
      );
    return (
      <span className="manager-item__badge manager-item__badge--active">
        {banner.isPermanent ? "⭐ Permanent" : "⚡ En cours"}
      </span>
    );
  };

  // ══ VUE LISTE ════════════════════════════════════════════════════════════════

  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Bannières</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouvelle
          </button>
        </div>

        {error && <p className="manager-error">{error}</p>}

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : banners.length === 0 ? (
          <p className="manager-empty">Aucune bannière.</p>
        ) : (
          <div className="manager-list">
            {banners.map((b) => (
              <div key={b.id} className="manager-item">
                {b.imageUrl && (
                  <img
                    src={b.imageUrl}
                    alt=""
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div className="manager-item__info">
                  <div className="manager-item__name">
                    {b.title}
                    <StatusBadge banner={b} />
                  </div>
                  <div className="manager-item__meta">
                    {b.itemType === "BOOSTER" ? "📦" : "🎁"} {b.itemName} ·{" "}
                    {b.bannerPrice < b.originalPrice ? (
                      <>
                        <span
                          style={{
                            textDecoration: "line-through",
                            opacity: 0.5,
                          }}
                        >
                          {b.originalPrice}
                        </span>{" "}
                        {b.bannerPrice}
                      </>
                    ) : (
                      b.bannerPrice
                    )}{" "}
                    gold
                    {!b.isPermanent && b.endDate && (
                      <>
                        {" "}
                        · fin {new Date(b.endDate).toLocaleDateString("fr-FR")}
                      </>
                    )}
                  </div>
                </div>
                <div className="manager-item__actions">
                  <button
                    className="manager-item__edit-btn"
                    title={b.isActive ? "Désactiver" : "Activer"}
                    onClick={() => handleToggle(b.id)}
                  >
                    {b.isActive ? "⏸" : "▶"}
                  </button>
                  <button
                    className="manager-item__edit-btn"
                    onClick={() => openEdit(b)}
                  >
                    ✏
                  </button>
                  <button
                    className="manager-item__delete-btn"
                    onClick={() => handleDelete(b.id)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

  // ══ VUE WIZARD ═══════════════════════════════════════════════════════════════

  const itemOptions =
    form.itemType === "BOOSTER"
      ? boosters.map((b) => ({ id: b.id, label: `${b.name} (${b.price}g)` }))
      : bundles.map((b) => ({ id: b.id, label: `${b.name} (${b.price}g)` }));

  const isLast = step === STEPS.length;

  return (
    <div className="manager">
      {/* ── Header ── */}
      <div className="manager__header">
        <button className="manager-form__cancel" onClick={backToList}>
          ← Retour
        </button>
        <h2 className="manager__title">
          {editing ? "Modifier" : "Nouvelle"} bannière
        </h2>
      </div>

      {/* ── Stepper ── */}
      <div className="bm-stepper">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} className="bm-stepper__item">
              {i < STEPS.length - 1 && (
                <div
                  className={`bm-stepper__line${done ? " bm-stepper__line--done" : ""}`}
                />
              )}
              <button
                className={`bm-stepper__dot${active ? " bm-stepper__dot--active" : done ? " bm-stepper__dot--done" : ""}`}
                onClick={() => {
                  if (done) {
                    setError("");
                    setStep(n);
                  }
                }}
                disabled={!done && !active}
                aria-label={s.label}
              >
                {done ? "✓" : n}
              </button>
              <span
                className={`bm-stepper__label${active ? " bm-stepper__label--active" : ""}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p className="manager-error">{error}</p>}

      {/* ── Étape 1 : Général ── */}
      {step === 1 && (
        <div className="manager-form">
          <p className="manager-form__title">Informations générales</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Titre *</label>
            <input
              className="manager-form__input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : Promo Été"
              autoFocus
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">Description</label>
            <textarea
              className="manager-form__textarea"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Texte affiché sous le titre (optionnel)"
            />
          </div>
        </div>
      )}

      {/* ── Étape 2 : Item ── */}
      {step === 2 && (
        <div className="manager-form">
          <p className="manager-form__title">Item vendu</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Type *</label>
            <select
              className="manager-form__select"
              value={form.itemType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  itemType: e.target.value as "BOOSTER" | "BUNDLE",
                  itemId: 0,
                  itemName: "",
                  originalPrice: 0,
                }))
              }
            >
              <option value="BOOSTER">📦 Booster</option>
              <option value="BUNDLE">🎁 Bundle</option>
            </select>
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">Item *</label>
            <select
              className="manager-form__select"
              value={form.itemId}
              onChange={(e) => handleItemSelect(e.target.value)}
            >
              <option value={0}>-- Choisir --</option>
              {itemOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">
              Nom affiché dans la bannière *
            </label>
            <input
              className="manager-form__input"
              value={form.itemName}
              onChange={(e) => set("itemName", e.target.value)}
              placeholder="Rempli automatiquement"
            />
          </div>
        </div>
      )}

      {/* ── Étape 3 : Prix ── */}
      {step === 3 && (
        <div className="manager-form">
          <p className="manager-form__title">Prix</p>
          <div className="manager-form__row">
            <label className="manager-form__label">
              Prix original (gold) *
            </label>
            <input
              className="manager-form__input"
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => set("originalPrice", Number(e.target.value))}
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">
              Prix bannière (gold) *
              {form.bannerPrice < form.originalPrice &&
                form.originalPrice > 0 && (
                  <span className="bm-discount-badge">
                    −
                    {Math.round(
                      (1 - form.bannerPrice / form.originalPrice) * 100,
                    )}
                    %
                  </span>
                )}
            </label>
            <input
              className="manager-form__input"
              type="number"
              min={0}
              value={form.bannerPrice}
              onChange={(e) => set("bannerPrice", Number(e.target.value))}
            />
          </div>
          {form.originalPrice > 0 && (
            <div className="bm-price-recap">
              {form.itemName || "Item"}{" "}
              {form.bannerPrice < form.originalPrice ? (
                <>
                  <s>{form.originalPrice}g</s> →{" "}
                  <strong>{form.bannerPrice}g</strong>
                </>
              ) : (
                <strong>{form.originalPrice}g</strong>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Étape 4 : Dates & options ── */}
      {step === 4 && (
        <div className="manager-form">
          <p className="manager-form__title">Planification</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Date de début *</label>
            <input
              className="manager-form__input"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div className="bm-checkbox-row">
            <input
              type="checkbox"
              id="banner-permanent"
              checked={form.isPermanent}
              onChange={(e) => set("isPermanent", e.target.checked)}
            />
            <label htmlFor="banner-permanent" className="manager-form__label">
              Bannière permanente (sans date de fin)
            </label>
          </div>
          {!form.isPermanent && (
            <div className="manager-form__row">
              <label className="manager-form__label">Date de fin *</label>
              <input
                className="manager-form__input"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          )}
          <div className="bm-checkbox-row">
            <input
              type="checkbox"
              id="banner-active"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <label htmlFor="banner-active" className="manager-form__label">
              Activer immédiatement
            </label>
          </div>
        </div>
      )}

      {/* ── Étape 5 : Image ── */}
      {step === 5 && (
        <div className="manager-form">
          <p className="manager-form__title">
            Image de fond <span className="bm-optional">(optionnel)</span>
          </p>
          <div className="manager-form__row">
            <label className="manager-form__label">Source</label>
            <select
              className="manager-form__select"
              value={uploadMode}
              onChange={(e) => {
                setUploadMode(e.target.value as "none" | "existing" | "new");
                setSelectedImageId(null);
                setImageFile(null);
                setImageName("");
              }}
            >
              <option value="none">Aucune image</option>
              <option value="existing">Image existante</option>
              <option value="new">Upload nouvelle image</option>
            </select>
          </div>
          {uploadMode === "existing" && (
            <>
              <div className="manager-form__row">
                <select
                  className="manager-form__select"
                  value={selectedImageId ?? ""}
                  onChange={(e) =>
                    setSelectedImageId(Number(e.target.value) || null)
                  }
                >
                  <option value="">-- Choisir une image --</option>
                  {images.map((img) => (
                    <option key={img.id} value={img.id}>
                      {img.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedImageId &&
                (() => {
                  const img = images.find((i) => i.id === selectedImageId);
                  return img ? (
                    <img
                      src={img.url}
                      alt={img.name}
                      className="bm-img-preview"
                    />
                  ) : null;
                })()}
            </>
          )}
          {uploadMode === "new" && (
            <>
              <div className="manager-form__row">
                <label className="manager-form__label">Nom de l'image</label>
                <input
                  className="manager-form__input"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  placeholder="Nom de l'image"
                />
              </div>
              <div className="manager-form__row">
                <label className="manager-form__label">Fichier</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.82rem" }}
                />
              </div>
              {imageFile && (
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="preview"
                  className="bm-img-preview"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Navigation wizard ── */}
      <div className="bm-nav">
        {step > 1 ? (
          <button className="manager-form__cancel" onClick={goPrev}>
            ← Précédent
          </button>
        ) : (
          <div />
        )}
        {isLast ? (
          <button
            className="manager-form__submit"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "..." : editing ? "Modifier" : "Créer la bannière"}
          </button>
        ) : (
          <button className="manager-form__submit" onClick={goNext}>
            Suivant →
          </button>
        )}
      </div>
    </div>
  );
}
