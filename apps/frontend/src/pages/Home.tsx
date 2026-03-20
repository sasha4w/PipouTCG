import CardSetList from "../components/CardSetList";
import "./Home.css";

const Home = () => {
  return (
    <div className="home-page">
      <div className="home-page__header">
        <h2 className="home-page__title">Sets de cartes</h2>
        <p className="home-page__subtitle">Explore tous les sets disponibles</p>
      </div>
      <CardSetList />
    </div>
  );
};

export default Home;
