// ─────────────────────────────────────────────
// 🗂️ COMPOSANT : MarketplaceTabs
// ─────────────────────────────────────────────
interface MarketplaceTabsProps {
  selectedTab: "buy" | "sell";
  onTabChange: (tab: "buy" | "sell") => void;
}
import "./MarketplaceTabs.css";
const MarketplaceTabs = ({
  selectedTab,
  onTabChange,
}: MarketplaceTabsProps) => {
  return (
    <div className="marketplace-tabs">
      <button
        className={`marketplace-tab ${selectedTab === "buy" ? "marketplace-tab--active" : ""}`}
        onClick={() => onTabChange("buy")}
      >
        Achat
      </button>
      <button
        className={`marketplace-tab ${selectedTab === "sell" ? "marketplace-tab--active" : ""}`}
        onClick={() => onTabChange("sell")}
      >
        Vente
      </button>
    </div>
  );
};

export default MarketplaceTabs;
