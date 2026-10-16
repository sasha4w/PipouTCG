import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
}

/** Nombre qui monte de 0 à `value` à l'affichage (fixe si mouvements réduits). */
const CountUp = ({ value }: CountUpProps) => {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <>{reduceMotion ? value : shown}</>;
};

export default CountUp;
