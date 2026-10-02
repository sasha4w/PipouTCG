import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../../components/Button";

describe("Button", () => {
  it("rend un bouton primary md de type button par défaut", () => {
    render(<Button>Acheter</Button>);
    const btn = screen.getByRole("button", { name: "Acheter" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("btn", "btn--primary", "btn--md");
    expect(btn).not.toHaveAttribute("aria-pressed");
  });

  it.each([
    "primary",
    "primary-inverse",
    "danger",
    "danger-inverse",
  ] as const)("applique la variante %s", (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass(`btn--${variant}`);
  });

  it.each(["ghost-gold", "ghost-bordeaux"] as const)(
    "applique la variante %s",
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole("button")).toHaveClass(`btn--${variant}`);
    },
  );

  it.each(["sm", "md", "lg"] as const)("applique la taille %s", (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass(`btn--${size}`);
  });

  it("applique la taille icon avec son aria-label", () => {
    render(
      <Button size="icon" aria-label="Fermer">
        <svg />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveClass(
      "btn--icon",
    );
  });

  it("accepte type submit", () => {
    render(<Button type="submit">Envoyer</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("pose aria-pressed et btn--active quand active est vrai", () => {
    render(
      <Button variant="ghost-gold" active>
        Tous
      </Button>,
    );
    const btn = screen.getByRole("button", { pressed: true });
    expect(btn).toHaveClass("btn--active");
  });

  it("pose aria-pressed=false sans btn--active quand active est faux", () => {
    render(
      <Button variant="ghost-bordeaux" active={false}>
        Vente
      </Button>,
    );
    const btn = screen.getByRole("button", { pressed: false });
    expect(btn).not.toHaveClass("btn--active");
  });

  it("ajoute btn--full avec fullWidth", () => {
    render(<Button fullWidth>x</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn--full");
  });

  it("ajoute la className après les classes du composant", () => {
    render(<Button className="shop-item__buy">x</Button>);
    expect(screen.getByRole("button").className).toBe(
      "btn btn--primary btn--md shop-item__buy",
    );
  });

  it("n'appelle pas onClick quand il est désactivé", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        x
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("appelle onClick quand il est actif", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>x</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("transmet la ref au <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("refuse les combinaisons interdites au typage", () => {
    // @ts-expect-error active n'existe que pour les variantes fantôme
    render(<Button variant="primary" active>x</Button>);
    // @ts-expect-error size="icon" exige aria-label
    render(<Button size="icon">x</Button>);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
