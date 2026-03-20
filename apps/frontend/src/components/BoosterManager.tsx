import { useEffect, useState } from "react";
import { boosterService } from "../services/booster.service";
import { cardSetService } from "../services/card-set.service";
import type { Booster, CardNumber } from "../services/booster.service";
import type { CardSet } from "../services/card-set.service";
import "./manager.css";

const CARD_NUMBERS: CardNumber[] = [1, 5, 8, 10];

const emptyForm = {
  name: "",
  cardNumber: 5 as CardNumber,
  cardSetId: 0,
  price: 100,
};

export default function BoosterManager() {
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booster | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        boosterService.findAll(p, 10),
        cardSetService.findAll(1, 100),
      ]);
      setBoosters(bRes.data);
      setTotal(bRes.meta.totalPages);
      setSets(sRes.data);
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
    setShowForm(true);
  };
  const openEdit = (b: Booster) => {
    setEditing(b);
    setForm({
      name: b.name,
      cardNumber: b.cardNumber,
      cardSetId: b.cardSet.id,
      price: b.price,
    });
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
      if (editing) await boosterService.update(editing.id, form);
      else await boosterService.create(form);
      cancel();
      load();
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce booster ?")) return;
    try {
      await boosterService.remove(id);
      load();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const set = (k: keyof typeof emptyForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">Boosters</h2>
        <button className="manager__add-btn" onClick={openCreate}>
          + Nouveau
        </button>
      </div>

      {error && <p className="manager-error">{error}</p>}

      {showForm && (
        <div className="manager-form">
          <p className="manager-form__title">
            {editing ? "Modifier" : "Nouveau"} booster
          </p>

          <div className="manager-form__row">
            <label className="manager-form__label">Nom</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nom du booster"
            />
          </div>

          <div className="manager-form__grid">
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
            <div className="manager-form__row">
              <label className="manager-form__label">Nb cartes</label>
              <select
                className="manager-form__select"
                value={form.cardNumber}
                onChange={(e) =>
                  set("cardNumber", Number(e.target.value) as CardNumber)
                }
              >
                {CARD_NUMBERS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
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
      ) : boosters.length === 0 ? (
        <p className="manager-empty">Aucun booster.</p>
      ) : (
        <div className="manager-list">
          {boosters.map((b) => (
            <div key={b.id} className="manager-item">
              <div className="manager-item__info">
                <div className="manager-item__name">{b.name}</div>
                <div className="manager-item__meta">
                  {b.cardSet.name} · {b.cardNumber} cartes · {b.price} gold
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
}
