import { useEffect, useRef, useState } from "react";
import "./BuffDebuffList.css";

export interface BuffEntry {
  icon: string;
  label: string;
  type: "buff" | "debuff" | "neutral";
  /** "recap" = ligne stats calculée, "separator" = début de section accordion */
  variant?: "recap" | "separator";
}

interface Props {
  entries: BuffEntry[];
  cardName: string;
  supportType?: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

/** Découpe le tableau d'entrées en sections selon les separators */
function buildSections(entries: BuffEntry[]): {
  recap: BuffEntry[];
  sections: { title: string; items: BuffEntry[] }[];
} {
  const recap: BuffEntry[] = [];
  const sections: { title: string; items: BuffEntry[] }[] = [];
  let current: { title: string; items: BuffEntry[] } | null = null;

  for (const e of entries) {
    if (e.variant === "recap") {
      recap.push(e);
      continue;
    }
    if (e.variant === "separator") {
      if (current) sections.push(current);
      current = { title: e.label, items: [] };
      continue;
    }
    if (current) {
      current.items.push(e);
    } else {
      // Entrées avant le premier séparateur → section implicite
      if (sections.length === 0) {
        current = { title: "Effets", items: [e] };
      } else {
        sections[sections.length - 1].items.push(e);
      }
    }
  }
  if (current) sections.push(current);
  return { recap, sections };
}

export default function BuffDebuffList({
  entries,
  cardName,
  supportType,
  anchorRect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { recap, sections } = buildSections(entries);

  // Toutes les sections ouvertes par défaut sauf si plus de 2 sections
  const [openSections, setOpenSections] = useState<Set<number>>(
    () => new Set(),
  );

  const toggleSection = (idx: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

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

      {/* ── Récap stats (toujours visible, pas dans un accordion) ── */}
      {recap.length > 0 && (
        <div className="bdl-recap-block">
          {recap.map((e, i) => (
            <div key={i} className="bdl-recap-row">
              <span className="bdl-icon">{e.icon}</span>
              <span className="bdl-label bdl-label--recap">{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 || recap.length === entries.length ? (
        <div className="bdl-empty">Aucun effet</div>
      ) : (
        <div className="bdl-sections">
          {sections.map((section, sIdx) => {
            const isOpen = openSections.has(sIdx);
            const hasItems = section.items.length > 0;
            return (
              <div key={sIdx} className="bdl-section">
                <button
                  className={`bdl-section-header ${isOpen ? "bdl-section-header--open" : ""}`}
                  onClick={() => toggleSection(sIdx)}
                  disabled={!hasItems}
                >
                  <span className="bdl-section-title">
                    {section.title.startsWith("🔧")
                      ? section.title
                      : `◆ ${section.title}`}
                  </span>
                  {hasItems && (
                    <span className="bdl-section-chevron">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {isOpen && hasItems && (
                  <ul className="bdl-list">
                    {section.items.map((e, i) => (
                      <li key={i} className={`bdl-entry bdl-entry--${e.type}`}>
                        <span className="bdl-icon">{e.icon}</span>
                        <span className="bdl-label">{e.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
