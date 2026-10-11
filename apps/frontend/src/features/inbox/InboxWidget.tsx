import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationType } from "@pipou/shared";
import { useClaimReward } from "../../hooks/useGameData";
import {
  useMarkNotificationsRead,
  useNotifications,
  type InboxTab,
} from "../../hooks/useNotifications";
import { questService } from "../../services/quest.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import Button from "../../components/Button";
import { IconArrowRight, IconMail } from "../../components/Icons";
import InboxItem from "./InboxItem";
import "./InboxWidget.css";

const TABS: InboxTab[] = ["all", "information", "reward"];

export default function InboxWidget({
  onOpenQuests,
}: {
  onOpenQuests: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const claim = useClaimReward();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>("all");
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // "all" alimente le badge et les compteurs d'onglets ; l'onglet actif liste les messages
  const all = useNotifications("all");
  const current = useNotifications(tab);
  const unread = all.data?.unread;

  const close = () => {
    setOpen(false);
    const hasMarkable = all.data?.items.some(
      (i) => !i.read && i.type !== NotificationType.QUEST_COMPLETED,
    );
    if (hasMarkable) markRead.mutate();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  const items = current.data?.items ?? [];
  const claimable = items.filter(
    (i) => i.type === NotificationType.QUEST_COMPLETED && !i.read,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
  };

  const handleClaim = (userQuestId: number) => {
    setClaimError(null);
    claim.mutate(userQuestId, {
      onSettled: refresh,
      onError: (e) =>
        setClaimError(apiErrorMessage(e) ?? t("inbox.claim_error")),
    });
  };

  const handleClaimAll = async () => {
    setClaimingAll(true);
    setClaimError(null);
    try {
      await questService.claimAllRewards();
    } catch (e) {
      setClaimError(apiErrorMessage(e) ?? t("inbox.claim_error"));
    } finally {
      refresh();
      setClaimingAll(false);
    }
  };

  return (
    <div className="inbox" ref={ref}>
      <Button
        variant="ghost-bordeaux"
        size="icon"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={t("inbox.label")}
        aria-expanded={open}
      >
        <IconMail size={17} color="#7a1c3b" />
        {!!unread?.all && <span className="inbox__badge">{unread.all}</span>}
      </Button>

      {open && (
        <div className="inbox__dropdown">
          <div className="inbox__dheader">
            <span className="inbox__dtitle">{t("inbox.title")}</span>
            {claimable.length > 1 && (
              <Button
                variant="primary-inverse"
                size="sm"
                onClick={handleClaimAll}
                disabled={claimingAll || claim.isPending}
              >
                {claimingAll
                  ? "..."
                  : `${t("quests.claim_all")} (${claimable.length})`}
              </Button>
            )}
          </div>

          <div className="inbox__tabs" role="tablist">
            {TABS.map((key) => {
              const count = unread?.[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`inbox__tab${tab === key ? " inbox__tab--active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {t(`inbox.tabs.${key}`)}
                  {count > 0 && (
                    <span className="inbox__tab-count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {claimError && (
            <p className="inbox__error" role="alert">
              {claimError}
            </p>
          )}

          <div className="inbox__list">
            {current.isError ? (
              <div className="inbox__state" role="alert">
                <p>{t("inbox.error")}</p>
                <Button
                  variant="ghost-gold"
                  size="sm"
                  onClick={() => current.refetch()}
                >
                  {t("inbox.retry")}
                </Button>
              </div>
            ) : items.length === 0 ? (
              <p className="inbox__state">
                {current.isLoading ? "..." : t("inbox.empty")}
              </p>
            ) : (
              items.map((item) => (
                <InboxItem
                  key={item.id}
                  item={item}
                  claiming={claim.isPending}
                  onClaim={handleClaim}
                  onNavigate={(path) => {
                    close();
                    navigate(path);
                  }}
                />
              ))
            )}
          </div>

          <div className="inbox__footer-bar">
            <Button
              variant="ghost-gold"
              size="sm"
              onClick={() => {
                close();
                onOpenQuests();
              }}
            >
              {t("quests.see_all")} <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
