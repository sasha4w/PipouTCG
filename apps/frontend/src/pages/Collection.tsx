import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import CardInspect from "../features/fight/CardInspect";
import CollectionTab from "../features/collection/CollectionTab";
import DustBalance from "../features/collection/DustBalance";
import type { OwnedCard } from "../features/collection/ownedCards";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import "./Collection.css";

export type CollectionTabKey = "collection" | "forge" | "destroy";
const TABS: CollectionTabKey[] = ["collection", "forge", "destroy"];

function parseTab(value: string | null): CollectionTabKey {
  return TABS.find((k) => k === value) ?? "collection";
}

export default function Collection() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const [inspected, setInspected] = useState<OwnedCard | null>(null);
  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="collection-page">
      <div className="collection-page__header">
        <h2 className="collection-page__title">{t("collection.page_title")}</h2>
        <DustBalance dust={me?.dust ?? 0} />
      </div>

      <div className="collection-page__tabs" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`collection-page__tab${tab === key ? " collection-page__tab--active" : ""}`}
            onClick={() =>
              setSearchParams(key === "collection" ? {} : { tab: key }, {
                replace: true,
              })
            }
          >
            {t(`collection.tab_${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "collection" && <CollectionTab onInspect={setInspected} />}
        {tab === "forge" && <div className="collection-page__slot" />}
        {tab === "destroy" && <div className="collection-page__slot" />}
      </div>

      {inspected && (
        <CardInspect card={inspected.card} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
