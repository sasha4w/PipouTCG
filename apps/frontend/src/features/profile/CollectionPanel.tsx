import { useState } from "react";
import type { UserInventory } from "../../services/user.service";
import { IconCards, IconBooster, IconBundle } from "../../components/Icons";
import OwnCardList from "./OwnCardList";
import "./CollectionPanel.css";

// ── Chevron ───────────────────────────────────────────────────────────────────
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

// ── Ligne booster / bundle ────────────────────────────────────────────────────
function InvRow({
  name,
  price,
  quantity,
}: {
  name: string;
  price: number;
  quantity: number;
}) {
  return (
    <div className="inv-row">
      <span className="inv-row__name">{name}</span>
      <span className="inv-row__meta">{price} gold</span>
      <span className="inv-row__qty">×{quantity}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CollectionPanelProps {
  inventory: UserInventory;
}

type ActiveSection = "cards" | "boosters" | "bundles" | null;

// ══════════════════════════════════════════════════════════════════════════════
export default function CollectionPanel({ inventory }: CollectionPanelProps) {
  const [active, setActive] = useState<ActiveSection>(null);

  const toggle = (section: ActiveSection) =>
    setActive((prev) => (prev === section ? null : section));

  const sections = [
    {
      key: "cards" as const,
      icon: <IconCards size={18} color="#7a1c3b" />,
      label: "Cartes",
      total: inventory.cards.data.reduce((sum, c) => sum + c.quantity, 0),
    },
    {
      key: "boosters" as const,
      icon: <IconBooster size={18} color="#7a1c3b" />,
      label: "Boosters",
      total: inventory.boosters.meta.total,
    },
    {
      key: "bundles" as const,
      icon: <IconBundle size={18} color="#7a1c3b" />,
      label: "Bundles",
      total: inventory.bundles.meta.total,
    },
  ];

  return (
    <div className="collection-panel">
      <h2 className="collection-panel__title">Mon inventaire</h2>

      <div className="collection-panel__list">
        {sections.map((s) => (
          <div key={s.key}>
            {/* ── Ligne cliquable ── */}
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

            {/* ── Contenu étendu ── */}
            {active === s.key && (
              <div className="collection-panel__content">
                {/* CARTES — utilise OwnCardList avec CardDisplay */}
                {s.key === "cards" &&
                  (inventory.cards.data.length === 0 ? (
                    <p className="collection-panel__empty">Aucune carte.</p>
                  ) : (
                    <OwnCardList cards={inventory.cards.data} />
                  ))}

                {/* BOOSTERS */}
                {s.key === "boosters" &&
                  (inventory.boosters.data.length === 0 ? (
                    <p className="collection-panel__empty">Aucun booster.</p>
                  ) : (
                    <div className="collection-panel__item-list">
                      {inventory.boosters.data.map((b) => (
                        <InvRow
                          key={b.id}
                          name={b.name}
                          price={b.price}
                          quantity={b.quantity}
                        />
                      ))}
                    </div>
                  ))}

                {/* BUNDLES */}
                {s.key === "bundles" &&
                  (inventory.bundles.data.length === 0 ? (
                    <p className="collection-panel__empty">Aucun bundle.</p>
                  ) : (
                    <div className="collection-panel__item-list">
                      {inventory.bundles.data.map((b) => (
                        <InvRow
                          key={b.id}
                          name={b.name}
                          price={b.price}
                          quantity={b.quantity}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
