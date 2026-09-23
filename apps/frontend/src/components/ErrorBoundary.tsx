import { Component, type ReactNode, type ErrorInfo } from "react";
import { logError, AppError } from "../utils/errors";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component
 * Catches React component errors and displays fallback UI
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console and monitoring service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Update state with error details
    this.setState({
      errorInfo,
    });

    // Create AppError instance and log it
    const appError = new AppError(error.message, {
      category: "Unknown",
      userFriendlyMessage:
        "Quelque chose s'est mal passé. Veuillez rafraîchir la page.",
      technicalDetails: `${error.toString()}\n${errorInfo.componentStack}`,
      originalError: error,
    });

    logError(appError);

    // In production, send to error tracking service (e.g., Sentry)
    // Example: window.Sentry?.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary-container">
            <div className="error-boundary-content">
              <div className="error-boundary-icon">⚠️</div>
              <h1 className="error-boundary-title">
                Oups! Une erreur s'est produite
              </h1>
              <p className="error-boundary-message">
                Nous nous excusons pour le désagrément. Veuillez rafraîchir la
                page ou réessayer.
              </p>

              {import.meta.env.DEV && this.state.error && (
                <details className="error-boundary-details">
                  <summary className="error-boundary-summary">
                    Détails techniques (DEV only)
                  </summary>
                  <pre className="error-boundary-stack">
                    {this.state.error.toString()}
                    {"\n\n"}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="error-boundary-actions">
                <button
                  onClick={this.handleReset}
                  className="error-boundary-button error-boundary-button-primary"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="error-boundary-button error-boundary-button-secondary"
                >
                  Accueil
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
