import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLock,
} from "../../components/Icons";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { soundService } from "../../services/sound.service";
import { userService } from "../../services/user.service";
import { apiErrorMessage } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/querykeys";
import CardFilterBar from "../glossary/CardFilterBar";
import { matchesFilters, NO_FILTERS, sortCards } from "../glossary/cardCatalog";
import { paginateBySet } from "./paginateBySet";
import CardRow from "./CardRow";
import type { OwnedCard } from "./ownedCards";
import { useOwnedCards } from "./useOwnedCards";
import "./CollectionTab.css";

const PAGE_SIZE = 8;

interface Props {
  onInspect: (item: OwnedCard) => void;
}

/** Toutes les cartes du jeu, avec ce que le joueur possède et le verrou de copies. */
export default function CollectionTab({ onInspect }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { cards, isPending, isError } = useOwnedCards();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showMissing, setShowMissing] = useState(true);

  const lockMutation = useMutation({
    mutationFn: (v: { cardId: number; locked: number }) =>
      userService.setCardLock(v.cardId, v.locked),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.forgeUsable }),
      ]),
  });

  const sets = useMemo(() => {
    const bySet = new Map<
      number,
      { id: number; name: string; owned: number; total: number }
    >();
    for (const c of cards) {
      const s = c.card.cardSet;
      const entry = bySet.get(s.id) ?? {
        id: s.id,
        name: s.name,
        owned: 0,
        total: 0,
      };
      entry.total += 1;
      if (c.owned > 0) entry.owned += 1;
      bySet.set(s.id, entry);
    }
    return [...bySet.values()].sort((a, b) => a.id - b.id);
  }, [cards]);

  const withSet = useMemo(
    () => cards.map((c) => ({ ...c, setId: c.card.cardSet.id })),
    [cards],
  );

  /** Cartes du set choisi (ou de tous), avant recherche et filtres. */
  const inSet = useMemo(
    () =>
      filters.setId === null
        ? withSet
        : withSet.filter((c) => c.setId === filters.setId),
    [withSet, filters.setId],
  );

  /** Filtrées puis triées set par set, pour que la pagination garde un set par page. */
  const filtered = useMemo(() => {
    const kept = inSet.filter(
      (c) => (showMissing || c.owned > 0) && matchesFilters(c.card, filters),
    );
    const bySet = new Map<number, typeof kept>();
    for (const c of kept)
      bySet.set(c.setId, [...(bySet.get(c.setId) ?? []), c]);
    return [...bySet.entries()]
      .sort(([x], [y]) => x - y)
      .flatMap(([, group]) => sortCards(group, (c) => c.card, filters));
  }, [inSet, showMissing, filters]);

  const pages = useMemo(() => paginateBySet(filtered, PAGE_SIZE), [filtered]);
  const totalPages = pages.length;
  const current = Math.min(page, Math.max(totalPages, 1));
  const slice = pages[current - 1] ?? [];
  const setData = slice.length
    ? sets.find((s) => s.id === slice[0].setId)
    : undefined;
  const isComplete = setData ? setData.owned === setData.total : false;
  const totalOwned = inSet.filter((c) => c.owned > 0).length;

  const apply = (fn: () => void) => {
    fn();
    setPage(1);
  };

  if (isPending) return <Loading message={t("collection.loading")} />;
  if (isError)
    return <p className="collection-tab__empty">{t("collection.error")}</p>;

  return (
    <div className="collection-tab">
      <CardFilterBar
        filters={filters}
        cards={cards.map((c) => c.card)}
        onChange={(f) => apply(() => setFilters(f))}
      />

      <label className="collection-tab__toggle-missing">
        <input
          type="checkbox"
          checked={showMissing}
          onChange={(e) => apply(() => setShowMissing(e.target.checked))}
        />
        {t("collection.show_missing")}
      </label>

      <span className="collection-tab__result-count">
        {t("collection.card_count", {
          owned: totalOwned,
          count: inSet.length,
        })}
      </span>

      {slice.length === 0 ? (
        <p className="collection-tab__empty">{t("collection.no_cards")}</p>
      ) : (
        <div>
          <div className="collection-tab__set-header">
            <span className="collection-tab__set-name">
              {slice[0].card.cardSet.name}
            </span>
            {setData && (
              <span
                className={`collection-tab__set-count${isComplete ? " collection-tab__set-count--complete" : ""}`}
              >
                {setData.owned} / {setData.total}
              </span>
            )}
          </div>
          <ul className="collection-tab__list">
            {slice.map((item) => {
              const rarity = t(`rarity.${item.card.rarity.toLowerCase()}`);
              return (
                <li key={item.card.id}>
                  <CardRow
                    item={item}
                    disabled={item.owned === 0}
                    meta={
                      item.owned > 0
                        ? `×${item.owned} · ${rarity}`
                        : `${t("collection.not_owned")} · ${rarity}`
                    }
                    onInspect={() => onInspect(item)}
                  >
                    {item.owned > 0 && (
                      <div className="collection-tab__lock">
                        <IconLock size={14} />
                        <select
                          className="collection-tab__lock-select"
                          aria-label={t("collection.lock_label", {
                            name: item.card.name,
                          })}
                          value={item.locked}
                          disabled={lockMutation.isPending}
                          onChange={(e) =>
                            lockMutation.mutate({
                              cardId: item.card.id,
                              locked: Number(e.target.value),
                            })
                          }
                        >
                          {Array.from({ length: item.owned + 1 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        {item.locked > 0 && (
                          <span className="collection-tab__lock-text">
                            {t("collection.locked_count", {
                              count: item.locked,
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </CardRow>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {lockMutation.isError && (
        <p className="collection-tab__empty" role="alert">
          {apiErrorMessage(lockMutation.error) ?? t("collection.lock_error")}
        </p>
      )}

      {totalPages > 1 && (
        <div className="collection-tab__pagination">
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.prev")}
            disabled={current <= 1}
            onClick={() => {
              soundService.play("select");
              setPage(current - 1);
            }}
          >
            <IconArrowLeft size={16} />
          </Button>
          <span className="collection-tab__pagination-info">
            {current} / {totalPages}
          </span>
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.next")}
            disabled={current >= totalPages}
            onClick={() => {
              soundService.play("select");
              setPage(current + 1);
            }}
          >
            <IconArrowRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
