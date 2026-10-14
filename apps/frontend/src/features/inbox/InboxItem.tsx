import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@pipou/shared";
import { NotificationType } from "@pipou/shared";
import Button from "../../components/Button";
import {
  IconBell,
  IconBooster,
  IconBundle,
  IconCards,
  IconGold,
  IconQuest,
} from "../../components/Icons";
import { formatRelative } from "./relativeTime";

const MAX_DROP_NAMES = 3;

function RewardIcon({ type }: { type: string }) {
  const p = { size: 12, color: "#eebc77" };
  if (type === "GOLD") return <IconGold {...p} />;
  if (type === "BOOSTER") return <IconBooster {...p} />;
  if (type === "BUNDLE") return <IconBundle {...p} />;
  return null;
}

interface Props {
  item: NotificationItem;
  claiming: boolean;
  onClaim: (userQuestId: number) => void;
  onNavigate: (path: string) => void;
}

/** Une ligne de la boîte ; le rendu dépend du type (switch exhaustif). */
export default function InboxItem({
  item,
  claiming,
  onClaim,
  onNavigate,
}: Props) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const when = formatRelative(item.createdAt, i18n.language);
  const dot = !item.read && <span className="inbox__dot" aria-hidden="true" />;

  switch (item.type) {
    case NotificationType.QUEST_COMPLETED: {
      const { userQuestId, title, rewardType, rewardAmount } = item.payload;
      return (
        <div className="inbox__item inbox__item--reward">
          <div className="inbox__row">
            <IconQuest size={14} color="#eebc77" />
            <span className="inbox__title">{title}</span>
            <span className="inbox__chip">
              <RewardIcon type={rewardType} />+{rewardAmount}
            </span>
            {dot}
          </div>
          <div className="inbox__footer">
            <span className="inbox__meta">
              {t("inbox.quest_completed")} · {when}
            </span>
            {!item.read && (
              <Button
                variant="primary-inverse"
                size="sm"
                disabled={claiming}
                onClick={() => onClaim(userQuestId)}
              >
                {claiming ? "..." : t("quests.claim")}
              </Button>
            )}
          </div>
        </div>
      );
    }

    case NotificationType.CARD_DROP: {
      const { boosterName, cards } = item.payload;
      const shown = cards.slice(0, MAX_DROP_NAMES);
      const rest = cards.length - shown.length;
      return (
        <div className="inbox__item inbox__item--reward">
          <div className="inbox__row">
            <IconCards size={14} color="#eebc77" />
            <span className="inbox__title">
              {t("inbox.drop_title", { booster: boosterName })}
            </span>
            {dot}
          </div>
          <ul className="inbox__cards">
            {shown.map((card) => (
              <li
                key={card.cardId}
                className={`inbox__card inbox__card--${card.rarity}`}
              >
                {card.name} · {t(`inbox.rarity.${card.rarity}`)}
                {card.isNew && (
                  <span className="inbox__new">{t("inbox.drop_new")}</span>
                )}
              </li>
            ))}
            {rest > 0 && (
              <li className="inbox__meta">
                {t("inbox.drop_more", { count: rest })}
              </li>
            )}
          </ul>
          <div className="inbox__footer">
            <span className="inbox__meta">{when}</span>
            <Button
              variant="ghost-gold"
              size="sm"
              onClick={() => onNavigate("/profile")}
            >
              {t("inbox.see_collection")}
            </Button>
          </div>
        </div>
      );
    }

    case NotificationType.LISTING_SOLD: {
      const { buyerUsername, itemName, totalPrice, transactionId } =
        item.payload;
      return (
        <div className="inbox__item">
          <div className="inbox__row">
            <IconGold size={14} color="#eebc77" />
            <span className="inbox__title">
              {t("inbox.sold_title", { buyer: buyerUsername, item: itemName })}
            </span>
            <span className="inbox__chip">
              {t("inbox.sold_amount", { price: totalPrice })}
            </span>
            {dot}
          </div>
          <div className="inbox__footer">
            <span className="inbox__meta">{when}</span>
            <Button
              variant="ghost-gold"
              size="sm"
              onClick={() =>
                onNavigate(`/marketplace?tab=sell&sale=${transactionId}`)
              }
            >
              {t("inbox.see_my_sales")}
            </Button>
          </div>
        </div>
      );
    }

    case NotificationType.PATCHNOTE: {
      const { title, body } = item.payload;
      return (
        <div className="inbox__item">
          <button
            type="button"
            className="inbox__row inbox__row--toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <IconBell size={14} color="#eebc77" />
            <span className="inbox__title">{title}</span>
            {dot}
          </button>
          {expanded && <p className="inbox__body">{body}</p>}
          <span className="inbox__meta">
            {t("inbox.patchnote")} · {when}
          </span>
        </div>
      );
    }

    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}
