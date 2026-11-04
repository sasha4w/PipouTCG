import { useMemo, useState } from "react";
import { useIsFetching, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FORGE_COST, Rarity } from "@pipou/shared";
import Button from "../../components/Button";
import { IconForge, IconLock } from "../../components/Icons";
import Loading from "../../components/Loading";
import { forgeService } from "../../services/forge.service";
import { apiErrorMessage } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/querykeys";
import {
  canSubmitForge,
  selectionTotal,
  type ForgeSelection,
} from "../forge/forgeSelection";
import { useInvalidateAfterForge } from "../forge/useForge";
import CardFilterBar from "../glossary/CardFilterBar";
import { matchesFilters, NO_FILTERS, sortCards } from "../glossary/cardCatalog";
import CardRow from "./CardRow";
import {
  forgeInputs,
  forgeTargets,
  refillForgeSelection,
  type OwnedCard,
} from "./ownedCards";
import { useOwnedCards } from "./useOwnedCards";
import "../profile/OwnCardList.css";
import "./CollectionTab.css";
import "./ForgeTab.css";

const PAGE = 60;
const DEFAULT_COST = FORGE_COST[Rarity.COMMON] ?? 10;
const asCard = (o: OwnedCard) => o.card;

interface Props {
  onInspect: (item: OwnedCard) => void;
}

