import type { ReactNode } from "react";

export interface HoleOption<V extends string> {
  value: V;
  label: string;
}

export function SelectHole<V extends string>({
  value,
  options,
  onChange,
  label,
  emptyLabel,
}: {
  value: V | undefined;
  options: HoleOption<V>[];
  onChange: (v: V | undefined) => void;
  label: string;
  /** Si fourni, ajoute une entrée vide qui efface la valeur. */
  emptyLabel?: string;
}) {
  return (
    <select
      className="hole"
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as V | undefined)}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function NumberHole({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  label: string;
}) {
  return (
    <input
      className="hole hole--number"
      type="number"
      aria-label={label}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
    />
  );
}

export function TextHole({
  value,
  onChange,
  label,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  label: string;
}) {
  return (
    <input
      className="hole hole--text"
      type="text"
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}

export function Word({ children }: { children: ReactNode }) {
  return <span className="effect-word">{children}</span>;
}
