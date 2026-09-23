import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../../components/ErrorBoundary";

/**
 * Component that throws an error
 */
const ThrowError = () => {
  throw new Error("Test error");
};

/**
 * Normal component
 */
const SafeComponent = () => <div>Safe content</div>;

describe("ErrorBoundary", () => {
  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("should display error UI when child component throws", () => {
    // Suppress console.error for this test
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(/Oups! Une erreur s'est produite/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Veuillez rafraîchir la page/i)
    ).toBeInTheDocument();
  });

  it("should show error details in development mode", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Ensure we're in dev mode
    Object.defineProperty(import.meta, "env", {
      value: { DEV: true },
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const detailsElement = screen.getByText(/Détails techniques/i);
    expect(detailsElement).toBeInTheDocument();
  });

  it("should provide retry button", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const retryButton = screen.getByRole("button", { name: /Réessayer/i });
    expect(retryButton).toBeInTheDocument();
  });

  it("should provide home button", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const homeButton = screen.getByRole("button", { name: /Accueil/i });
    expect(homeButton).toBeInTheDocument();
  });
});
