import React from "react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center selection:bg-indigo-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-6">
        {/* Logo container box */}
        <div className="w-80 h-32 flex items-center justify-center border border-slate-800/40 bg-slate-900/40 backdrop-blur-md rounded-2xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <span className="text-slate-500 font-mono text-xs tracking-widest animate-pulse">
            PREPARING CANVAS...
          </span>
        </div>

        {/* Static Progress Info */}
        <div className="flex flex-col items-center space-y-2">
          <span className="text-4xl font-extrabold tracking-tighter text-white font-mono">
            0%
          </span>
          <span className="text-slate-400 text-xs font-medium tracking-wide">
            Initializing SyncSpace environment
          </span>
        </div>
      </div>
    </div>
  );
}
