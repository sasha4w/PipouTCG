import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import Loading from "../components/Loading";
import CardSetManager from "../features/cards/CardSetManager";
import CardManager from "../features/cards/CardManager";
import BoosterManager from "../features/boosters/BoosterManager";
import BundleManager from "../features/bundles/BundleManager";
import QuestManager from "../features/quests/QuestManager";
import BannerManager from "../features/shop/BannerManager";
import "./Admin.css";

type AdminTab =
  | "cardsets"
  | "cards"
  | "boosters"
  | "bundles"
  | "quests"
  | "banners";

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "cardsets", label: "Card Sets", icon: "🗂" },
  { key: "cards", label: "Cartes", icon: "🃏" },
  { key: "boosters", label: "Boosters", icon: "📦" },
  { key: "bundles", label: "Bundles", icon: "🎁" },
  { key: "quests", label: "Quêtes", icon: "📋" },
  { key: "banners", label: "Bannières", icon: "🏷" },
];

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("cardsets");

  const { data: user, isLoading } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
  });

  if (isLoading) return <Loading message="Vérification des droits..." />;
  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard Admin</h1>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab-btn${tab === t.key ? " admin-tab-btn--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="admin-tab-btn__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "cardsets" && <CardSetManager />}
      {tab === "cards" && <CardManager />}
      {tab === "boosters" && <BoosterManager />}
      {tab === "bundles" && <BundleManager />}
      {tab === "quests" && <QuestManager />}
      {tab === "banners" && <BannerManager />}
    </div>
  );
}
