import { useEffect, useState } from "react";
import {
  questService,
  type Quest,
  type CreateQuestData,
  QuestResetType,
  RewardType,
  ConditionType,
  ConditionOperator,
} from "../../services/quest.service";
import "../../components/manager.css";
import "./QuestManager.css";

// ── Labels ────────────────────────────────────────────────────────────────────
const RESET_LABELS: Record<QuestResetType, string> = {
  NONE: "Achievement",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  EVENT: "Événement",
};

const REWARD_ICONS: Record<RewardType, string> = {
  GOLD: "🪙",
  BOOSTER: "📦",
  BUNDLE: "🎁",
};

const CONDITION_LABELS: Record<ConditionType, string> = {
  OPEN_BOOSTER: "Ouvrir booster",
  BUY_CARD: "Acheter carte",
  SELL_CARD: "Vendre carte",
  BUY_BOOSTER: "Acheter booster",
  SELL_BOOSTER: "Vendre booster",
  OWN_CARD: "Posséder carte",
  COMPLETE_SET: "Compléter set",
  REACH_LEVEL: "Atteindre niveau",
  WIN_FIGHT: "Gagner combat",
};

const STEPS = [
  { label: "Général" },
  { label: "Conditions" },
  { label: "Récompense" },
];

// ── Empty form ────────────────────────────────────────────────────────────────
function emptyForm(): CreateQuestData {
  return {
    title: "",
    description: "",
    resetType: QuestResetType.DAILY,
    resetHour: 4,
    conditionGroup: {
      operator: ConditionOperator.AND,
      conditions: [{ type: ConditionType.OPEN_BOOSTER, amount: 1 }],
    },
    rewardType: RewardType.GOLD,
    rewardAmount: 100,
    isActive: true,
  };
}

type View = "list" | "form";

