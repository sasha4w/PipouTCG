import { useEffect, useState } from "react";
import { cardService, Rarity, CardType } from "../../services/card.service";
import { cardSetService } from "../../services/card-set.service";
import { imageService } from "../../services/image.service";
import type { Card, CreateCardData } from "../../services/card.service";
import type { CardSet } from "../../services/card-set.service";
import type { Image } from "../../services/image.service";
import "../../components/manager.css";

const emptyForm: CreateCardData = {
  name: "",
  rarity: Rarity.COMMON,
  type: CardType.MONSTER,
  atk: 0,
  hp: 0,
  cost: 1,
  cardSetId: 0,
};

export default function CardManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [form, setForm] = useState<CreateCardData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");
  const [uploadMode, setUploadMode] = useState<"existing" | "new">("existing");
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const [cRes, sRes, iRes] = await Promise.all([
        cardService.findAll(p, 10),
        cardSetService.findAll(1, 100),
        imageService.findAll(),
      ]);
      setCards(cRes.data);
      setTotal(cRes.meta.totalPages);
      setSets(sRes.data);
      setImages(iRes);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImageName("");
    setSelectedImageId(null);
    setUploadMode("existing");
    setShowForm(true);
  };
  const openEdit = (c: Card) => {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description,
      rarity: c.rarity,
      type: c.type,
      atk: c.atk,
      hp: c.hp,
      cost: c.cost,
      cardSetId: c.cardSet.id,
    });
    setSelectedImageId(c.image?.id ?? null);
    setUploadMode("existing");
    setShowForm(true);
  };
  const cancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.cardSetId) return;
    setSaving(true);
    try {
      // 1. On prépare l'objet data de base
      const data: CreateCardData = { ...form };

      // 2. Gestion de l'image selon le mode choisi
      if (uploadMode === "new" && imageFile && imageName) {
        // Option A : Tu uploades d'abord l'image via imageService
        const uploaded = await imageService.upload(imageFile, imageName);
        data.imageId = uploaded.id; // On utilise l'ID de l'image fraîchement créée
      } else if (uploadMode === "existing" && selectedImageId) {
        // Option B : Tu utilises une image déjà présente en base
        data.imageId = selectedImageId;
      }

      // 3. Envoi au cardService
      if (editing) {
        await cardService.update(editing.id, data);
      } else {
        await cardService.create(data);
      }

      cancel();
      load();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette carte ?")) return;
    try {
      await cardService.remove(id);
      load();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const set = (k: keyof CreateCardData, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">Cartes</h2>
        <button className="manager__add-btn" onClick={openCreate}>
          + Nouvelle
        </button>
      </div>

      {error && <p className="manager-error">{error}</p>}

      {showForm && (
        <div className="manager-form">
          <p className="manager-form__title">
            {editing ? "Modifier" : "Nouvelle"} carte
          </p>

          <div className="manager-form__row">
            <label className="manager-form__label">Nom</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nom de la carte"
            />
          </div>

          <div className="manager-form__row">
            <label className="manager-form__label">Description</label>
            <textarea
              className="manager-form__textarea"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Description..."
            />
          </div>

          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Rareté</label>
              <select
                className="manager-form__select"
                value={form.rarity}
                onChange={(e) => set("rarity", e.target.value)}
              >
                {Object.values(Rarity).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">Type</label>
              <select
                className="manager-form__select"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {Object.values(CardType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">ATK</label>
              <input
                className="manager-form__input"
                type="number"
                value={form.atk}
                onChange={(e) => set("atk", Number(e.target.value))}
              />
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">HP</label>
              <input
                className="manager-form__input"
                type="number"
                value={form.hp}
                onChange={(e) => set("hp", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Coût</label>
              <input
                className="manager-form__input"
                type="number"
                value={form.cost}
                onChange={(e) => set("cost", Number(e.target.value))}
              />
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">Card Set</label>
              <select
                className="manager-form__select"
                value={form.cardSetId}
                onChange={(e) => set("cardSetId", Number(e.target.value))}
              >
                <option value={0}>-- Choisir --</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Image */}
          <div className="manager-form__row">
            <label className="manager-form__label">Image</label>
            <select
              className="manager-form__select"
              value={uploadMode}
              onChange={(e) =>
                setUploadMode(e.target.value as "existing" | "new")
              }
            >
              <option value="existing">Image existante</option>
              <option value="new">Upload nouvelle image</option>
            </select>
          </div>

          {uploadMode === "existing" ? (
            <div className="manager-form__row">
              <select
                className="manager-form__select"
                value={selectedImageId ?? ""}
                onChange={(e) =>
                  setSelectedImageId(Number(e.target.value) || null)
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
            </>
          )}

          <div className="manager-form__actions">
            <button
              className="manager-form__submit"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "..." : editing ? "Modifier" : "Créer"}
            </button>
            <button className="manager-form__cancel" onClick={cancel}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="manager-empty">Chargement...</p>
      ) : cards.length === 0 ? (
        <p className="manager-empty">Aucune carte.</p>
      ) : (
        <div className="manager-list">
          {cards.map((c) => (
            <div key={c.id} className="manager-item">
              {c.image && (
                <img
                  src={c.image.url}
                  alt={c.name}
                  style={{
                    width: 32,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              )}
              <div className="manager-item__info">
                <div className="manager-item__name">{c.name}</div>
                <div className="manager-item__meta">
                  {c.rarity} · {c.cardSet.name} · ATK {c.atk} / HP {c.hp}
                </div>
              </div>
              <div className="manager-item__actions">
                <button
                  className="manager-item__edit-btn"
                  onClick={() => openEdit(c)}
                >
                  ✏
                </button>
                <button
                  className="manager-item__delete-btn"
                  onClick={() => handleDelete(c.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 1 && (
        <div className="manager-pagination">
          <button
            className="manager-pagination__btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span className="manager-pagination__info">
            {page} / {total}
          </span>
          <button
            className="manager-pagination__btn"
            disabled={page >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
