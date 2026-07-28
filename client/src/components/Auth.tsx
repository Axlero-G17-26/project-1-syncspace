import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AuthProps {
  onLogin: (user: any, token: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [accessMode, setAccessMode] = useState<boolean>(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState(false);

  const handleSelectRole = (role: string) => {
    if (role === "interviewer") {
      setAccessMode(true);
      return;
    }
    
    // Candidate bypasses access key
    executeLogin("candidate");
  };

  const handleAccessKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessKey === "ADMIN123") {
      executeLogin("interviewer");
    } else {
      setError(true);
      setAccessKey("");
    }
  };

  const executeLogin = (role: string) => {
    const mockUser = {
      id: Math.random().toString(36).substring(2, 10),
      name: role === "interviewer" ? "Interviewer" : "Candidate",
      role: role
    };
    const tokenToPass = role === "interviewer" ? accessKey : "mock_frictionless_token_" + Date.now();
    onLogin(mockUser, tokenToPass);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center font-sans">
      <AnimatePresence mode="wait">
        {!accessMode ? (
          <motion.div
            key="role-selection"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-20">
              Who's joining?
            </h1>

            <div className="flex flex-col md:flex-row gap-12 md:gap-20">
              <button
                onClick={() => handleSelectRole("interviewer")}
                className="group flex flex-col items-center gap-8 focus:outline-none cursor-pointer"
              >
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-indigo-950/20 border-2 border-indigo-900/40 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-indigo-900/40 group-hover:border-indigo-500/80 group-hover:shadow-[0_0_40px_rgba(99,102,241,0.25)] group-focus:scale-110 group-focus:border-indigo-500/80">
                  <span className="text-6xl md:text-7xl transition-transform duration-300 group-hover:scale-110">🧑‍💻</span>
                </div>
                <span className="text-lg md:text-xl font-bold tracking-widest uppercase text-indigo-400/70 group-hover:text-indigo-300 group-focus:text-indigo-300 transition-colors">
                  Interviewer
                </span>
              </button>

              <button
                onClick={() => handleSelectRole("interviewee")}
                className="group flex flex-col items-center gap-8 focus:outline-none cursor-pointer"
              >
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-emerald-950/20 border-2 border-emerald-900/40 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-900/40 group-hover:border-emerald-500/80 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.25)] group-focus:scale-110 group-focus:border-emerald-500/80">
                  <span className="text-6xl md:text-7xl transition-transform duration-300 group-hover:scale-110">👨‍🎓</span>
                </div>
                <span className="text-lg md:text-xl font-bold tracking-widest uppercase text-emerald-400/70 group-hover:text-emerald-300 group-focus:text-emerald-300 transition-colors">
                  Candidate
                </span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="access-key"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center w-full max-w-sm"
          >
            <h2 className="text-xl font-medium text-white mb-6">Enter Access Key</h2>
            <form onSubmit={handleAccessKeySubmit} className="w-full flex flex-col gap-4">
              <input
                type="password"
                autoFocus
                value={accessKey}
                onChange={(e) => {
                  setAccessKey(e.target.value);
                  setError(false);
                }}
                placeholder="Key: ADMIN123"
                className={`w-full bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700'} rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors tracking-widest text-center`}
              />
              {error && <span className="text-red-500 text-xs text-center">Invalid access key</span>}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessMode(false);
                    setError(false);
                    setAccessKey("");
                  }}
                  className="flex-1 py-3 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
                >
                  Verify
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}