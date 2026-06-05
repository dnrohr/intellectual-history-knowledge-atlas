import * as React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  readonly props!: Readonly<ErrorBoundaryProps>;

  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Atlas UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0f] px-4 text-slate-200">
        <div className="w-full max-w-md rounded-md border border-[#252a3d] bg-[#0d1018] p-5 shadow-2xl shadow-black/40">
          <div className="font-mono text-[10px] uppercase tracking-wider text-rose-300">Atlas Recovery</div>
          <h1 className="mt-2 text-lg font-semibold text-white">The interface hit an unexpected error.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Reload the atlas to restore the workspace. Local review data is kept in browser storage unless it was explicitly cleared.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded border border-[#252a3d] bg-[#090b10] p-2 text-xs text-slate-500">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-3 py-2 text-sm font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20"
          >
            Reload Atlas
          </button>
        </div>
      </div>
    );
  }
}
