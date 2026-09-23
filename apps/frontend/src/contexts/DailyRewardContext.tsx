import { createContext, useContext } from "react";

interface DailyRewardContextType {
  openModal: () => void;
}

export const DailyRewardContext = createContext<DailyRewardContextType>({
  openModal: () => {},
});

export const useDailyReward = () => useContext(DailyRewardContext);
