import type { SaleRole } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import { IconClose } from "../../../components/Icons";
import { MARKET_SCOPE, type SalesPlayer, type SalesScope } from "./salesScope";
import "./SalesFilterBar.css";

interface SalesFilterBarProps {
  scope: SalesScope;
  me: SalesPlayer | undefined;
  onChange: (scope: SalesScope) => void;
}

const ROLES: SaleRole[] = ["seller", "buyer", "both"];

const SalesFilterBar = ({ scope, me, onChange }: SalesFilterBarProps) => {
  const { t } = useTranslation();
  const player = scope.kind === "player" ? scope : null;
  const isMe = player !== null && player.player.id === me?.id;

  return (
    <div className="sales-filter" role="group" aria-label={t("marketplace.sales.filter_label")}>
      <div className="sales-filter__row">
        <Button
          variant="ghost-bordeaux"
          size="sm"
          active={scope.kind === "market"}
          onClick={() => onChange(MARKET_SCOPE)}
        >
          {t("marketplace.sales.scope_market")}
        </Button>
        <Button
          variant="ghost-bordeaux"
          size="sm"
          active={isMe}
          disabled={!me}
          onClick={() => me && onChange({ kind: "player", player: me, role: "both" })}
        >
          {t("marketplace.sales.scope_me")}
        </Button>
        {player && !isMe && (
          <Button
            variant="ghost-bordeaux"
            size="sm"
            active
            aria-label={t("marketplace.sales.clear_player", {
              name: player.player.username,
            })}
            onClick={() => onChange(MARKET_SCOPE)}
          >
            <IconClose size={12} className="sales-filter__clear-icon" />
            {player.player.username}
          </Button>
        )}
      </div>
      {player && (
        <div
          className="sales-filter__row sales-filter__row--roles"
          role="group"
          aria-label={t("marketplace.sales.role_label")}
        >
          {ROLES.map((role) => (
            <Button
              key={role}
              variant="ghost-bordeaux"
              size="sm"
              active={player.role === role}
              onClick={() => onChange({ ...player, role })}
            >
              {t(`marketplace.sales.role_${role}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesFilterBar;
