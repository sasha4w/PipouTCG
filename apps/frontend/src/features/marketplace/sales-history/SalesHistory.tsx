import { useState } from "react";
import type { SaleSort } from "@pipou/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ContentLoader from "react-content-loader";
import { useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import { transactionService } from "../../../services/transaction.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage } from "../../../utils/errors";
import GoldChart from "./GoldChart";
import SalesFilterBar from "./SalesFilterBar";
import SalesList from "./SalesList";
import StatTiles from "./StatTiles";
import { compactTiles, detailTiles } from "./salesTiles";
import {
  MARKET_SCOPE,
  scopeToFilter,
  type SalesPlayer,
  type SalesScope,
} from "./salesScope";
import "./SalesHistory.css";

interface SalesHistoryProps {
  emptyMessage: string;
  /** Joueur connecté (undefined tant que le profil charge). */
  me: SalesPlayer | undefined;
  /** Filtre au premier affichage : mes ventes (onglet Vendre) ou tout le marché. */
  initialScope: "my-sales" | "market";
  /** Vente à mettre en avant : ouvre « Détails » d'office. */
  highlightSaleId?: number | null;
}

function defaultScope(
  initialScope: SalesHistoryProps["initialScope"],
  me: SalesPlayer | undefined,
): SalesScope | null {
  if (initialScope === "market") return MARKET_SCOPE;
  // Mes ventes : il faut attendre le profil
  return me ? { kind: "player", player: me, role: "seller" } : null;
}

const SalesHistory = ({
  emptyMessage,
  me,
  initialScope,
  highlightSaleId,
}: SalesHistoryProps) => {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  // null = valeurs par défaut, dérivées des props
  const [chosenScope, setChosenScope] = useState<SalesScope | null>(null);
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null);
  const [pickedHighlight, setPickedHighlight] = useState<number | null>(null);
  const [sort, setSort] = useState<SaleSort>("date");

  const scope = chosenScope ?? defaultScope(initialScope, me);
  const filter = scope ? scopeToFilter(scope) : null;
  const highlight = pickedHighlight ?? highlightSaleId ?? null;
  const open = chosenOpen ?? highlight !== null;

  const stats = useQuery({
    queryKey: QUERY_KEYS.salesStats(filter ?? {}),
    queryFn: () => transactionService.getSalesStats(filter!),
    enabled: filter !== null,
    placeholderData: keepPreviousData,
  });
  const list = useQuery({
    queryKey: QUERY_KEYS.salesList(filter ?? {}, sort),
    queryFn: () => transactionService.getSales(filter!, sort),
    enabled: filter !== null && open,
  });

  const selectPlayer = (player: SalesPlayer) => {
    setChosenScope({ kind: "player", player, role: "both" });
    setPickedHighlight(null);
  };
  const changeScope = (next: SalesScope) => {
    setChosenScope(next);
    setPickedHighlight(null);
  };
  const showSale = (saleId: number) => {
    setPickedHighlight(saleId);
    setChosenOpen(true);
  };

  if (!scope || stats.isPending) {
    return (
      <ContentLoader
        className="sales-history__skeleton"
        viewBox="0 0 400 260"
        backgroundColor="#ead7c4"
        foregroundColor="#f5e6d0"
      >
        <rect x="0" y="0" rx="14" ry="14" width="196" height="64" />
        <rect x="204" y="0" rx="14" ry="14" width="196" height="64" />
        <rect x="0" y="72" rx="14" ry="14" width="196" height="64" />
        <rect x="204" y="72" rx="14" ry="14" width="196" height="64" />
        <rect x="0" y="146" rx="14" ry="14" width="400" height="114" />
      </ContentLoader>
    );
  }

  const errorMessage = stats.isError ? apiErrorMessage(stats.error) : null;

  return (
    <section className="sales-history">
      <SalesFilterBar scope={scope} me={me} onChange={changeScope} />

      {stats.isError ? (
        <p className="sales-history__error" role="alert">
          {errorMessage
            ? t("marketplace.sales.error", { message: errorMessage })
            : t("marketplace.sales.error_default")}
        </p>
      ) : (
        <>
          <StatTiles tiles={compactTiles(stats.data, t, i18n.language, showSale)} />
          <GoldChart daily={stats.data.daily} bestDay={stats.data.bestDay} />
        </>
      )}

      <Button
        variant="ghost-bordeaux"
        fullWidth
        aria-expanded={open}
        onClick={() => setChosenOpen(!open)}
      >
        {open ? t("marketplace.sales.details_close") : t("marketplace.sales.details_open")}
        <span className={`sales-history__chevron${open ? " sales-history__chevron--open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            className="sales-history__details"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {stats.data && (
              <StatTiles
                tiles={detailTiles(stats.data, scope, t, i18n.language, selectPlayer)}
              />
            )}
            <SalesList
              key={`${filter?.userId ?? "market"}-${filter?.role ?? "both"}-${highlight ?? "none"}`}
              history={list.data?.data}
              emptyMessage={list.isPending ? "…" : emptyMessage}
              sort={sort}
              onSortChange={setSort}
              highlightId={highlight}
              viewerId={me?.id}
              onPlayerClick={selectPlayer}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SalesHistory;
