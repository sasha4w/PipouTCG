import type { UserInventory } from "../services/user.service";
import "./CollectionPanel.css";
import { IconCards, IconBooster, IconBundle } from "../components/Icons";
interface CollectionPanelProps {
  inventory: UserInventory;
}

export default function CollectionPanel({ inventory }: CollectionPanelProps) {
  const items = [
    {
      icon: <IconCards size={18} color="#7a1c3b" />,
      label: "Cartes",
      total: inventory.cards.meta.total,
    },
    {
      icon: <IconBooster size={18} color="#7a1c3b" />,
      label: "Boosters",
      total: inventory.boosters.meta.total,
    },
    {
      icon: <IconBundle size={18} color="#7a1c3b" />,
      label: "Bundles",
      total: inventory.bundles.meta.total,
    },
  ];

  return (
    <div className="collection-panel">
      <h2 className="collection-panel__title">Mon inventaire</h2>
      <div className="collection-panel__list">
        {items.map((item) => (
          <div key={item.label} className="collection-panel__item">
            <div className="collection-panel__item-left">
              <span className="collection-panel__item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            <span className="collection-panel__badge">{item.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
