import { useEffect, useState } from "react";
import { cardSetService } from "../services/card-set.service";
import type { CardSet } from "../services/card-set.service";
import "./manager.css";

export default function CardSetManager() {
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CardSet | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await cardSetService.findAll(p, 10);
      setSets(res.data);
      setTotal(res.meta.totalPages);
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
    setName("");
    setShowForm(true);
  };
  const openEdit = (s: CardSet) => {
    setEditing(s);
    setName(s.name);
    setShowForm(true);
  };
  const cancel = () => {
    setShowForm(false);
    setEditing(null);
    setName("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) await cardSetService.update(editing.id, name);
      else await cardSetService.create(name);
      cancel();
      load();
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce set ?")) return;
    try {
      await cardSetService.remove(id);
      load();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">Card Sets</h2>
        <button className="manager__add-btn" onClick={openCreate}>
          + Nouveau
        </button>
      </div>

      {error && <p className="manager-error">{error}</p>}

      {showForm && (
        <div className="manager-form">
          <p className="manager-form__title">
            {editing ? "Modifier" : "Nouveau"} card set
          </p>
          <div className="manager-form__row">
            <label className="manager-form__label">Nom</label>
            <input
              className="manager-form__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du set"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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
      ) : sets.length === 0 ? (
        <p className="manager-empty">Aucun card set.</p>
      ) : (
        <div className="manager-list">
          {sets.map((s) => (
            <div key={s.id} className="manager-item">
              <div className="manager-item__info">
                <div className="manager-item__name">{s.name}</div>
                <div className="manager-item__meta">#{s.id}</div>
              </div>
              <div className="manager-item__actions">
                <button
                  className="manager-item__edit-btn"
                  onClick={() => openEdit(s)}
                >
                  ✏
                </button>
                <button
                  className="manager-item__delete-btn"
                  onClick={() => handleDelete(s.id)}
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
