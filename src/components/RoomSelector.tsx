import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Users, ArrowRight, Code, Palette } from "lucide-react";

interface RoomSelectorProps {
  onJoin: (params: { roomId: string; userName: string; userColor: string }) => void;
}

const PRESET_COLORS = [
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export default function RoomSelector({ onJoin }: RoomSelectorProps) {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userColor, setUserColor] = useState(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);

  useEffect(() => {
    // Auto-populate roomId if present in URL
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setRoomId(roomParam);
    } else {
      // Suggest a random clean room ID
      const randId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(randId);
    }

    // Auto-populate custom nickname from local storage if existing
    const savedName = localStorage.getItem("collab_user_name");
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId.trim()) return;

    localStorage.setItem("collab_user_name", userName.trim());
    onJoin({
      roomId: roomId.trim().toUpperCase(),
      userName: userName.trim(),
      userColor
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Workspace Portal
          </h1>
          <p className="text-slate-400 text-sm">
            Draw and write code side-by-side with your team. Updates are automatically synced and merged.
          </p>
        </div>

        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="userName" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Your Nickname
              </label>
              <input
                id="userName"
                type="text"
                required
                maxLength={20}
                placeholder="Enter nickname..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Choose Avatar Accent
              </label>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setUserColor(color)}
                    className="w-8 h-8 rounded-full border-2 transition-all relative shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: color,
                      borderColor: userColor === color ? "#FFFFFF" : "transparent"
                    }}
                  >
                    {userColor === color && (
                      <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="roomId" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Room Workspace ID
              </label>
              <input
                id="roomId"
                type="text"
                required
                maxLength={12}
                placeholder="Enter or create room ID..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm uppercase"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer text-sm"
            >
              <span>Enter Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shared Board</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-pink-400" />
            <span>Smart Editor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instant Sync</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
