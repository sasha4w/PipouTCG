import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import CardSetList from "../features/cards/CardSetList";
import CardList from "../features/cards/CardList";
import ShopSection from "../features/shop/ShopSection";
import DailyStreakWidget from "../components/DailyStreakWidget";
import OpeningModal, {
  type OpeningTarget,
} from "../features/opening/OpeningModal";
import OpeningQuickAccess from "../features/opening/OpeningQuickAccess";
import { QUERY_KEYS } from "../utils/querykeys";
import "./Home.css";

interface SelectedSet {
  id: number;
  name: string;
}

// ── Home ──────────────────────────────────────────────────────────────────────
const Home = () => {
  const [selectedSet, setSelectedSet] = useState<SelectedSet | null>(null);
  const [openingTarget, setOpeningTarget] = useState<OpeningTarget | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: QUERY_KEYS.myStats,
    queryFn: () => userService.getMyStats(),
  });
  const { data: inventory } = useQuery({
    queryKey: QUERY_KEYS.inventory,
    queryFn: () => userService.getMyInventory(),
  });
  const handleOpeningDone = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection });
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
      <DailyStreakWidget />
      <div className="home-divider" />

      {/* ── Shop + Bannières ── */}
      <ShopSection
        gold={profile?.gold ?? 0}
        onBalance={() =>
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats })
        }
      />
      <div className="home-divider" />
      {/* ── Ouverture rapide ── */}
      {inventory && (
        <OpeningQuickAccess inventory={inventory} onOpen={setOpeningTarget} />
      )}
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
