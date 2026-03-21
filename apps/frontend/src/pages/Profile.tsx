import { useEffect, useState } from "react";
import { userService } from "../services/user.service";
import { questService } from "../services/quest.service";
import type { UserProfile, UserInventory } from "../services/user.service";
import type { UserQuestsGrouped } from "../services/quest.service";
import Loading from "../components/Loading";
import HeroCard from "../features/profile/HeroCard";
import StatsPanel from "../features/profile/StatsPanel";
import CollectionPanel from "../features/profile/CollectionPanel";
import QuestsPanel from "../features/profile/QuestsPanel";
import PrivacyButton from "../components/PrivacyButton";
import { IconCollection, IconStats } from "../components/Icons";
import "./Profile.css";

type Tab = "collection" | "stats";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventory, setInventory] = useState<UserInventory | null>(null);
  const [quests, setQuests] = useState<UserQuestsGrouped | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("collection");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.all([
      userService.getMyStats(),
      userService.getMyInventory(),
      questService.getMyQuests(),
      minDelay,
    ])
      .then(([profileData, inventoryData, questsData]) => {
        setProfile(profileData);
        setInventory(inventoryData);
        setQuests(questsData);
        setIsPrivate(profileData.isPrivate);
      })
      .catch(() => setError("Impossible de charger le profil"))
      .finally(() => setLoading(false));
  }, []);

  const handleTogglePrivacy = async () => {
    if (!profile) return;
    const res = await userService.togglePrivacy(profile.id);
    setIsPrivate(res.isPrivate);
  };

  if (loading) return <Loading message="Chargement du profil..." />;
  if (error)
    return <div className="profile-state profile-state--error">{error}</div>;
  if (!profile || !inventory || !quests) return null;

  return (
    <div className="profile-page">
      <HeroCard profile={profile} />

      <PrivacyButton isPrivate={isPrivate} onToggle={handleTogglePrivacy} />

      <div className="profile-tabs">
        <button
          className={`profile-tab-btn${tab === "collection" ? " profile-tab-btn--active" : ""}`}
          onClick={() => setTab("collection")}
        >
          <span className="profile-tab-btn__icon">
            <IconCollection
              size={22}
              color={tab === "collection" ? "#7a1c3b" : "#a08070"}
            />
          </span>
          Collection
        </button>
        <button
          className={`profile-tab-btn${tab === "stats" ? " profile-tab-btn--active" : ""}`}
          onClick={() => setTab("stats")}
        >
          <span className="profile-tab-btn__icon">
            <IconStats
              size={22}
              color={tab === "stats" ? "#7a1c3b" : "#a08070"}
            />
          </span>
          Statistiques
        </button>
      </div>

      {tab === "collection" && <CollectionPanel inventory={inventory} />}
      {tab === "stats" && <StatsPanel stats={profile.stats} />}

      <QuestsPanel quests={quests} onQuestsUpdate={setQuests} />
    </div>
  );
}