// ── Composant ─────────────────────────────────────────────────────────────────
export default function QuestManager() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [form, setForm] = useState<CreateQuestData>(emptyForm());
  const [saving, setSaving] = useState(false);

  // ── Chargement ────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const data = await questService.findAll();
      setQuests(data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setStep(1);
    setError("");
    setView("form");
  };

  const openEdit = (q: Quest) => {
    setEditing(q);
    setForm({
      title: q.title,
      description: q.description ?? "",
      resetType: q.resetType,
      resetHour: q.resetHour,
      resetDayOfWeek: q.resetDayOfWeek,
      endDate: q.endDate ?? undefined,
      conditionGroup: q.conditionGroup,
      rewardType: q.rewardType,
      rewardAmount: q.rewardAmount,
      rewardItemId: q.rewardItemId,
      isActive: q.isActive,
    });
    setStep(1);
    setError("");
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setEditing(null);
    setError("");
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) await questService.update(editing.id, form);
      else await questService.create(form);
      backToList();
      load();
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette quête ?")) return;
    try {
      await questService.remove(id);
      load();
    } catch {
      setError("Erreur suppression");
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await questService.toggleActive(id);
      load();
    } catch {
      setError("Erreur");
    }
  };

  // ── Helpers form ──────────────────────────────────────────────────────────
  const setF = (k: keyof CreateQuestData, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addCondition = () =>
    setForm((f) => ({
      ...f,
      conditionGroup: {
        ...f.conditionGroup,
        conditions: [
          ...f.conditionGroup.conditions,
          { type: ConditionType.OPEN_BOOSTER, amount: 1 },
        ],
      },
    }));

  const updateCondition = (i: number, key: string, val: any) =>
    setForm((f) => ({
      ...f,
      conditionGroup: {
        ...f.conditionGroup,
        conditions: f.conditionGroup.conditions.map((c, idx) =>
          idx === i ? { ...c, [key]: val } : c,
        ),
      },
    }));

  const removeCondition = (i: number) =>
    setForm((f) => ({
      ...f,
      conditionGroup: {
        ...f.conditionGroup,
        conditions: f.conditionGroup.conditions.filter((_, idx) => idx !== i),
      },
    }));

  // ── Validation par étape ──────────────────────────────────────────────────
  const validateStep = (s: number): string | null => {
    if (s === 1 && !form.title.trim()) return "Le titre est requis.";
    if (s === 2 && form.conditionGroup.conditions.length === 0)
      return "Ajoutez au moins une condition.";
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

  const isLast = step === STEPS.length;

  // ══ VUE LISTE ══════════════════════════════════════════════════════════════
  if (view === "list")
    return (
      <div className="manager">
        <div className="manager__header">
          <h2 className="manager__title">Quêtes</h2>
          <button className="manager__add-btn" onClick={openCreate}>
            + Nouvelle
          </button>
        </div>

        {error && <p className="manager-error">{error}</p>}

        {loading ? (
          <p className="manager-empty">Chargement...</p>
        ) : quests.length === 0 ? (
          <p className="manager-empty">Aucune quête.</p>
        ) : (
          <div className="manager-list">
            {quests.map((q) => (
              <div key={q.id} className="manager-item">
                <div className="manager-item__info">
                  <div className="manager-item__name">{q.title}</div>
                  <div className="quest-item-badges">
                    <span
                      className={`quest-reset-badge quest-reset-badge--${q.resetType}`}
                    >
                      {RESET_LABELS[q.resetType]}
                    </span>
                    <span className="quest-reward-badge">
                      {REWARD_ICONS[q.rewardType]} {q.rewardAmount}
                    </span>
                    <span
                      className={`quest-active-badge quest-active-badge--${q.isActive ? "on" : "off"}`}
                    >
                      {q.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
                <div className="manager-item__actions">
                  <button
                    className="manager-item__content-btn"
                    onClick={() => handleToggle(q.id)}
                    title={q.isActive ? "Désactiver" : "Activer"}
                  >
                    {q.isActive ? "⏸" : "▶"}
                  </button>
                  <button
                    className="manager-item__edit-btn"
                    onClick={() => openEdit(q)}
                  >
                    ✏
                  </button>
                  <button
                    className="manager-item__delete-btn"
                    onClick={() => handleDelete(q.id)}
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
  return (
    <div className="manager">
      <div className="manager__header">
        <button className="manager-form__cancel" onClick={backToList}>
          ← Retour
        </button>
        <h2 className="manager__title">
          {editing ? "Modifier" : "Nouvelle"} quête
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
              onChange={(e) => setF("title", e.target.value)}
              placeholder="Titre de la quête"
              autoFocus
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label">Description</label>
            <textarea
              className="manager-form__textarea"
              value={form.description}
              onChange={(e) => setF("description", e.target.value)}
              placeholder="Description (optionnel)"
            />
          </div>

          <div className="quest-form-section">
            <p className="quest-form-section__title">Réinitialisation</p>
            <div className="manager-form__grid">
              <div className="manager-form__row">
                <label className="manager-form__label">Type</label>
                <select
                  className="manager-form__select"
                  value={form.resetType}
                  onChange={(e) =>
                    setF("resetType", e.target.value as QuestResetType)
                  }
                >
                  {Object.values(QuestResetType).map((r) => (
                    <option key={r} value={r}>
                      {RESET_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="manager-form__row">
                <label className="manager-form__label">Heure reset</label>
                <input
                  className="manager-form__input"
                  type="number"
                  min={0}
                  max={23}
                  value={form.resetHour ?? 4}
                  onChange={(e) => setF("resetHour", Number(e.target.value))}
                />
              </div>
            </div>
            {form.resetType === QuestResetType.WEEKLY && (
              <div className="manager-form__row">
                <label className="manager-form__label">
                  Jour (0=Dim ... 6=Sam)
                </label>
                <input
                  className="manager-form__input"
                  type="number"
                  min={0}
                  max={6}
                  value={form.resetDayOfWeek ?? 1}
                  onChange={(e) =>
                    setF("resetDayOfWeek", Number(e.target.value))
                  }
                />
              </div>
            )}
            {form.resetType === QuestResetType.EVENT && (
              <div className="manager-form__row">
                <label className="manager-form__label">Date de fin</label>
                <input
                  className="manager-form__input"
                  type="datetime-local"
                  value={form.endDate ?? ""}
                  onChange={(e) => setF("endDate", e.target.value)}
                />
              </div>
            )}
          </div>

          <div
            className="manager-form__row"
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive ?? true}
              onChange={(e) => setF("isActive", e.target.checked)}
              style={{ accentColor: "#7a1c3b", width: 16, height: 16 }}
            />
            <label
              htmlFor="isActive"
              className="manager-form__label"
              style={{ textTransform: "none", margin: 0, cursor: "pointer" }}
            >
              Quête active
            </label>
          </div>
        </div>
      )}

      {/* ── Étape 2 : Conditions ── */}
      {step === 2 && (
        <div className="manager-form">
          <p className="manager-form__title">Conditions</p>
          <div className="manager-form__row">
            <label className="manager-form__label">Opérateur</label>
            <select
              className="manager-form__select"
              value={form.conditionGroup.operator}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  conditionGroup: {
                    ...f.conditionGroup,
                    operator: e.target.value as ConditionOperator,
                  },
                }))
              }
            >
              <option value="AND">Toutes (AND)</option>
              <option value="OR">Au moins une (OR)</option>
            </select>
          </div>

          {form.conditionGroup.conditions.map((cond, i) => (
            <div key={i} className="quest-condition-row">
              <select
                className="manager-form__select quest-condition-row__type"
                value={cond.type}
                onChange={(e) => updateCondition(i, "type", e.target.value)}
              >
                {Object.values(ConditionType).map((t) => (
                  <option key={t} value={t}>
                    {CONDITION_LABELS[t]}
                  </option>
                ))}
              </select>
              <input
                className="manager-form__input quest-condition-row__amount"
                type="number"
                min={1}
                value={cond.amount ?? 1}
                onChange={(e) =>
                  updateCondition(i, "amount", Number(e.target.value))
                }
                placeholder="Qté"
              />
              {form.conditionGroup.conditions.length > 1 && (
                <button
                  className="quest-condition-row__remove"
                  onClick={() => removeCondition(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button className="manager-form__add-row" onClick={addCondition}>
            + Ajouter une condition
          </button>
        </div>
      )}

      {/* ── Étape 3 : Récompense ── */}
      {step === 3 && (
        <div className="manager-form">
          <p className="manager-form__title">Récompense</p>
          <div className="manager-form__grid">
            <div className="manager-form__row">
              <label className="manager-form__label">Type</label>
              <select
                className="manager-form__select"
                value={form.rewardType}
                onChange={(e) =>
                  setF("rewardType", e.target.value as RewardType)
                }
              >
                {Object.values(RewardType).map((r) => (
                  <option key={r} value={r}>
                    {REWARD_ICONS[r]} {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="manager-form__row">
              <label className="manager-form__label">Quantité</label>
              <input
                className="manager-form__input"
                type="number"
                min={0}
                value={form.rewardAmount}
                onChange={(e) => setF("rewardAmount", Number(e.target.value))}
              />
            </div>
          </div>
          {(form.rewardType === RewardType.BOOSTER ||
            form.rewardType === RewardType.BUNDLE) && (
            <div className="manager-form__row">
              <label className="manager-form__label">ID Booster / Bundle</label>
              <input
                className="manager-form__input"
                type="number"
                min={1}
                value={form.rewardItemId ?? ""}
                onChange={(e) => setF("rewardItemId", Number(e.target.value))}
                placeholder="ID de l'item"
              />
            </div>
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
            {saving ? "..." : editing ? "Modifier" : "Créer la quête"}
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
