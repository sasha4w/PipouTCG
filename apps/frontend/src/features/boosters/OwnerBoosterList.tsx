import { useState, useMemo } from "react";
import type { UserInventory } from "../../services/user.service";
import SearchBar from "../../components/Searchbar";
import "./OwnerBoosterList.css";

interface OwnBoosterListProps {
  boosters: UserInventory["boosters"]["data"];
}

export default function OwnBoosterList({ boosters }: OwnBoosterListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return boosters;
    return boosters.filter((b) =>
      b.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [boosters, search]);

  return (
    <div className="own-boosterlist">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Rechercher un booster..."
      />

      <span className="own-boosterlist__result-count">
        {filtered.length} booster{filtered.length > 1 ? "s" : ""}
        {filtered.length !== boosters.length && ` sur ${boosters.length}`}
      </span>

      {filtered.length === 0 ? (
        <p className="own-boosterlist__empty">Aucun booster trouvé.</p>
      ) : (
        <div className="own-boosterlist__list">
          {filtered.map((b) => (
            <div key={b.id} className="inv-row">
              <span className="inv-row__name">{b.name}</span>
              <span className="inv-row__meta">{b.price} gold</span>
              <span className="inv-row__qty">×{b.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
