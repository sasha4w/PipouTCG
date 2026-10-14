import { useEffect, useMemo, useRef, useState } from "react";
import type { SaleSort } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import { type Transaction } from "../../services/transaction.service";
import Button from "../../components/Button";
import { IconArrowLeft, IconArrowRight } from "../../components/Icons";
import "./TransactionHistory.css";

interface TransactionHistoryProps {
  history: Transaction[] | undefined;
  emptyMessage?: string;
  sort: SaleSort;
  onSortChange: (sort: SaleSort) => void;
  /** Vente à mettre en avant (lien depuis la boîte de réception). */
  highlightId?: number | null;
}

const ITEMS_PER_PAGE = 6;
const SORTS: SaleSort[] = ["date", "price"];

const TransactionHistory = ({
  history,
  emptyMessage,
  sort,
  onSortChange,
  highlightId,
}: TransactionHistoryProps) => {
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
  const setPage = (update: (p: number) => number) =>
    setChosenPage(update(page));

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
    return (
      <p className="tx-history__empty">
        {emptyMessage ?? t("marketplace.history.empty")}
      </p>
    );
  }

  return (
    <div className="tx-history-wrapper">
      <div
        className="tx-history__sort"
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
      <ul className="tx-history">
        {paginatedHistory.map((tx) => (
          <li
            key={tx.id}
            ref={tx.id === highlightId ? highlightRef : undefined}
            className={`tx-history__item${tx.id === highlightId ? " tx-history__item--highlight" : ""}`}
          >
            <div className="tx-history__item-left">
              <span className="tx-history__name">
                {tx.itemName || `Objet #${tx.productId}`}
              </span>
              <span className="tx-history__users">
                <span className="tx-history__seller">
                  {tx.seller?.username || "—"}
                </span>
                <span className="tx-history__arrow">→</span>
                <span className="tx-history__buyer">
                  {tx.buyer?.username || "—"}
                </span>
              </span>
            </div>
            <div className="tx-history__item-right">
              <span className="tx-history__qty">×{tx.quantity}</span>
              <span className="tx-history__price">{tx.totalPrice} G</span>
              <span className="tx-history__date">
                {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="tx-history__pagination">
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.prev")}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <IconArrowLeft size={16} color="currentColor" />
          </Button>
          <span>
            {t("marketplace.history.pagination", { page, total: totalPages })}
          </span>
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

export default TransactionHistory;
