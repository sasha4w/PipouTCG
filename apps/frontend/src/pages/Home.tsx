import { useState } from "react";
import CardSetList from "../features/cards/CardSetList";
import CardList from "../features/cards/CardList";
import "./Home.css";

interface SelectedSet {
  id: number;
  name: string;
}

const Home = () => {
  const [selectedSet, setSelectedSet] = useState<SelectedSet | null>(null);

  return (
    <div className="home-page">
      {selectedSet ? (
        <CardList
          setId={selectedSet.id}
          setName={selectedSet.name}
          onBack={() => setSelectedSet(null)}
        />
      ) : (
        <>
          <div className="home-page__header">
            <h2 className="home-page__title">Sets de cartes</h2>
            <p className="home-page__subtitle">
              Explore tous les sets disponibles
            </p>
          </div>
          <CardSetList
            onSelectSet={(id, name) => setSelectedSet({ id, name })}
          />
        </>
      )}
    </div>
  );
};

export default Home;
