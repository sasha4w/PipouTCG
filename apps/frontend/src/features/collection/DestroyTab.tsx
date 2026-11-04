import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DUST_VALUE, Rarity } from "@pipou/shared";
import Button from "../../components/Button";
import { IconDust, IconTrash } from "../../components/Icons";
import Loading from "../../components/Loading";
import { forgeService } from "../../services/forge.service";
import { apiErrorMessage } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/querykeys";
import { useInvalidateAfterForge } from "../forge/useForge";
import CardFilterBar from "../glossary/CardFilterBar";
import {
  matchesFilters,
  NO_FILTERS,
  RARITIES,
  sortCards,
} from "../glossary/cardCatalog";
import CardRow from "./CardRow";
import DestroyConfirm from "./DestroyConfirm";
import {
  DEFAULT_QUICK_DESTROY,
  quickDestroyPlan,
  type DestroyLine,
  type OwnedCard,
} from "./ownedCards";
import { useOwnedCards } from "./useOwnedCards";
import "./CollectionTab.css";
import "./DestroyTab.css";

const PAGE = 60;
const KEEP_OPTIONS = [1, 2, 3] as const;
const asCard = (o: OwnedCard) => o.card;

type Confirming = { kind: "quick" } | { kind: "card"; cardId: number };

interface Props {
  onInspect: (item: OwnedCard) => void;
}

