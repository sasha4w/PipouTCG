import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  UserInventory,
  UserCollection,
} from "../../services/user.service";
import { IconCards, IconBooster, IconBundle } from "../../components/Icons";
import OwnCardList from "./OwnCardList";
import OwnBoosterList from "../boosters/OwnerBoosterList";
import OwnBundleList from "../bundles/OwnerBundleList";
import type { OpeningTarget } from "../opening/OpeningModal";
import "./CollectionPanel.css";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`collection-panel__chevron${open ? " collection-panel__chevron--open" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="#a08070"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CollectionPanelProps {
  inventory: UserInventory;
  collection: UserCollection | null;
  onOpenBooster?: (target: OpeningTarget) => void;
}

type ActiveSection = "cards" | "boosters" | "bundles" | null;

export default function CollectionPanel({
  inventory,
  collection,
  onOpenBooster,
}: CollectionPanelProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveSection>(null);

  const toggle = (section: ActiveSection) =>
    setActive((prev) => (prev === section ? null : section));

  const sections = [
    {
      key: "cards" as const,
      icon: <IconCards size={18} color="#7a1c3b" />,
      label: t("collection.cards"),
      total: inventory.cards.data.reduce((sum, c) => sum + c.quantity, 0),
    },
    {
      key: "boosters" as const,
      icon: <IconBooster size={18} color="#7a1c3b" />,
      label: t("collection.boosters"),
      total: inventory.boosters.data.reduce((sum, b) => sum + b.quantity, 0),
    },
    {
      key: "bundles" as const,
      icon: <IconBundle size={18} color="#7a1c3b" />,
      label: t("collection.bundles"),
      total: inventory.bundles.data.reduce((sum, b) => sum + b.quantity, 0),
    },
  ];

  return (
    <div className="collection-panel">
      <h2 className="collection-panel__title">{t("collection.title")}</h2>

      <div className="collection-panel__list">
        {sections.map((s) => (
          <div key={s.key}>
            <div
              className={`collection-panel__item${active === s.key ? " collection-panel__item--active" : ""}`}
              onClick={() => toggle(s.key)}
            >
              <div className="collection-panel__item-left">
                <span className="collection-panel__item-icon">{s.icon}</span>
                <span>{s.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="collection-panel__badge">{s.total}</span>
                <Chevron open={active === s.key} />
              </div>
            </div>

            {active === s.key && (
              <div className="collection-panel__content">
                {s.key === "cards" &&
                  (!collection ? (
                    <p className="collection-panel__empty">
                      {t("collection.loading")}
                    </p>
                  ) : collection.sets.length === 0 ? (
                    <p className="collection-panel__empty">
                      {t("collection.no_cards")}
                    </p>
                  ) : (
                    <OwnCardList collection={collection} />
                  ))}
                {s.key === "boosters" &&
                  (inventory.boosters.data.length === 0 ? (
                    <p className="collection-panel__empty">
                      {t("collection.no_boosters")}
                    </p>
                  ) : (
                    <OwnBoosterList
                      boosters={inventory.boosters.data}
                      onOpen={onOpenBooster}
                    />
                  ))}
                {s.key === "bundles" &&
                  (inventory.bundles.data.length === 0 ? (
                    <p className="collection-panel__empty">
                      {t("collection.no_bundles")}
                    </p>
                  ) : (
                    <OwnBundleList
                      bundles={inventory.bundles.data}
                      onOpen={onOpenBooster}
                    />
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
