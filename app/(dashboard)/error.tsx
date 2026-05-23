"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] p-6">
      <div className="max-w-md w-full bg-[#161b27] border border-red-800/40 rounded-2xl p-8 text-center space-y-4">
        <div className="text-red-400 text-4xl">⚠</div>
        <h2 className="text-white font-bold text-lg">Something crashed</h2>
        <p className="text-[#9ca3af] text-sm font-mono bg-[#0f1117] rounded-lg p-3 text-left break-all">
          {error.message || "Unknown error"}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
