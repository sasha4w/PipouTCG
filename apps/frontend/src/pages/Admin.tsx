import { useState } from "react";
import { Navigate } from "react-router-dom";
import { isAdmin } from "../utils/authUtils";
import CardSetManager from "../features/cards/CardSetManager";
import CardManager from "../features/cards/CardManager";
import BoosterManager from "../features/boosters/BoosterManager";
import BundleManager from "../features/bundles/BundleManager";
import "./Admin.css";

type AdminTab = "cardsets" | "cards" | "boosters" | "bundles";

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "cardsets", label: "Card Sets", icon: "🗂" },
  { key: "cards", label: "Cartes", icon: "🃏" },
  { key: "boosters", label: "Boosters", icon: "📦" },
  { key: "bundles", label: "Bundles", icon: "🎁" },
];

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("cardsets");

  // Redirection si pas admin
  if (!isAdmin()) return <Navigate to="/" replace />;

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
    </div>
  );
}