/** Destruction rapide des doublons, ou carte par carte, toujours après confirmation. */
export default function DestroyTab({ onInspect }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAfterForge();
  const { cards, isPending, isError } = useOwnedCards();

  const [keep, setKeep] = useState<1 | 2 | 3>(DEFAULT_QUICK_DESTROY.keep);
  const [rarities, setRarities] = useState<Rarity[]>(
    DEFAULT_QUICK_DESTROY.rarities,
  );
  const [setId, setSetId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [done, setDone] = useState<{ count: number; dust: number } | null>(
    null,
  );
  const [filters, setFilters] = useState(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);

  const sets = useMemo(() => {
    const byId = new Map<number, string>();
    for (const c of cards)
      if (c.card.cardSet) byId.set(c.card.cardSet.id, c.card.cardSet.name);
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id);
  }, [cards]);

  const plan = useMemo(
    () => quickDestroyPlan(cards, { keep, rarities, setId }),
    [cards, keep, rarities, setId],
  );
  const planCopies = plan.reduce((sum, l) => sum + l.quantity, 0);
  const planDust = plan.reduce((sum, l) => sum + l.dust, 0);

  const owned = useMemo(() => cards.filter((c) => c.owned > 0), [cards]);
  const list = useMemo(
    () =>
      sortCards(
        owned.filter((o) => matchesFilters(o.card, filters)),
        asCard,
        filters,
      ),
    [owned, filters],
  );

  /** Lignes de la confirmation, recalculées à chaque rendu : un aperçu rafraîchi reste juste. */
  const confirmLines = useMemo((): DestroyLine[] => {
    if (!confirming) return [];
    if (confirming.kind === "quick") return plan;
    const item = cards.find((c) => c.card.id === confirming.cardId);
    const quantity = item
      ? Math.min(selection[confirming.cardId] ?? 0, item.usable)
      : 0;
    return item && quantity > 0
      ? [
          {
            card: item.card,
            quantity,
            dust: quantity * DUST_VALUE[item.card.rarity],
          },
        ]
      : [];
  }, [confirming, plan, cards, selection]);

  const mutation = useMutation({
    mutationFn: async (v: {
      kind: Confirming["kind"];
      lines: DestroyLine[];
    }) => {
      const items = v.lines.map((l) => ({
        cardId: l.card.id,
        quantity: l.quantity,
      }));
      return v.kind === "quick"
        ? forgeService.destroyBatch({ items })
        : forgeService.destroy(items[0]);
    },
    onSuccess: async (res, v) => {
      await invalidate();
      setDone({
        count: v.lines.reduce((sum, l) => sum + l.quantity, 0),
        dust: res.dustGained,
      });
      setSelection((prev) => {
        const copy = { ...prev };
        for (const l of v.lines) delete copy[l.card.id];
        return copy;
      });
      setConfirming(null);
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.forgeUsable }),
  });

  const open = (next: Confirming) => {
    mutation.reset();
    setDone(null);
    setConfirming(next);
  };
  const close = () => {
    mutation.reset();
    setConfirming(null);
  };

  const toggleRarity = (r: Rarity) =>
    setRarities((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const change = (item: OwnedCard, delta: number) =>
    setSelection((prev) => {
      const id = item.card.id;
      const next = Math.min(item.usable, Math.max(0, (prev[id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  if (isPending) return <Loading message={t("collection.loading")} />;
  if (isError)
    return <p className="collection-tab__empty">{t("collection.error")}</p>;

  return (
    <div className="destroy-tab">
      <section className="destroy-tab__quick">
        <h3 className="destroy-tab__title">
          {t("collection.destroy_quick_title")}
        </h3>

        <fieldset className="destroy-tab__group">
          <legend>{t("collection.destroy_keep")}</legend>
          <div className="destroy-tab__options">
            {KEEP_OPTIONS.map((n) => (
              <label key={n} className="destroy-tab__option">
                <input
                  type="radio"
                  name="destroy-keep"
                  aria-label={t("collection.destroy_keep_option", { count: n })}
                  checked={keep === n}
                  onChange={() => setKeep(n)}
                />
                {t("collection.destroy_keep_option", { count: n })}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="destroy-tab__group">
          <legend>{t("collection.destroy_rarities")}</legend>
          <div className="destroy-tab__options">
            {RARITIES.map((r) => (
              <label key={r} className="destroy-tab__option">
                <input
                  type="checkbox"
                  checked={rarities.includes(r)}
                  onChange={() => toggleRarity(r)}
                />
                {t(`rarity.${r.toLowerCase()}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <select
          className="destroy-tab__select"
          aria-label={t("collection.all_sets")}
          value={setId ?? "all"}
          onChange={(e) =>
            setSetId(e.target.value === "all" ? null : Number(e.target.value))
          }
        >
          <option value="all">{t("collection.all_sets")}</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <p className="destroy-tab__summary">
          <IconDust size={16} color="currentColor" />
          {planCopies > 0
            ? t("collection.destroy_summary", {
                count: planCopies,
                dust: planDust,
              })
            : t("collection.destroy_nothing")}
        </p>
        <Button
          variant="danger"
          fullWidth
          disabled={plan.length === 0}
          onClick={() => open({ kind: "quick" })}
        >
          {t("collection.destroy_review")}
        </Button>
      </section>

      {done && (
        <p className="destroy-tab__success" role="status">
          {t("collection.destroy_success", {
            count: done.count,
            dust: done.dust,
          })}
        </p>
      )}

      <section className="destroy-tab__manual">
        <h3 className="destroy-tab__title">
          {t("collection.destroy_manual_title")}
        </h3>
        <CardFilterBar
          filters={filters}
          cards={owned.map(asCard)}
          onChange={(f) => {
            setFilters(f);
            setLimit(PAGE);
          }}
        />
        {list.length === 0 ? (
          <p className="collection-tab__empty">
            {t("collection.destroy_no_cards")}
          </p>
        ) : (
          <ul className="collection-tab__list">
            {list.slice(0, limit).map((item) => {
              const picked = Math.min(
                selection[item.card.id] ?? 0,
                item.usable,
              );
              const greyed = item.usable === 0;
              const rarity = t(`rarity.${item.card.rarity.toLowerCase()}`);
              return (
                <li key={item.card.id}>
                  <CardRow
                    item={item}
                    disabled={greyed}
                    selected={picked > 0}
                    meta={
                      <>
                        {`×${item.owned} · ${rarity}`} ·{" "}
                        {greyed
                          ? item.locked >= item.owned
                            ? t("collection.forge_locked")
                            : t("collection.forge_in_deck")
                          : t("collection.forge_usable", {
                              count: item.usable,
                            })}
                      </>
                    }
                    onInspect={() => onInspect(item)}
                  >
                    <div className="destroy-tab__row-actions">
                      <span className="destroy-tab__stepper">
                        <Button
                          size="icon"
                          variant="ghost-bordeaux"
                          aria-label={t("collection.destroy_remove", {
                            name: item.card.name,
                          })}
                          disabled={picked === 0}
                          onClick={() => change(item, -1)}
                        >
                          -
                        </Button>
                        <span className="destroy-tab__qty">{picked}</span>
                        <Button
                          size="icon"
                          variant="ghost-bordeaux"
                          aria-label={t("collection.destroy_add", {
                            name: item.card.name,
                          })}
                          disabled={picked >= item.usable}
                          onClick={() => change(item, 1)}
                        >
                          +
                        </Button>
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={t("collection.destroy_card", {
                          name: item.card.name,
                        })}
                        disabled={picked === 0}
                        onClick={() =>
                          open({ kind: "card", cardId: item.card.id })
                        }
                      >
                        <IconTrash size={14} color="currentColor" />
                      </Button>
                    </div>
                  </CardRow>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > limit && (
          <Button
            variant="ghost-bordeaux"
            fullWidth
            onClick={() => setLimit(limit + PAGE)}
          >
            {t("collection.forge_more")}
          </Button>
        )}
      </section>

      {confirming && (
        <DestroyConfirm
          lines={confirmLines}
          pending={mutation.isPending}
          error={
            mutation.isError
              ? (apiErrorMessage(mutation.error) ??
                t("collection.destroy_error"))
              : null
          }
          onConfirm={() =>
            mutation.mutate({ kind: confirming.kind, lines: confirmLines })
          }
          onCancel={close}
        />
      )}
    </div>
  );
}
