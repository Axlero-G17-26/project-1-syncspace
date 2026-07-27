import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase sequence for HBO-style cinematic entry
    // 0: Initial black screen
    // 1: Axelero Solution (fade in)
    // 2: Axelero Solution (fade out)
    // 3: SyncSpace (fade in)
    // 4: SyncSpace (fade out)
    // 5: Complete (trigger onComplete)

    const timers = [
      setTimeout(() => setPhase(1), 500),    // Wait 0.5s, then show Axelero
      setTimeout(() => setPhase(2), 3000),   // Show Axelero for 2.5s, then fade out
      setTimeout(() => setPhase(3), 4000),   // Wait 1s, then show SyncSpace
      setTimeout(() => setPhase(4), 6500),   // Show SyncSpace for 2.5s, then fade out
      setTimeout(() => {
        setPhase(5);
        onComplete();
      }, 7500)                                // End sequence
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        {phase === 1 && (
          <motion.div
            key="axelero"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <h1 className="text-3xl md:text-5xl font-serif tracking-[0.2em] text-white/90 uppercase">
              Axlero Solutions
            </h1>
            <div className="w-12 h-[1px] bg-white/30 mt-4" />
          </motion.div>
        )}

        {phase === 3 && (
          <motion.div
            key="syncspace"
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <h1 className="text-4xl md:text-7xl font-extrabold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500">
              SYNCSPACE
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
