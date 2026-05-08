import { useTranslation } from "react-i18next";
import "./MarketplaceTabs.css";

interface MarketplaceTabsProps {
  selectedTab: "buy" | "sell";
  onTabChange: (tab: "buy" | "sell") => void;
}

const MarketplaceTabs = ({
  selectedTab,
  onTabChange,
}: MarketplaceTabsProps) => {
  const { t } = useTranslation();
  return (
    <div className="marketplace-tabs">
      <button
        className={`marketplace-tab ${selectedTab === "buy" ? "marketplace-tab--active" : ""}`}
        onClick={() => onTabChange("buy")}
      >
        {t("marketplace.tabs.buy")}
      </button>
      <button
        className={`marketplace-tab ${selectedTab === "sell" ? "marketplace-tab--active" : ""}`}
        onClick={() => onTabChange("sell")}
      >
        {t("marketplace.tabs.sell")}
      </button>
    </div>
  );
};

export default MarketplaceTabs;
