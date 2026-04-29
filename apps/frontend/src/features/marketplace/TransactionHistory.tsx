import { useMemo, useState } from "react";
import { type Transaction } from "../../services/transaction.service";
import "./TransactionHistory.css";

interface TransactionHistoryProps {
  history: Transaction[] | undefined;
  emptyMessage?: string;
}

const ITEMS_PER_PAGE = 6;

const TransactionHistory = ({
  history,
  emptyMessage = "Aucun historique.",
}: TransactionHistoryProps) => {
  const [page, setPage] = useState(1);

  const paginatedHistory = useMemo(() => {
    if (!history) return [];

    const start = (page - 1) * ITEMS_PER_PAGE;
    return history.slice(start, start + ITEMS_PER_PAGE);
  }, [history, page]);

  const totalPages = history ? Math.ceil(history.length / ITEMS_PER_PAGE) : 1;

  if (!history || history.length === 0) {
    return <p className="tx-history__empty">{emptyMessage}</p>;
  }

  return (
    <div className="tx-history-wrapper">
      <ul className="tx-history">
        {paginatedHistory.map((tx) => (
          <li key={tx.id} className="tx-history__item">
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
                {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString(
                  "fr-FR",
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="tx-history__pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ←
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
