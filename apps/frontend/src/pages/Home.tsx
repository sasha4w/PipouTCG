import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import CardSetList from "../features/cards/CardSetList";
import CardList from "../features/cards/CardList";
import ShopSection from "../features/shop/ShopSection";
import OpeningModal, {
  type OpeningTarget,
} from "../features/opening/OpeningModal";

import "./Home.css";

interface SelectedSet {
  id: number;
  name: string;
}

// ── Ouverture rapide ──────────────────────────────────────────────────────────
function OpeningQuickAccess({
  inventory,
  onOpen,
}: {
  inventory: any;
  onOpen: (target: OpeningTarget) => void;
}) {
  const boosters = inventory?.boosters?.data ?? [];
  const bundles = inventory?.bundles?.data ?? [];
  const items = [
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

  if (items.length === 0) return null;

  return (
    <div className="home-opening">
      <h2 className="home-section__title">🎲 Ouvrir</h2>
      <div className="home-opening__list">
        {items.map((item, i) => (
          <button
            key={i}
            className="home-opening__item"
            onClick={() =>
              onOpen({ type: item.type, id: item.id, name: item.name })
            }
          >
            <span className="home-opening__item-icon">
              {item.type === "booster" ? "📦" : "🎁"}
            </span>
            <div className="home-opening__item-info">
              <span className="home-opening__item-name">{item.name}</span>
              <span className="home-opening__item-qty">×{item.qty}</span>
            </div>
            <span className="home-opening__item-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
const Home = () => {
  const [selectedSet, setSelectedSet] = useState<SelectedSet | null>(null);
  const [openingTarget, setOpeningTarget] = useState<OpeningTarget | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["myStats"],
    queryFn: () => userService.getMyStats(),
  });
  const { data: inventory } = useQuery({
    queryKey: ["myInventory"],
    queryFn: () => userService.getMyInventory(),
  });

  const handleOpeningDone = () => {
    queryClient.invalidateQueries({ queryKey: ["myInventory"] });
    queryClient.invalidateQueries({ queryKey: ["myCollection"] });
  };

  // ── Vue CardList (quand un set est sélectionné) ───────────────────────────
  if (selectedSet) {
    return (
      <div className="home-page">
        <CardList
          setId={selectedSet.id}
          setName={selectedSet.name}
          onBack={() => setSelectedSet(null)}
        />
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* ── Shop + Bannières ── */}
      <ShopSection
        gold={profile?.gold ?? 0}
        onBalance={() =>
          queryClient.invalidateQueries({ queryKey: ["myStats"] })
        }
      />

      <div className="home-divider" />

      {/* ── Ouverture rapide ── */}
      {inventory && (
        <OpeningQuickAccess inventory={inventory} onOpen={setOpeningTarget} />
      )}

      <div className="home-divider" />

      <div className="home-divider" />

      {/* ── Sets de cartes ── */}
      <div>
        <div className="home-page__header">
          <h2 className="home-page__title">Sets de cartes</h2>
          <p className="home-page__subtitle">
            Explore tous les sets disponibles
          </p>
        </div>
        <CardSetList onSelectSet={(id, name) => setSelectedSet({ id, name })} />
      </div>

      {/* ── OpeningModal ── */}
      {openingTarget && (
        <OpeningModal
          target={openingTarget}
          onClose={() => setOpeningTarget(null)}
          onDone={handleOpeningDone}
        />
      )}
    </div>
  );
};

export default Home;
