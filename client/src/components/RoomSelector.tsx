import React, { useState, useEffect } from "react";
import { motion } from "motion/react";

interface RoomSelectorProps {
  onJoin: (params: { roomId: string; userName: string; userColor: string }) => void;
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

export default function RoomSelector({ onJoin }: RoomSelectorProps) {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userColor, setUserColor] = useState(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  useEffect(() => {
    // Auto-populate roomId if present in URL
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    }

    // Auto-populate custom nickname from local storage if existing
    const savedName = localStorage.getItem("collab_user_name");
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId.trim()) return;

    setIsChecking(true);
    setCheckError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/check/${roomId.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.exists) {
          setCheckError("Session does not exist or has not been started yet.");
          setIsChecking(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not check room status:", err);
    }
    
    setIsChecking(false);

    localStorage.setItem("collab_user_name", userName.trim());
    onJoin({
      roomId: roomId.trim().toUpperCase(),
      userName: userName.trim(),
      userColor
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-6 selection:bg-indigo-500/30 font-sans">
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
            <span className="text-xl">⚡</span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Join Assessment</h1>
          <p className="text-zinc-400 text-[13px] text-center max-w-[280px]">
            Enter your details and the session ID provided by your interviewer.
          </p>
        </div>

        <div className="bg-transparent">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="userName" className="block text-[12px] font-medium text-zinc-400">
                Display Name
              </label>
              <input
                id="userName"
                type="text"
                required
                maxLength={20}
                placeholder="E.g. John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/50 rounded-xl text-zinc-100 placeholder-zinc-600 transition-all text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-zinc-400">
                Cursor Accent
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setUserColor(color)}
                    className="w-8 h-8 rounded-full transition-all relative flex items-center justify-center focus:outline-none"
                    style={{
                      backgroundColor: color,
                      boxShadow: userColor === color ? `0 0 0 2px #0a0a0b, 0 0 0 4px ${color}` : "none",
                      transform: userColor === color ? "scale(0.9)" : "scale(1)",
                      opacity: userColor === color ? 1 : 0.7
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label htmlFor="roomId" className="block text-[12px] font-medium text-zinc-400">
                Session ID
              </label>
              <input
                id="roomId"
                type="text"
                required
                maxLength={12}
                placeholder="XXXXXX"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value.toUpperCase());
                  setCheckError("");
                }}
                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/50 rounded-xl text-zinc-100 placeholder-zinc-600 font-mono transition-all text-sm uppercase tracking-widest"
              />
              {checkError && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="text-red-400 text-xs font-semibold mt-2"
                >
                  {checkError}
                </motion.p>
              )}
            </div>

            <button
              type="submit"
              disabled={isChecking}
              className="w-full mt-4 bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.1)]"
            >
              <span>{isChecking ? "Checking..." : "Connect to Session →"}</span>
            </button>
          </form>
        </div>

        <div className="mt-12 flex items-center justify-center gap-6 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span>Canvas</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span>Editor</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <span>0ms Sync</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}