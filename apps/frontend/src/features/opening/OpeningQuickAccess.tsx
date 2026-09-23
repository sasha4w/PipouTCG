import { useState } from "react";
import type { OpeningTarget } from "./OpeningModal";
import "./OpeningQuickAccess.css";

interface OpeningItem {
  type: "booster" | "bundle";
  id: number;
  name: string;
  qty: number;
}

interface OpeningQuickAccessProps {
  inventory: any;
  onOpen: (target: OpeningTarget) => void;
}

const OpeningQuickAccess = ({ inventory, onOpen }: OpeningQuickAccessProps) => {
  const boosters = inventory?.boosters?.data ?? [];
  const bundles = inventory?.bundles?.data ?? [];

  const items: OpeningItem[] = [
    ...boosters
      .filter((b: any) => b.quantity > 0)
      .map((b: any) => ({
        type: "booster" as const,
        id: b.id,
        name: b.name,
        qty: b.quantity,
      })),
    ...bundles
      .filter((b: any) => b.quantity > 0)
      .map((b: any) => ({
        type: "bundle" as const,
        id: b.id,
        name: b.name,
        qty: b.quantity,
      })),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);

  if (items.length === 0) return null;

  const selected = items[selectedIndex] ?? items[0];

  return (
    <div className="opening-selector">
      <h2 className="home-section__title">🎲 Ouvrir</h2>

      <div className="opening-selector__featured">
        <div className="opening-selector__featured-icon">
          {selected.type === "booster" ? "📦" : "🎁"}
        </div>
        <div className="opening-selector__featured-name">{selected.name}</div>
        <div className="opening-selector__featured-qty">
          ×{selected.qty} disponible{selected.qty > 1 ? "s" : ""}
        </div>
        <button
          className="opening-selector__open-btn"
          onClick={() =>
            onOpen({
              type: selected.type,
              id: selected.id,
              name: selected.name,
            })
          }
        >
          Ouvrir
        </button>
      </div>

      <div className="opening-selector__shelf">
        {items.map((item, i) => (
          <button
            key={i}
            className={`opening-selector__thumb${i === selectedIndex ? " opening-selector__thumb--active" : ""}`}
            onClick={() => setSelectedIndex(i)}
          >
            <span className="opening-selector__thumb-icon">
              {item.type === "booster" ? "📦" : "🎁"}
            </span>
            <span className="opening-selector__thumb-name">{item.name}</span>
            <span className="opening-selector__thumb-qty">×{item.qty}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OpeningQuickAccess;
