import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { questService } from "../services/quest.service";
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
  const [tab, setTab] = useState<Tab>("collection");
  const [isPrivate, setIsPrivate] = useState(false);

  const {
    data: profile,
    isLoading: l1,
    isError,
  } = useQuery({
    queryKey: ["myStats"],
    queryFn: () => userService.getMyStats(),
  });

  const { data: inventory, isLoading: l2 } = useQuery({
    queryKey: ["myInventory"],
    queryFn: () => userService.getMyInventory(),
  });

  const { data: quests, isLoading: l3 } = useQuery({
    queryKey: ["myQuests"],
    queryFn: () => questService.getMyQuests(),
  });

  const { data: collection, isLoading: l4 } = useQuery({
    queryKey: ["myCollection"],
    queryFn: () => userService.getMyCollection(),
  });
  const queryClient = useQueryClient();
  const loading = l1 || l2 || l3 || l4;

  useEffect(() => {
    if (profile) setIsPrivate(profile.isPrivate);
  }, [profile]);

  const handleTogglePrivacy = async () => {
    if (!profile) return;
    const res = await userService.togglePrivacy(profile.id);
    setIsPrivate(res.isPrivate);
  };

  if (loading) return <Loading message="Chargement du profil..." />;
  if (isError)
    return (
      <div className="profile-state profile-state--error">
        Impossible de charger le profil
      </div>
    );
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
      {tab === "collection" && (
        <CollectionPanel
          inventory={inventory}
          collection={collection ?? null}
        />
      )}
      {tab === "stats" && <StatsPanel stats={profile.stats} />}
      <QuestsPanel
        quests={quests}
        onQuestsUpdate={() =>
          queryClient.invalidateQueries({ queryKey: ["myQuests"] })
        }
      />
    </div>
  );
}
