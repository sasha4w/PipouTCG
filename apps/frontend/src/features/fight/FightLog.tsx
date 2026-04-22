import "./FightLog.css";

interface Props {
  log: string[];
}

export default function FightLog({ log }: Props) {
  return (
    <div className="flog-box">
      {[...log].reverse().map((entry, i) => (
        <div key={i} className="flog-entry" style={{ opacity: 1 - i * 0.06 }}>
          {entry}
        </div>
      ))}
    </div>
  );
}