/** Forge en deux étapes : choisir les copies à donner, puis la carte à obtenir. */
export default function ForgeTab({ onInspect }: Props) {
  const { t } = useTranslation();
  const { cards, isPending, isError } = useOwnedCards();
  const invalidate = useInvalidateAfterForge();
  const refreshing =
    useIsFetching({ queryKey: QUERY_KEYS.forgeUsable }) +
      useIsFetching({ queryKey: QUERY_KEYS.collection }) >
    0;

  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<ForgeSelection>({});
  const [pickedId, setTargetId] = useState<number | null>(null);
  const [forged, setForged] = useState<{ name: string } | null>(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);

  const total = selectionTotal(selection);
  const first = cards.find((c) => (selection[c.card.id] ?? 0) > 0);
  const lockSetId = first?.card.cardSet?.id;
  const lockRarity = first?.card.rarity;
  const lock = useMemo(
    () =>
      lockSetId !== undefined && lockRarity !== undefined
        ? { setId: lockSetId, rarity: lockRarity }
        : null,
    [lockSetId, lockRarity],
  );
  const cost = lock ? (FORGE_COST[lock.rarity] ?? DEFAULT_COST) : DEFAULT_COST;

  const allInputs = useMemo(() => forgeInputs(cards, null), [cards]);
  const inputs = useMemo(
    () =>
      sortCards(
        forgeInputs(cards, lock).filter((o) => matchesFilters(o.card, filters)),
        asCard,
        filters,
      ),
    [cards, lock, filters],
  );
  const targets = useMemo(
    () => (lock ? forgeTargets(cards, lock.setId, lock.rarity) : []),
    [cards, lock],
  );

  /** La cible n'est valable que pour le set et la rareté courants. */
  const targetId = targets.some((x) => x.card.id === pickedId)
    ? pickedId
    : null;

  const mutation = useMutation({
    mutationFn: (v: { selection: ForgeSelection; targetId: number }) =>
      forgeService.forge({
        inputs: Object.entries(v.selection)
          .filter(([, quantity]) => quantity > 0)
          .map(([cardId, quantity]) => ({ cardId: Number(cardId), quantity })),
        targetCardId: v.targetId,
      }),
    onSuccess: async (_res, v) => {
      await invalidate();
      setForged({
        name:
          cards.find((c) => c.card.id === v.targetId)?.card.name ??
          `#${v.targetId}`,
      });
    },
  });

  const change = (item: OwnedCard, delta: number) => {
    if (delta < 0 && total + delta === 0) setLimit(PAGE);
    setSelection((prev) => {
      const id = item.card.id;
      const next = Math.min(item.usable, Math.max(0, (prev[id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const reset = () => {
    setLimit(PAGE);
    setSelection({});
    setTargetId(null);
    setForged(null);
    mutation.reset();
  };

  const reforge = () => {
    if (targetId === null) return;
    const result = refillForgeSelection(selection, cards, cost, targetId);
    setSelection(result.selection);
    setForged(null);
    mutation.reset();
    if (!result.complete) setStep(1);
  };

  const back = () => {
    if (forged) reset();
    setStep(1);
  };

  if (isPending) return <Loading message={t("collection.loading")} />;
  if (isError)
    return <p className="own-cardlist__empty">{t("collection.error")}</p>;

  const meta = (item: OwnedCard) => {
    const rarity = t(`rarity.${item.card.rarity.toLowerCase()}`);
    return item.owned > 0
      ? `×${item.owned} · ${rarity}`
      : `${t("collection.forge_not_owned")} · ${rarity}`;
  };

  const readOnlyLock = (item: OwnedCard) =>
    item.locked > 0 && (
      <span className="forge-tab__lock">
        <IconLock size={12} />
        {t("collection.locked_count", { count: item.locked })}
      </span>
    );

  const counter = (
    <span
      className={`forge-tab__counter${total === cost ? " forge-tab__counter--full" : ""}`}
    >
      {t("collection.forge_counter", { n: total, cost })}
    </span>
  );

  return (
    <div className="forge-tab">
      <div className="forge-tab__steps" aria-hidden="true">
        <span className={step === 1 ? "forge-tab__step--on" : undefined}>
          {t("collection.forge_step1")}
        </span>
        <span className={step === 2 ? "forge-tab__step--on" : undefined}>
          {t("collection.forge_step2")}
        </span>
      </div>

      {step === 1 && (
        <>
          <CardFilterBar
            filters={filters}
            cards={allInputs.map(asCard)}
            onChange={(f) => {
              setFilters(f);
              setLimit(PAGE);
            }}
          />
          {inputs.length === 0 ? (
            <p className="own-cardlist__empty">
              {t("collection.forge_no_inputs")}
            </p>
          ) : (
            <ul className="collection-tab__list">
              {inputs.slice(0, limit).map((item) => {
                const picked = selection[item.card.id] ?? 0;
                const greyed = item.usable === 0;
                const canAdd = picked < item.usable && total < cost;
                return (
                  <li key={item.card.id}>
                    <CardRow
                      item={item}
                      disabled={greyed}
                      selected={picked > 0}
                      meta={
                        <>
                          {meta(item)} ·{" "}
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
                      {readOnlyLock(item)}
                      <span className="forge-tab__stepper">
                        <Button
                          size="icon"
                          variant="ghost-bordeaux"
                          aria-label={t("collection.forge_remove", {
                            name: item.card.name,
                          })}
                          disabled={picked === 0}
                          onClick={() => change(item, -1)}
                        >
                          -
                        </Button>
                        <span className="forge-tab__qty">{picked}</span>
                        <Button
                          size="icon"
                          variant="ghost-bordeaux"
                          aria-label={t("collection.forge_add", {
                            name: item.card.name,
                          })}
                          disabled={greyed || !canAdd}
                          onClick={() => change(item, 1)}
                        >
                          +
                        </Button>
                      </span>
                    </CardRow>
                  </li>
                );
              })}
            </ul>
          )}
          {inputs.length > limit && (
            <Button
              variant="ghost-bordeaux"
              fullWidth
              onClick={() => setLimit(limit + PAGE)}
            >
              {t("collection.forge_more")}
            </Button>
          )}
          <div className="forge-tab__bar">
            {counter}
            <Button
              variant="ghost-bordeaux"
              disabled={total === 0}
              onClick={reset}
            >
              {t("collection.forge_reset")}
            </Button>
            <Button
              disabled={!canSubmitForge(selection, cost)}
              onClick={() => setStep(2)}
            >
              {t("collection.forge_next")}
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {targets.length === 0 ? (
            <p className="own-cardlist__empty">
              {t("collection.forge_no_target")}
            </p>
          ) : (
            <ul className="collection-tab__list">
              {targets.map((item) => (
                <li key={item.card.id}>
                  <CardRow
                    item={item}
                    selected={targetId === item.card.id}
                    meta={meta(item)}
                    onInspect={() => onInspect(item)}
                  >
                    <label className="forge-tab__pick">
                      <input
                        type="radio"
                        name="forge-target"
                        aria-label={t("collection.forge_pick_target", {
                          name: item.card.name,
                        })}
                        checked={targetId === item.card.id}
                        disabled={mutation.isPending || forged !== null}
                        onChange={() => setTargetId(item.card.id)}
                      />
                    </label>
                  </CardRow>
                </li>
              ))}
            </ul>
          )}

          {forged && (
            <p className="forge-tab__success" role="status">
              {t("collection.forge_success", { name: forged.name })}
            </p>
          )}
          {mutation.isError && (
            <p className="forge-tab__error" role="alert">
              {apiErrorMessage(mutation.error) ?? t("collection.forge_error")}
            </p>
          )}

          <div className="forge-tab__bar">
            {counter}
            <Button
              variant="ghost-bordeaux"
              disabled={mutation.isPending}
              onClick={back}
            >
              {t("collection.forge_back")}
            </Button>
            {forged ? (
              <Button disabled={refreshing} onClick={reforge}>
                <IconForge size={16} color="currentColor" />
                {t("collection.forge_reforge")}
              </Button>
            ) : (
              <Button
                disabled={
                  targetId === null ||
                  !canSubmitForge(selection, cost) ||
                  mutation.isPending
                }
                onClick={() =>
                  targetId !== null && mutation.mutate({ selection, targetId })
                }
              >
                <IconForge size={16} color="currentColor" />
                {mutation.isPending
                  ? t("collection.forge_forging")
                  : t("collection.forge_submit")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
