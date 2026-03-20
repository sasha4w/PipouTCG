import { useEffect, useState } from "react";
import { cardSetService } from "../services/card-set.service";
import type { CardSet } from "../services/card-set.service";
import { soundService } from "../services/sound.service";
import Loading from "./Loading";
import "./CardSetList.css";

function colorFromId(id: number): string {
  const hue = (id * 137.508) % 360;
  return `hsl(${hue}, 45%, 62%)`;
}

interface CardSetCardProps {
  set: CardSet;
  index: number;
  onClick: () => void;
}

function CardSetCard({ set, index, onClick }: CardSetCardProps) {
  const color = colorFromId(set.id);
  const delay = `${index * 0.06}s`;

  return (
    <article
      className="csl-card"
      style={
        { "--card-color": color, animationDelay: delay } as React.CSSProperties
      }
      onClick={() => {
        soundService.play("select");
        onClick();
      }}
    >
      <div className="csl-card__inner">
        <div className="csl-card__dots" />
        <div className="csl-card__icon">✦</div>
        <div className="csl-card__name">{set.name}</div>
        <div className="csl-card__label">Card Set #{set.id}</div>
      </div>
    </article>
  );
}

interface CardSetListProps {
  onSelectSet: (id: number, name: string) => void;
}

export default function CardSetList({ onSelectSet }: CardSetListProps) {
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));
    Promise.all([cardSetService.findAll(1, 20), minDelay])
      .then(([res]) => setSets(res.data))
      .catch(() => setError("Impossible de charger les sets"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Chargement des sets..." />;
  if (error) return <div className="csl-state csl-state--error">{error}</div>;
  if (sets.length === 0)
    return <div className="csl-state">Aucun set disponible.</div>;

  return (
    <div className="csl-grid">
      {sets.map((set, i) => (
        <CardSetCard
          key={set.id}
          set={set}
          index={i}
          onClick={() => onSelectSet(set.id, set.name)}
        />
      ))}
    </div>
  );
}
