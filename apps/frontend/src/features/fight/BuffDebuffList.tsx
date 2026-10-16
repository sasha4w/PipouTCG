import { useEffect, useRef } from "react";
import BuffDebuffSections, { type BuffEntry } from "./BuffDebuffSections";
import "./BuffDebuffList.css";

export type { BuffEntry };

interface Props {
  entries: BuffEntry[];
  cardName: string;
  supportType?: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function BuffDebuffList({
  entries,
  cardName,
  supportType,
  anchorRect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const above = spaceBelow < 220;

  return (
    <div
      ref={ref}
      className="bdl-popup"
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: above ? anchorRect.top - 8 : anchorRect.bottom + 8,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      {/* ── Header ── */}
      <div className="bdl-header">
        <span className="bdl-card-name">{cardName}</span>
        {supportType && <span className="bdl-type-chip">{supportType}</span>}
      </div>

      <BuffDebuffSections entries={entries} />
    </div>
  );
}
