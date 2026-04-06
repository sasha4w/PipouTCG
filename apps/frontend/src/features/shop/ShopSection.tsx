import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bannerService } from "../../services/banner.service";
import { shopService } from "../../services/shop.service";
import BannerCard from "./BannerCard";
import { IconGold } from "../../components/Icons";
import "./ShopSection.css";

interface ShopItemCardProps {
  id: number;
  type: "BOOSTER" | "BUNDLE";
  name: string;
  meta: string;
  price: number;
  onBought?: (newBalance: number) => void;
}

function ShopItemCard({
  id,
  type,
  name,
  meta,
  price,
  onBought,
}: ShopItemCardProps) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);

  const handleBuy = async () => {
    if (quantity < 1) return;
    setBuying(true);
    setError("");
    try {
      const res =
        type === "BOOSTER"
          ? await shopService.buyBooster(id, quantity)
          : await shopService.buyBundle(id, quantity);
      onBought?.(res.newBalance);
    } catch {
      setError("Solde insuffisant");
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="shop-item">
      <div className="shop-item__icon">{type === "BOOSTER" ? "📦" : "🎁"}</div>
      <div className="shop-item__name">{name}</div>
      <div className="shop-item__meta">{meta}</div>
      <div className="shop-item__price">
        {price * quantity} <IconGold size={13} color="#7a4a00" />
      </div>

      <div className="shop-item__qty">
        <button
          className="shop-item__qty-btn"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={buying || quantity <= 1}
        >
          −
        </button>
        <input
          className="shop-item__qty-input"
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
          className="shop-item__qty-btn"
          onClick={() => setQuantity((q) => q + 1)}
          disabled={buying}
        >
          +
        </button>
      </div>

      {error && <span className="shop-item__error">{error}</span>}
      <button className="shop-item__btn" onClick={handleBuy} disabled={buying}>
        {buying ? `Achat ${quantity}x...` : `Acheter ×${quantity}`}
      </button>
    </div>
  );
}

interface ShopSectionProps {
  gold: number;
  onBalance?: (newBalance: number) => void;
}

export default function ShopSection({ gold, onBalance }: ShopSectionProps) {
  const queryClient = useQueryClient();

  const { data: banners = [], isLoading: l1 } = useQuery({
    queryKey: ["banners-active"],
    queryFn: () => bannerService.getActive(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: catalog, isLoading: l2 } = useQuery({
    queryKey: ["shop-catalog"],
    queryFn: () => shopService.getCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  const handleBought = (newBalance: number) => {
    queryClient.invalidateQueries({ queryKey: ["myStats"] });
    queryClient.invalidateQueries({ queryKey: ["myInventory"] });
    onBalance?.(newBalance);
  };

  const loading = l1 || l2;

  return (
    <div className="shop-section">
      <div className="shop-section__heading">
        <h2 className="shop-section__title">🛒 Boutique</h2>
        <span className="shop-section__gold">
          <IconGold size={14} color="#7a4a00" /> {gold.toLocaleString()}
        </span>
      </div>

      {/* Bannières limitées */}
      {banners.length > 0 && (
        <>
          <span className="shop-section__label">⚡ Offres limitées</span>
          <div className="shop-section__banners">
            {banners.map((b) => (
              <BannerCard key={b.id} banner={b} onBought={handleBought} />
            ))}
          </div>
        </>
      )}

      {/* Boosters permanents */}
      {!loading && catalog && (
        <>
          {catalog.boosters.length > 0 && (
            <>
              <span className="shop-section__label">Boosters</span>
              <div className="shop-section__grid">
                {catalog.boosters.map((b) => (
                  <ShopItemCard
                    key={b.id}
                    id={b.id}
                    type="BOOSTER"
                    name={b.name}
                    meta={`${b.cardNumber} cartes · ${b.cardSetName}`}
                    price={b.price}
                    onBought={handleBought}
                  />
                ))}
              </div>
            </>
          )}

          {catalog.bundles.length > 0 && (
            <>
              <span className="shop-section__label">Bundles</span>
              <div className="shop-section__grid">
                {catalog.bundles.map((b) => (
                  <ShopItemCard
                    key={b.id}
                    id={b.id}
                    type="BUNDLE"
                    name={b.name}
                    meta={`${b.contents.length} item(s)`}
                    price={b.price}
                    onBought={handleBought}
                  />
                ))}
              </div>
            </>
          )}

          {catalog.boosters.length === 0 &&
            catalog.bundles.length === 0 &&
            !banners.length && (
              <p className="shop-section__empty">Aucun article disponible.</p>
            )}
        </>
      )}

      {loading && <p className="shop-section__empty">Chargement...</p>}
    </div>
  );
}
