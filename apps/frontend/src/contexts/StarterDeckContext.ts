import { createContext, useContext } from "react";

interface StarterDeckContextType {
  /** Le starter est réclamable (non réclamé, 3 decks valides). */
  available: boolean;
  openModal: () => void;
}

export const StarterDeckContext = createContext<StarterDeckContextType>({
  available: false,
  openModal: () => {},
});

export const useStarterDeck = () => useContext(StarterDeckContext);
