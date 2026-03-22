import { useState, useMemo } from "react";
import type { UserInventory } from "../../services/user.service";
import type { OpeningTarget } from "../opening/OpeningModal";
import SearchBar from "../../components/Searchbar";
import "./OwnerBundleList.css";

interface OwnBundleListProps {
  bundles: UserInventory["bundles"]["data"];
  onOpen?: (target: OpeningTarget) => void;
}

export default function OwnBundleList({ bundles, onOpen }: OwnBundleListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return bundles;
    return bundles.filter((b) =>
      b.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [bundles, search]);

  return (
    <div className="own-bundlelist">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Rechercher un bundle..."
      />
      <span className="own-bundlelist__result-count">
        {filtered.length} bundle{filtered.length > 1 ? "s" : ""}
        {filtered.length !== bundles.length && ` sur ${bundles.length}`}
      </span>
      {filtered.length === 0 ? (
        <p className="own-bundlelist__empty">Aucun bundle trouvé.</p>
      ) : (
        <div className="own-bundlelist__list">
          {filtered.map((b) => (
            <div key={b.id} className="inv-row">
              <span className="inv-row__name">{b.name}</span>
              <span className="inv-row__meta">{b.price} gold</span>
              <span className="inv-row__qty">×{b.quantity}</span>
              {onOpen && b.quantity > 0 && (
                <button
                  className="inv-row__open-btn"
                  onClick={() =>
                    onOpen({ type: "bundle", id: b.id, name: b.name })
                  }
                >
                  Ouvrir
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
