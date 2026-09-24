import { useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { boosterService } from "../../services/booster.service";
import { cardSetService } from "../../services/card-set.service";
import type { Booster, CardNumber } from "../../services/booster.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import "../../components/manager.css";

const CARD_NUMBERS: CardNumber[] = [1, 5, 8, 10];

const STEPS = [{ label: "Général" }, { label: "Config" }];

const emptyForm = {
  name: "",
  cardNumber: 5 as CardNumber,
  cardSetId: 0,
  price: 100,
};

type View = "list" | "edit";

export default function BoosterManager() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("list");
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState<Booster | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const boostersQuery = useQuery({
    queryKey: QUERY_KEYS.admin.boosters(page),
    queryFn: () => boosterService.findAll(page, 10),
    placeholderData: keepPreviousData,
  });
  const setsQuery = useQuery({
    queryKey: QUERY_KEYS.cardSetOptions,
    queryFn: () => cardSetService.findAll(1, 100),
  });
  const boosters = boostersQuery.data?.data ?? [];
  const total = boostersQuery.data?.meta.totalPages ?? 0;
  const sets = setsQuery.data?.data ?? [];
  const loading = boostersQuery.isPending;
  const loadError =
    boostersQuery.isError || setsQuery.isError ? "Erreur de chargement" : "";

  const refreshList = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "boosters"] }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.boosterOptions }),
    ]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setStep(1);
    setError("");
    setView("edit");
  };
  const openEdit = (b: Booster) => {
    setEditing(b);
    setForm({
      name: b.name,
      cardNumber: b.cardNumber,
      cardSetId: b.cardSet.id,
      price: b.price,
    });
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
    if (s === 1 && !form.name.trim()) return "Le nom est requis.";
    if (s === 2 && !form.cardSetId) return "Veuillez sélectionner un Card Set.";
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
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      if (editing) await boosterService.update(editing.id, form);
      else await boosterService.create(form);
      backToList();
      await refreshList();
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
      await refreshList();
    } catch {
      setError("Erreur lors de la suppression");
    }
  };

  const set = <K extends keyof typeof emptyForm>(
    k: K,
    v: (typeof emptyForm)[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const isLast = step === STEPS.length;

  // ══ VUE LISTE ════════════════════════════════════════════════════════════════
  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Boosters</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouveau
          </button>
        </div>

        {(error || loadError) && (
          <p className="manager-error">{error || loadError}</p>
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

  // ══ VUE WIZARD ═══════════════════════════════════════════════════════════════
  return (
    <div className="manager">
      <div className="manager__header">
        <button className="manager-form__cancel" onClick={backToList}>
          ← Retour
        </button>
        <h2 className="manager__title">
          {editing ? "Modifier" : "Nouveau"} booster
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
            <label className="manager-form__label">Nom *</label>
            <input
              className="manager-form__input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nom du booster"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* ── Étape 2 : Config ── */}
      {step === 2 && (
        <div className="manager-form">
          <p className="manager-form__title">Configuration</p>
          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Card Set *</label>
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
            {saving ? "..." : editing ? "Modifier" : "Créer le booster"}
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
