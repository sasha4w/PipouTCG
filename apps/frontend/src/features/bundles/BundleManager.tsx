import { useEffect, useState } from "react";
import { bundleService } from "../../services/bundle.service";
import { cardService } from "../../services/card.service";
import { boosterService } from "../../services/booster.service";
import type {
  Bundle,
  BundleContent,
  BundleItem,
} from "../../services/bundle.service";
import type { Card } from "../../services/card.service";
import type { Booster } from "../../services/booster.service";
import "../../components/manager.css";

type View = "list" | "edit";

const STEPS = [{ label: "Infos" }, { label: "Contenu" }];

const emptyForm = { name: "", price: 0 };

interface ContentItemRow {
  id: string;
  type: "card" | "booster";
  itemId: number;
  quantity: number;
}

function newRow(): ContentItemRow {
  return { id: crypto.randomUUID(), type: "card", itemId: 0, quantity: 1 };
}

export default function BundleManager() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [view, setView] = useState<View>("list");
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Contenu
  const [contentBundle, setContentBundle] = useState<Bundle | null>(null);
  const [contentRows, setContentRows] = useState<ContentItemRow[]>([newRow()]);
  const [savingContent, setSavingContent] = useState(false);
  const [editingContent, setEditingContent] = useState<BundleContent | null>(
    null,
  );
  const [editQty, setEditQty] = useState(1);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = async (p = page) => {
    setLoading(true);
    try {
      const [bRes, cRes, boRes] = await Promise.all([
        bundleService.findAll(p, 10),
        cardService.findAll(1, 100),
        boosterService.findAll(1, 100),
      ]);
      setBundles(bRes.data);
      setTotal(bRes.meta.totalPages);
      setCards(cRes.data);
      setBoosters(boRes.data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setContentBundle(null);
    setContentRows([newRow()]);
    setEditingContent(null);
    setStep(1);
    setError("");
    setView("edit");
  };

  const openEdit = (b: Bundle) => {
    setEditing(b);
    setForm({ name: b.name, price: b.price });
    setContentBundle(b);
    setContentRows([newRow()]);
    setEditingContent(null);
    setStep(1);
    setError("");
    setView("edit");
  };

  const backToList = () => {
    setView("list");
    setEditing(null);
    setContentBundle(null);
    setEditingContent(null);
    setError("");
  };

  // ── CRUD Bundle ─────────────────────────────────────────────────────────────
  const handleSaveInfos = async (): Promise<Bundle | null> => {
    if (!form.name.trim()) {
      setError("Le nom est requis.");
      return null;
    }
    setSaving(true);
    try {
      let saved: Bundle;
      if (editing) {
        await bundleService.update(editing.id, form);
        saved = await bundleService.findOne(editing.id);
      } else {
        saved = await bundleService.create(form);
      }
      setContentBundle(saved);
      setEditing(saved);
      load();
      return saved;
    } catch {
      setError("Erreur lors de la sauvegarde");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce bundle ?")) return;
    try {
      await bundleService.remove(id);
      load();
    } catch {
      setError("Erreur suppression");
    }
  };

  // ── Contenu ─────────────────────────────────────────────────────────────────
  const setRow = (id: string, key: keyof ContentItemRow, val: any) =>
    setContentRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    );

  const addRow = () => setContentRows((r) => [...r, newRow()]);
  const removeRow = (id: string) =>
    setContentRows((r) => r.filter((x) => x.id !== id));

  const handleSaveContent = async () => {
    if (!contentBundle) return;
    const valid = contentRows.filter((r) => r.itemId > 0 && r.quantity >= 1);
    if (valid.length === 0) {
      setError("Ajoute au moins un item valide.");
      return;
    }
    const items: BundleItem[] = valid.map((r) => ({
      ...(r.type === "card" ? { cardId: r.itemId } : { boosterId: r.itemId }),
      quantity: r.quantity,
    }));
    setSavingContent(true);
    try {
      await bundleService.addContent(contentBundle.id, items);
      const updated = await bundleService.findOne(contentBundle.id);
      setContentBundle(updated);
      setContentRows([newRow()]);
      setError("");
      load();
    } catch {
      setError("Erreur lors de l'ajout du contenu");
    } finally {
      setSavingContent(false);
    }
  };

  const startEditContent = (c: BundleContent) => {
    setEditingContent(c);
    setEditQty(c.quantity);
  };
  const cancelEditContent = () => setEditingContent(null);

  const handleUpdateContent = async () => {
    if (!contentBundle || !editingContent) return;
    setSavingEdit(true);
    try {
      await bundleService.updateContent(
        contentBundle.id,
        editingContent.id,
        editQty,
      );
      const updated = await bundleService.findOne(contentBundle.id);
      setContentBundle(updated);
      setEditingContent(null);
      load();
    } catch {
      setError("Erreur lors de la modification");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteContent = async (contentId: number) => {
    if (!contentBundle) return;
    if (!confirm("Supprimer cet item du bundle ?")) return;
    try {
      const res = await bundleService.removeContent(
        contentBundle.id,
        contentId,
      );
      if (res.warning) setError(res.warning);
      const updated = await bundleService.findOne(contentBundle.id);
      setContentBundle(updated);
      load();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const set = (k: keyof typeof emptyForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── Wizard step actions ──────────────────────────────────────────────────────
  const goNext = async () => {
    if (step === 1) {
      const saved = await handleSaveInfos();
      if (!saved) return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const goPrev = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const isLast = step === STEPS.length;

  // ══ VUE LISTE ════════════════════════════════════════════════════════════════
  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Bundles</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouveau
          </button>
        </div>

        {error && <p className="manager-error">{error}</p>}

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : bundles.length === 0 ? (
          <p className="manager-empty">Aucun bundle.</p>
        ) : (
          <div className="manager-list">
            {bundles.map((b) => (
              <div key={b.id} className="manager-item">
                <div className="manager-item__info">
                  <div className="manager-item__name">{b.name}</div>
                  <div className="manager-item__meta">
                    {b.price} gold · {b.contents?.length ?? 0} contenus
                  </div>
                </div>
                <div className="manager-item__actions">
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
          {editing ? "Modifier" : "Nouveau"} bundle
          {contentBundle && step === 2 && (
            <span
              style={{
                fontFamily: "Comfortaa",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#a08070",
                marginLeft: 8,
              }}
            >
              — {contentBundle.name}
            </span>
          )}
        </h2>
      </div>

      {/* ── Stepper ── */}
      <div className="bm-stepper">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          // Step 2 only clickable if bundle already saved
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

      {/* ── Étape 1 : Infos ── */}
      {step === 1 && (
        <div className="manager-form">
          <p className="manager-form__title">Informations</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Nom *</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nom du bundle"
              autoFocus
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">Prix (gold)</label>
            <input
              className="manager-form__input"
              type="number"
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* ── Étape 2 : Contenu ── */}
      {step === 2 && contentBundle && (
        <>
          {/* Contenu actuel */}
          {(contentBundle.contents?.length ?? 0) > 0 && (
            <div className="manager-form">
              <p className="manager-form__title">
                Contenu actuel
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontFamily: "Comfortaa",
                    fontWeight: 600,
                    color: "#a08070",
                    marginLeft: 8,
                  }}
                >
                  ({contentBundle.contents.reduce((s, c) => s + c.quantity, 0)}{" "}
                  items total)
                </span>
              </p>
              <div className="manager-list">
                {contentBundle.contents.map((c) => (
                  <div key={c.id} className="manager-item">
                    <div className="manager-item__info">
                      <div className="manager-item__name">
                        {c.card
                          ? `🃏 ${c.card.name}`
                          : c.booster
                            ? `📦 ${c.booster.name}`
                            : "—"}
                      </div>
                      {editingContent?.id === c.id ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          <input
                            className="manager-form__input manager-content-row__qty"
                            type="number"
                            min={1}
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value))}
                            style={{ width: 64 }}
                          />
                          <button
                            className="manager-form__submit"
                            style={{
                              padding: "3px 10px",
                              fontSize: "0.72rem",
                              flex: "unset",
                            }}
                            onClick={handleUpdateContent}
                            disabled={savingEdit}
                          >
                            {savingEdit ? "..." : "OK"}
                          </button>
                          <button
                            className="manager-form__cancel"
                            style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                            onClick={cancelEditContent}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="manager-item__meta">× {c.quantity}</div>
                      )}
                    </div>
                    {editingContent?.id !== c.id && (
                      <div className="manager-item__actions">
                        <button
                          className="manager-item__edit-btn"
                          onClick={() => startEditContent(c)}
                        >
                          ✏
                        </button>
                        <button
                          className="manager-item__delete-btn"
                          onClick={() => handleDeleteContent(c.id)}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ajout nouveaux items */}
          <div className="manager-form">
            <p className="manager-form__title">Ajouter des items</p>
            {contentRows.map((row) => (
              <div key={row.id} className="manager-content-row">
                <select
                  className="manager-form__select manager-content-row__type"
                  value={row.type}
                  onChange={(e) =>
                    setRow(row.id, "type", e.target.value as "card" | "booster")
                  }
                >
                  <option value="card">Carte</option>
                  <option value="booster">Booster</option>
                </select>
                <select
                  className="manager-form__select manager-content-row__item"
                  value={row.itemId}
                  onChange={(e) =>
                    setRow(row.id, "itemId", Number(e.target.value))
                  }
                >
                  <option value={0}>-- Choisir --</option>
                  {(row.type === "card" ? cards : boosters).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  className="manager-form__input manager-content-row__qty"
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) =>
                    setRow(row.id, "quantity", Number(e.target.value))
                  }
                />
                {contentRows.length > 1 && (
                  <button
                    className="manager-content-row__remove"
                    onClick={() => removeRow(row.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="manager-form__add-row" onClick={addRow}>
              + Ajouter un item
            </button>
            <div className="manager-form__actions">
              <button
                className="manager-form__submit"
                onClick={handleSaveContent}
                disabled={savingContent}
              >
                {savingContent ? "..." : "Sauvegarder le contenu"}
              </button>
            </div>
          </div>
        </>
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
          <button className="manager-form__submit" onClick={backToList}>
            ✓ Terminer
          </button>
        ) : (
          <button
            className="manager-form__submit"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "..." : "Suivant →"}
          </button>
        )}
      </div>
    </div>
  );
}
