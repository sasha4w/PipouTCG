import { useEffect, useState, useMemo } from "react";
import {
  cardService,
  Rarity,
  CardType,
  SupportType,
} from "../../services/card.service";
import { cardSetService } from "../../services/card-set.service";
import { imageService } from "../../services/image.service";
import type { Card, CreateCardData } from "../../services/card.service";
import type { CardSet } from "../../services/card-set.service";
import type { Image } from "../../services/image.service";
import SearchBar from "../../components/Searchbar";
import FilterPanel, { useFilters } from "../../components/FilterPanel";
import "../../components/manager.css";

const STEPS = [{ label: "Identité" }, { label: "Stats" }, { label: "Image" }];

const emptyForm: CreateCardData = {
  name: "",
  rarity: Rarity.COMMON,
  type: CardType.MONSTER,
  atk: 0,
  hp: 0,
  cost: 1,
  cardSetId: 0,
};

type View = "list" | "edit";

export default function CardManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<View>("list");
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState<Card | null>(null);
  const [form, setForm] = useState<CreateCardData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");
  const [uploadMode, setUploadMode] = useState<"existing" | "new">("existing");
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [groupBySet, setGroupBySet] = useState(false);

  const filterConfig = useMemo(
    () => [
      {
        key: "set",
        label: "Set",
        options: [
          { value: "all", label: "Tous" },
          ...sets.map((s) => ({ value: String(s.id), label: s.name })),
        ],
      },
      {
        key: "type",
        label: "Type",
        options: [
          { value: "all", label: "Tous" },
          { value: "monster", label: "Monstre" },
          { value: "support", label: "Support" },
        ],
      },
      {
        key: "rarity",
        label: "Rareté",
        options: [
          { value: "all", label: "Toutes" },
          ...Object.values(Rarity).map((r) => ({
            value: r.toLowerCase(),
            label: r,
          })),
        ],
      },
    ],
    [sets],
  );

  const { filterValues, setFilter } = useFilters(filterConfig);

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

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (
        filterValues.set !== "all" &&
        String(c.cardSet.id) !== filterValues.set
      )
        return false;
      if (
        filterValues.type !== "all" &&
        c.type?.toLowerCase() !== filterValues.type
      )
        return false;
      if (
        filterValues.rarity !== "all" &&
        c.rarity?.toLowerCase() !== filterValues.rarity
      )
        return false;
      return true;
    });
  }, [cards, search, filterValues]);

  const groupedBySet = useMemo(() => {
    if (!groupBySet) return null;
    const map = new Map<number, { setName: string; cards: Card[] }>();
    filtered.forEach((c) => {
      const g = map.get(c.cardSet.id);
      if (g) g.cards.push(c);
      else map.set(c.cardSet.id, { setName: c.cardSet.name, cards: [c] });
    });
    return Array.from(map.entries());
  }, [filtered, groupBySet]);

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImageName("");
    setSelectedImageId(null);
    setUploadMode("existing");
    setStep(1);
    setError("");
    setView("edit");
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
    setStep(1);
    setError("");
    setView("edit");
  };
  const backToList = () => {
    setView("list");
    setEditing(null);
    setError("");
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.name.trim()) return "Le nom est requis.";
      if (!form.cardSetId) return "Veuillez sélectionner un Card Set.";
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

  const handleSubmit = async () => {
    if (!form.name || !form.cardSetId) return;
    setSaving(true);
    try {
      const data: CreateCardData = { ...form };
      if (uploadMode === "new" && imageFile && imageName) {
        const uploaded = await imageService.upload(imageFile, imageName);
        data.imageId = uploaded.id;
      } else if (uploadMode === "existing" && selectedImageId) {
        data.imageId = selectedImageId;
      }
      if (editing) await cardService.update(editing.id, data);
      else await cardService.create(data);
      backToList();
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

  const setField = (k: keyof CreateCardData, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const renderCard = (c: Card) => (
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
          {c.rarity} · {c.type} · {c.cardSet.name} · ATK {c.atk} / HP {c.hp}
        </div>
      </div>
      <div className="manager-item__actions">
        <button className="manager-item__edit-btn" onClick={() => openEdit(c)}>
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
  );

  const isLast = step === STEPS.length;

  // ══ VUE LISTE ════════════════════════════════════════════════════════════════
  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Cartes</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouvelle
          </button>
        </div>

        {error && <p className="manager-error">{error}</p>}

        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Rechercher une carte…"
          extra={
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#7a1c3b",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={groupBySet}
                onChange={(e) => setGroupBySet(e.target.checked)}
                style={{ accentColor: "#7a1c3b" }}
              />
              Par set
            </label>
          }
        />

        <FilterPanel
          config={filterConfig}
          values={filterValues}
          onChange={(k, v) => applyFilter(() => setFilter(k, v))}
        />

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="manager-empty">Aucune carte.</p>
        ) : groupBySet && groupedBySet ? (
          groupedBySet.map(([setId, { setName, cards: setCards }]) => (
            <div key={setId} style={{ marginBottom: "1rem" }}>
              <div className="manager-set-header">
                <span className="manager-set-name">{setName}</span>
                <span className="manager-set-count">
                  {setCards.length} carte{setCards.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="manager-list">{setCards.map(renderCard)}</div>
            </div>
          ))
        ) : (
          <div className="manager-list">{filtered.map(renderCard)}</div>
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

  // ══ VUE WIZARD ═══════════════════════════════════════════════════════════════
  return (
    <div className="manager">
      <div className="manager__header">
        <button className="manager-form__cancel" onClick={backToList}>
          ← Retour
        </button>
        <h2 className="manager__title">
          {editing ? "Modifier" : "Nouvelle"} carte
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

      {/* ── Étape 1 : Identité ── */}
      {step === 1 && (
        <div className="manager-form">
          <p className="manager-form__title">Identité</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Nom *</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Nom de la carte"
              autoFocus
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">Description</label>
            <textarea
              className="manager-form__textarea"
              value={form.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Description..."
            />
          </div>
          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Rareté</label>
              <select
                className="manager-form__select"
                value={form.rarity}
                onChange={(e) => setField("rarity", e.target.value)}
              >
                {Object.values(Rarity).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">Card Set *</label>
              <select
                className="manager-form__select"
                value={form.cardSetId}
                onChange={(e) => setField("cardSetId", Number(e.target.value))}
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
        </div>
      )}

      {/* ── Étape 2 : Stats ── */}
      {step === 2 && (
        <div className="manager-form">
          <p className="manager-form__title">Stats & type</p>
          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Type</label>
              <select
                className="manager-form__select"
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value as CardType;
                  setField("type", newType);
                  if (newType === CardType.SUPPORT) {
                    setForm((f) => ({ ...f, atk: 0, hp: 0, cost: 0 }));
                  }
                }}
              >
                {Object.values(CardType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">Coût</label>
              <input
                className="manager-form__input"
                type="number"
                value={form.cost}
                onChange={(e) => setField("cost", Number(e.target.value))}
              />
            </div>
          </div>

          {form.type === CardType.MONSTER && (
            <div className="manager-form__grid">
              <div className="manager-form__row">
                <label className="manager-form__label">ATK</label>
                <input
                  className="manager-form__input"
                  type="number"
                  value={form.atk}
                  onChange={(e) => setField("atk", Number(e.target.value))}
                />
              </div>
              <div className="manager-form__row">
                <label className="manager-form__label">HP</label>
                <input
                  className="manager-form__input"
                  type="number"
                  value={form.hp}
                  onChange={(e) => setField("hp", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {form.type === CardType.SUPPORT && (
            <div className="manager-form__row">
              <label className="manager-form__label">Type de Support</label>
              <select
                className="manager-form__select"
                value={form.supportType || ""}
                onChange={(e) =>
                  setField("supportType", e.target.value as SupportType)
                }
              >
                <option value="">-- Sélectionner --</option>
                {Object.values(SupportType).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Étape 3 : Image ── */}
      {step === 3 && (
        <div className="manager-form">
          <p className="manager-form__title">
            Image <span className="bm-optional">(optionnel)</span>
          </p>
          <div className="manager-form__row">
            <label className="manager-form__label">Source</label>
            <select
              className="manager-form__select"
              value={uploadMode}
              onChange={(e) => {
                setUploadMode(e.target.value as "existing" | "new");
                setSelectedImageId(null);
                setImageFile(null);
                setImageName("");
              }}
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

          {selectedImageId &&
            uploadMode === "existing" &&
            (() => {
              const img = images.find((i) => i.id === selectedImageId);
              return img ? (
                <img src={img.url} alt={img.name} className="bm-img-preview" />
              ) : null;
            })()}
          {imageFile && uploadMode === "new" && (
            <img
              src={URL.createObjectURL(imageFile)}
              alt="preview"
              className="bm-img-preview"
            />
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
            {saving ? "..." : editing ? "Modifier" : "Créer la carte"}
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
