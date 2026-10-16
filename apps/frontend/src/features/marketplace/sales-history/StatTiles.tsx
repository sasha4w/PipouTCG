import CountUp from "./CountUp";
import "./StatTiles.css";

export interface StatTileData {
  key: string;
  label: string;
  /** Valeur animée ; null (sans `text`) → « — ». */
  value: number | null;
  /** Texte affiché à la place du compteur (fourchette, pourcentage, nom…). */
  text?: string;
  /** Suffixe du compteur, ex. " G". */
  unit?: string;
  /** Ligne secondaire sous la valeur. */
  caption?: string;
  tone?: "up" | "down";
  onClick?: () => void;
}

interface StatTilesProps {
  tiles: StatTileData[];
}

function renderValue(tile: StatTileData) {
  if (tile.text) return tile.text;
  if (tile.value === null) return "—";
  return (
    <>
      <CountUp value={tile.value} />
      {tile.unit}
    </>
  );
}

function renderTile(tile: StatTileData) {
  const className = `stat-tile${tile.tone ? ` stat-tile--${tile.tone}` : ""}${
    tile.onClick ? " stat-tile--clickable" : ""
  }`;
  const content = (
    <>
      <span className="stat-tile__label">{tile.label}</span>
      <span className="stat-tile__value">{renderValue(tile)}</span>
      {tile.caption && <span className="stat-tile__caption">{tile.caption}</span>}
    </>
  );
  return (
    <li key={tile.key}>
      {tile.onClick ? (
        <button type="button" className={className} onClick={tile.onClick}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

const StatTiles = ({ tiles }: StatTilesProps) => (
  <ul className="stat-tiles">{tiles.map(renderTile)}</ul>
);

export default StatTiles;
