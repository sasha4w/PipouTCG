import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
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
      <Button
        variant="ghost-bordeaux"
        active={selectedTab === "buy"}
        className="marketplace-tab"
        onClick={() => onTabChange("buy")}
      >
        {t("marketplace.tabs.buy")}
      </Button>
      <Button
        variant="ghost-bordeaux"
        active={selectedTab === "sell"}
        className="marketplace-tab"
        onClick={() => onTabChange("sell")}
      >
        {t("marketplace.tabs.sell")}
      </Button>
    </div>
  );
};

export default MarketplaceTabs;
