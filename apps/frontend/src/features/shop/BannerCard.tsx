import { useState, useEffect } from "react";
import type { Banner } from "../../services/banner.service";
import { bannerService } from "../../services/banner.service";
import { IconGold } from "../../components/Icons";
import "./BannerCard.css";

function useCountdown(endDate: string | null): string | null {
  const calc = () => {
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return "Expiré";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}j ${h}h restantes`;
    if (h > 0) return `${h}h ${m}min restantes`;
    return `${m}min restantes`;
  };

  const [label, setLabel] = useState<string | null>(calc);

  useEffect(() => {
    if (!endDate) return;
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
  const [quantity, setQuantity] = useState(1);
  const timer = useCountdown(banner.endDate);

  const handleBuy = async () => {
    if (quantity < 1) return;
    setBuying(true);
    setError("");
    try {
      const res = await bannerService.buy(banner.id, quantity);
      onBought?.(res.goldRemaining);
    } catch {
      setError("Solde insuffisant");
    } finally {
      setBuying(false);
    }
  };

  const hasDiscount = banner.bannerPrice < banner.originalPrice;
  const discount = hasDiscount
    ? Math.round((1 - banner.bannerPrice / banner.originalPrice) * 100)
    : 0;
  const totalPrice = banner.bannerPrice * quantity;

  return (
    <div className="banner-card">
      {banner.imageUrl && (
        <img className="banner-card__bg" src={banner.imageUrl} alt="" />
      )}

      {/* Ribbon positionné par rapport à .banner-card, pas __content */}
      {banner.isPermanent ? (
        <span
          className="banner-card__ribbon banner-card__ribbon--permanent"
          data-label="PERMANENT"
        />
      ) : hasDiscount ? (
        <span className="banner-card__ribbon" data-label={`-${discount}%`} />
      ) : null}

      <div className="banner-card__content">
        <div className="banner-card__title">{banner.title}</div>
        {banner.description && (
          <div className="banner-card__desc">{banner.description}</div>
        )}
        <div className="banner-card__prices">
          {hasDiscount && (
            <span className="banner-card__price-original">
              {banner.originalPrice * quantity}{" "}
              <IconGold size={11} color="rgba(255,255,255,0.4)" />
            </span>
          )}
          <span className="banner-card__price-banner">
            {totalPrice} <IconGold size={13} color="#eebc77" />
          </span>
        </div>
        <div className="banner-card__qty">
          <button
            className="banner-card__qty-btn"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={buying || quantity <= 1}
          >
            −
          </button>
          <input
            className="banner-card__qty-input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) setQuantity(v);
            }}
            disabled={buying}
          />
          <button
            className="banner-card__qty-btn"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={buying}
          >
            +
          </button>
        </div>
        {error && (
          <span style={{ fontSize: "0.7rem", color: "#f27aaa" }}>{error}</span>
        )}
        <button
          className="banner-card__btn"
          onClick={handleBuy}
          disabled={buying}
        >
          {buying ? "..." : `Acheter ×${quantity} — ${banner.itemName}`}
        </button>
        {timer && <span className="banner-card__timer">⏱ {timer}</span>}
      </div>
    </div>
  );
}
