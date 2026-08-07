import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X, AlertCircle, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-800 border border-red-500/30 rounded-xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Application Exception Caught</h1>
                <p className="text-sm text-slate-400">The UI encountered an unexpected error during rendering.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-700/50 font-mono text-xs overflow-x-auto space-y-2">
              <div className="text-red-400 font-semibold">
                {this.state.error?.name || 'Error'}: {this.state.error?.message}
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-slate-400 whitespace-pre-wrap text-[11px] leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {this.props.children}
      </>
    );
  }
}

export const ApiErrorBanner: React.FC = () => null;
