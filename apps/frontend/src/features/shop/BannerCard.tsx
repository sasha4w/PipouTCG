import { useState, useEffect } from "react";
import type { Banner } from "../../services/banner.service";
import { shopService } from "../../services/shop.service";
import { IconGold } from "../../components/Icons";
import "./BannerCard.css";

function useCountdown(endDate: string): string {
  const calc = () => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return "Expiré";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}j ${h}h restantes`;
    if (h > 0) return `${h}h ${m}min restantes`;
    return `${m}min restantes`;
  };

  const [label, setLabel] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setLabel(calc()), 60000);
    return () => clearInterval(id);
  }, [endDate]);
  return label;
}

interface BannerCardProps {
  banner: Banner;
  onBought?: (newBalance: number) => void;
}

export default function BannerCard({ banner, onBought }: BannerCardProps) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const timer = useCountdown(banner.endDate);

  const handleBuy = async () => {
    setBuying(true);
    setError("");
    try {
      const res = await shopService.buyBanner(banner.id);
      onBought?.(res.newBalance);
    } catch {
      setError("Solde insuffisant");
    } finally {
      setBuying(false);
    }
  };

  const discount = Math.round(
    (1 - banner.bannerPrice / banner.originalPrice) * 100,
  );

  return (
    <div className="banner-card">
      {banner.imageUrl && (
        <img className="banner-card__bg" src={banner.imageUrl} alt="" />
      )}

      <div className="banner-card__content">
        <span className="banner-card__badge">⚡ PROMO -{discount}%</span>

        <div className="banner-card__title">{banner.title}</div>
        {banner.description && (
          <div className="banner-card__desc">{banner.description}</div>
        )}

        <div className="banner-card__prices">
          <span className="banner-card__price-original">
            {banner.originalPrice}{" "}
            <IconGold size={11} color="rgba(255,255,255,0.4)" />
          </span>
          <span className="banner-card__price-banner">
            {banner.bannerPrice} <IconGold size={13} color="#eebc77" />
          </span>
        </div>

        {error && (
          <span style={{ fontSize: "0.7rem", color: "#f27aaa" }}>{error}</span>
        )}

        <button
          className="banner-card__btn"
          onClick={handleBuy}
          disabled={buying}
        >
          {buying ? "..." : `Acheter — ${banner.itemName}`}
        </button>

        <span className="banner-card__timer">⏱ {timer}</span>
      </div>
    </div>
  );
}
