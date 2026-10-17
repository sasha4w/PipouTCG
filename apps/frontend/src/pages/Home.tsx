import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import CardGlossary from "../features/glossary/CardGlossary";
import ShopSection from "../features/shop/ShopSection";
import DailyStreakWidget from "../components/DailyStreakWidget";
import OpeningModal, {
  type OpeningTarget,
} from "../features/opening/OpeningModal";
import OpeningQuickAccess from "../features/opening/OpeningQuickAccess";
import { IconArrowRight, IconCards } from "../components/Icons";
import { soundService } from "../services/sound.service";
import { QUERY_KEYS } from "../utils/querykeys";
import "./Home.css";

// ── Home ──────────────────────────────────────────────────────────────────────
const Home = () => {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
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
  // ── Vue glossaire ─────────────────────────────────────────────────────────
  if (glossaryOpen) {
    return (
      <div className="home-page">
        <CardGlossary onBack={() => setGlossaryOpen(false)} />
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

      {/* ── Glossaire ── */}
      <button
        type="button"
        className="home-glossary"
        onClick={() => {
          soundService.play("select");
          setGlossaryOpen(true);
        }}
      >
        <span className="home-glossary__icon">
          <IconCards size={22} />
        </span>
        <span className="home-glossary__text">
          <span className="home-page__title">Glossaire</span>
          <span className="home-page__subtitle">
            Toutes les cartes et leurs effets
          </span>
        </span>
        <IconArrowRight size={16} />
      </button>
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
