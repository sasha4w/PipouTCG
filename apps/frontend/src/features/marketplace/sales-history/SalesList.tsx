import { useEffect, useMemo, useRef, useState } from "react";
import type { SaleSort } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import type { Transaction } from "../../../services/transaction.service";
import Button from "../../../components/Button";
import { IconArrowLeft, IconArrowRight } from "../../../components/Icons";
import { formatGold, type SalesPlayer } from "./salesScope";
import "./SalesList.css";

interface SalesListProps {
  history: Transaction[] | undefined;
  emptyMessage: string;
  sort: SaleSort;
  onSortChange: (sort: SaleSort) => void;
  /** Vente à mettre en avant (lien depuis la boîte de réception, plus grosse vente). */
  highlightId?: number | null;
  /** Joueur connecté : colore les lignes selon qu'il a vendu ou acheté. */
  viewerId?: number;
  onPlayerClick: (player: SalesPlayer) => void;
}

const ITEMS_PER_PAGE = 6;
const SORTS: SaleSort[] = ["date", "price"];

function perspectiveClass(tx: Transaction, viewerId?: number) {
  if (viewerId === undefined) return "";
  if (tx.seller?.id === viewerId) return " sales-list__item--sold";
  if (tx.buyer?.id === viewerId) return " sales-list__item--bought";
  return "";
}

const SalesList = ({
  history,
  emptyMessage,
  sort,
  onSortChange,
  highlightId,
  viewerId,
  onPlayerClick,
}: SalesListProps) => {
  const { t } = useTranslation();
  // null = page automatique : celle de la vente mise en avant, sinon la 1re
  const [chosenPage, setChosenPage] = useState<number | null>(null);
  const highlightRef = useRef<HTMLLIElement>(null);

  const highlightIndex = highlightId
    ? (history?.findIndex((tx) => tx.id === highlightId) ?? -1)
    : -1;
  const page =
    chosenPage ??
    (highlightIndex >= 0 ? Math.floor(highlightIndex / ITEMS_PER_PAGE) + 1 : 1);
  const setPage = (update: (p: number) => number) => setChosenPage(update(page));

  const isHighlightVisible = highlightIndex >= 0 && chosenPage === null;
  useEffect(() => {
    if (isHighlightVisible)
      highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isHighlightVisible]);

  const paginatedHistory = useMemo(() => {
    if (!history) return [];
    const start = (page - 1) * ITEMS_PER_PAGE;
    return history.slice(start, start + ITEMS_PER_PAGE);
  }, [history, page]);

  const totalPages = history ? Math.ceil(history.length / ITEMS_PER_PAGE) : 1;

  if (!history || history.length === 0) {
    return <p className="sales-list__empty">{emptyMessage}</p>;
  }

  const renderPlayer = (player: SalesPlayer | null | undefined, className: string) =>
    player ? (
      <button
        type="button"
        className={`sales-list__player ${className}`}
        aria-label={t("marketplace.sales.show_player", { name: player.username })}
        onClick={() => onPlayerClick({ id: player.id, username: player.username })}
      >
        {player.username}
      </button>
    ) : (
      <span className={className}>—</span>
    );

  return (
    <div className="sales-list-wrapper">
      <div
        className="sales-list__sort"
        role="group"
        aria-label={t("marketplace.history.sort_label")}
      >
        {SORTS.map((key) => (
          <Button
            key={key}
            variant="ghost-bordeaux"
            size="sm"
            active={sort === key}
            onClick={() => {
              setChosenPage(1);
              onSortChange(key);
            }}
          >
            {t(`marketplace.history.sort_${key}`)}
          </Button>
        ))}
      </div>
      <ul className="sales-list">
        {paginatedHistory.map((tx) => (
          <li
            key={tx.id}
            ref={tx.id === highlightId ? highlightRef : undefined}
            className={`sales-list__item${perspectiveClass(tx, viewerId)}${
              tx.id === highlightId ? " sales-list__item--highlight" : ""
            }`}
          >
            <div className="sales-list__left">
              <span className="sales-list__name">
                {tx.itemName || t("marketplace.sales.unknown_item", { id: tx.productId })}
              </span>
              <span className="sales-list__users">
                {renderPlayer(tx.seller, "sales-list__seller")}
                <span className="sales-list__arrow">→</span>
                {renderPlayer(tx.buyer, "sales-list__buyer")}
              </span>
            </div>
            <div className="sales-list__right">
              <span className="sales-list__qty">×{tx.quantity}</span>
              <span className="sales-list__prices">
                <span className="sales-list__price">{formatGold(tx.totalPrice)}</span>
                <span className="sales-list__unit">
                  {t("marketplace.sales.per_unit", { price: tx.unitPrice })}
                </span>
              </span>
              <span className="sales-list__date">
                {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="sales-list__pagination">
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.prev")}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <IconArrowLeft size={16} color="currentColor" />
          </Button>
          <span>{t("marketplace.history.pagination", { page, total: totalPages })}</span>
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.next")}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <IconArrowRight size={16} color="currentColor" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SalesList;
