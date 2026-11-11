import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import CardGlossary from "../features/glossary/CardGlossary";
import ShopSection from "../features/shop/ShopSection";
import DailyStreakWidget from "../components/DailyStreakWidget";
import OpeningModal, {
  type OpeningTarget,
} from "../features/opening/OpeningModal";
import OpeningQuickAccess from "../features/opening/OpeningQuickAccess";
import { IconArrowRight, IconCards, IconSwords } from "../components/Icons";
import StarterDeckButton from "../features/starter/StarterDeckButton";
import TutorialEntry from "../features/tutorial/TutorialEntry";
import { soundService } from "../services/sound.service";
import { QUERY_KEYS } from "../utils/querykeys";
import "./Home.css";

// ── Home ──────────────────────────────────────────────────────────────────────
const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Le glossaire vit dans l'URL : le bouton retour du téléphone le referme.
  const [searchParams, setSearchParams] = useSearchParams();
  const glossaryOpen = searchParams.get("view") === "glossary";
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
        <CardGlossary onBack={() => setSearchParams({}, { replace: true })} />
      </div>
    );
  }

  return (
    <div className="home-page">
      <button
        type="button"
        className="home-play"
        onClick={() => {
          soundService.play("select");
          navigate("/arena");
        }}
      >
        <span className="home-play__icon">
          <IconSwords size={24} />
        </span>
        <span className="home-glossary__text">
          <span className="home-play__title">{t("nav.play")}</span>
          <span className="home-play__subtitle">{t("nav.playSub")}</span>
        </span>
        <IconArrowRight size={18} />
      </button>
      <TutorialEntry />
      <StarterDeckButton />
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
          setSearchParams({ view: "glossary" });
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
