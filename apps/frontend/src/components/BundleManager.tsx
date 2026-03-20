import { useEffect, useState } from "react";
import { bundleService } from "../services/bundle.service";
import type { Bundle } from "../services/bundle.service";
import "./manager.css";

const emptyForm = { name: "", price: 0 };

export default function BundleManager() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await bundleService.findAll(p, 10);
      setBundles(res.data);
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
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (b: Bundle) => {
    setEditing(b);
    setForm({ name: b.name, price: b.price });
    setShowForm(true);
  };
  const cancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await bundleService.update(editing.id, form);
      else await bundleService.create(form);
      cancel();
      load();
    } catch {
      setError("Erreur lors de la sauvegarde");
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
      setError("Erreur lors de la suppression");
    }
  };

  const set = (k: keyof typeof emptyForm, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">Bundles</h2>
        <button className="manager__add-btn" onClick={openCreate}>
          + Nouveau
        </button>
      </div>

      {error && <p className="manager-error">{error}</p>}

      {showForm && (
        <div className="manager-form">
          <p className="manager-form__title">
            {editing ? "Modifier" : "Nouveau"} bundle
          </p>

          <div className="manager-form__row">
            <label className="manager-form__label">Nom</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nom du bundle"
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
}
