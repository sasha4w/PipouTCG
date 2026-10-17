// src/components/Loading.tsx
import "./Loading.css";

interface LoadingProps {
  message?: string;
}

export default function Loading({ message = "Chargement..." }: LoadingProps) {
  return (
    <div className="loading">
      <img
        src="/logo-animated.gif"
        alt="Chargement..."
        width={200}
        height={200}
      />
      <p>{message}</p>
    </div>
  );
}
