import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { questService } from "../services/quest.service";
import CardSetList from "../features/cards/CardSetList";
import CardList from "../features/cards/CardList";
import ShopSection from "../features/shop/ShopSection";
import OpeningModal, {
  type OpeningTarget,
} from "../features/opening/OpeningModal";
import { IconBell } from "../components/Icons";
import "./Home.css";

interface SelectedSet {
  id: number;
  name: string;
}

// ── Résumé quêtes du jour ─────────────────────────────────────────────────────
function QuestSummary({ quests }: { quests: any }) {
  if (!quests) return null;
  const daily = quests.DAILY ?? [];
  if (daily.length === 0) return null;

  const pending = daily.filter((q: any) => !q.rewardClaimed);
  const claimable = daily.filter((q: any) => q.isCompleted && !q.rewardClaimed);

  return (
    <div className="home-quests">
      <div className="home-section__header">
        <h2 className="home-section__title">📋 Quêtes du jour</h2>
        {claimable.length > 0 && (
          <span className="home-quests__badge">
            <IconBell size={11} color="#3d1020" /> {claimable.length} à réclamer
          </span>
        )}
      </div>
      <div className="home-quests__list">
        {pending.slice(0, 3).map((q: any) => {
          const conds = q.progress?.conditions ?? [];
          const current = conds.reduce(
            (s: number, c: any) => s + (c.current ?? 0),
            0,
          );
          const target = conds.reduce(
            (s: number, c: any) => s + (c.target ?? 1),
            0,
          );
          const pct = Math.min(100, Math.round((current / target) * 100));
          return (
            <div
              key={q.id}
              className={`home-quest-item${q.isCompleted ? " home-quest-item--done" : ""}`}
            >
              <div className="home-quest-item__top">
                <span className="home-quest-item__title">{q.title}</span>
                <span className="home-quest-item__pct">{pct}%</span>
              </div>
              <div className="home-quest-item__bar">
                <div
                  className="home-quest-item__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {pending.length > 3 && (
          <span className="home-quests__more">
            +{pending.length - 3} quête(s)
          </span>
        )}
      </div>
    </div>
  );
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
  const { data: quests } = useQuery({
    queryKey: ["myQuests"],
    queryFn: () => questService.getMyQuests(),
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

      {/* ── Quêtes du jour ── */}
      <QuestSummary quests={quests} />

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
