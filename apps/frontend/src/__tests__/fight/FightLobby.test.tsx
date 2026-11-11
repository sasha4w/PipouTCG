import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FightLobby from "../../features/fight/FightLobby";
import "../../i18n";

const noop = vi.fn();

function renderFinished(ranked?: { elo: number; delta: number }) {
  render(
    <FightLobby
      status="finished"
      selectedDeck={1}
      opponentName="Bob"
      userId={1}
      winner={ranked && ranked.delta < 0 ? 2 : 1}
      endReason="surrender"
      ranked={ranked}
      onJoinQueue={noop}
      onLeaveQueue={noop}
      onSubmitDeck={noop}
      onReplay={noop}
      onPlayAi={noop}
    />,
  );
}

describe("FightLobby — fin de partie", () => {
  it("affiche le nouvel ELO et le gain après une victoire", () => {
    renderFinished({ elo: 1016, delta: 16 });
    expect(screen.getByText("1016")).toBeInTheDocument();
    expect(screen.getByText("+16")).toHaveClass("lobby-elo__delta--up");
  });

  it("affiche la perte avec un signe moins après une défaite", () => {
    renderFinished({ elo: 984, delta: -16 });
    expect(screen.getByText("−16")).toHaveClass("lobby-elo__delta--down");
  });

  it("n'affiche pas de classement quand le serveur n'en envoie pas", () => {
    renderFinished();
    expect(screen.queryByText("ELO")).not.toBeInTheDocument();
  });
});
