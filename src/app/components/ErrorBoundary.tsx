"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { createModuleLogger } from "@/lib/logger";
import { env } from "@/config/env";

const logger = createModuleLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using structured logging
    logger.error({
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
    }, 'ErrorBoundary caught an error');
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full rounded-lg border border-destructive/50 bg-card p-6 shadow-lg">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <svg
                  className="h-6 w-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Something went wrong
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
                {env.NODE_ENV !== "production" && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
                      {this.state.error.toString()}
                      {this.state.error.stack && `\n\n${this.state.error.stack}`}
                    </pre>
                  </details>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={this.handleReset}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Try again
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Go home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
