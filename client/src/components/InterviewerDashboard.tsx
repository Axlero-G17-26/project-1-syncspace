import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

import { localstore } from "../utils/localstore";

interface Evaluation {
  id?: string;
  roomId?: string;
  candidateName?: string;
  candidate?: string;
  criteria?: string;
  date: string;
  score: string;
  notes: string;
}

interface InterviewerDashboardProps {
  onJoin: (params: { roomId: string; userName: string; userColor: string }) => void;
  userName: string;
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#10B981", // Emerald
];

export default function InterviewerDashboard({ onJoin, userName }: InterviewerDashboardProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeRooms, setActiveRooms] = useState(() => localstore.getRooms());
  const [roomStats, setRoomStats] = useState<Record<string, { candidates: number }>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/stats`);
        if (res.ok) {
          const data = await res.json();
          setRoomStats(data);
        }
      } catch (err) {
        // Silently fail on network errors
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("syncspace_evaluations");
    if (saved) {
      setEvaluations(JSON.parse(saved));
    } else {
      const mockData: Evaluation[] = [
        { id: "1", candidateName: "Alex Chen", criteria: "Frontend React Developer", date: new Date().toLocaleDateString(), score: "8.5/10", notes: "Strong DS&A, good communication." },
        { id: "2", candidateName: "Sarah Jenkins", criteria: "Backend Node.js Developer", date: new Date(Date.now() - 86400000).toLocaleDateString(), score: "9/10", notes: "Excellent system design knowledge. Hire." },
        { id: "3", candidateName: "Michael Chang", criteria: "Fullstack Developer", date: new Date(Date.now() - 172800000).toLocaleDateString(), score: "6/10", notes: "Struggled with state management concepts." }
      ];
      setEvaluations(mockData);
      localStorage.setItem("syncspace_evaluations", JSON.stringify(mockData));
    }
  }, []);

  const handleUpdateNotes = (id: string, newNotes: string) => {
    const updated = evaluations.map(e => (e.id || e.roomId) === id ? { ...e, notes: newNotes } : e);
    setEvaluations(updated);
    localStorage.setItem("syncspace_evaluations", JSON.stringify(updated));
    if (selectedEval && (selectedEval.id || selectedEval.roomId) === id) {
      setSelectedEval({ ...selectedEval, notes: newNotes });
    }
  };

  const handleDeleteEval = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = evaluations.filter(ev => (ev.id || ev.roomId) !== id);
    setEvaluations(updated);
    localStorage.setItem("syncspace_evaluations", JSON.stringify(updated));
  };

  const handleCreateRoomAction = (e: React.FormEvent, action: 'create' | 'join' | 'schedule') => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    // Generate random 4 letter + 4 digit ID (e.g. ABCD-1234)
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let idLetters = "";
    for (let i = 0; i < 4; i++) {
      idLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    const idDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const newRoomId = `${idLetters}-${idDigits}`;

    // Add to active rooms
    const newRoom = { id: newRoomId, name: newRoomName.trim(), candidates: 0 };
    setActiveRooms(prev => [newRoom, ...prev]);
    localstore.addRoom(newRoom);
    
    // Close modal
    setShowCreateModal(false);
    setNewRoomName("");

    if (action === 'join') {
      onJoin({
        roomId: newRoomId,
        userName: userName || "Interviewer",
        userColor: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
      });
    } else if (action === 'schedule') {
      const link = `${window.location.origin}/?room=${newRoomId}`;
      navigator.clipboard.writeText(link).catch(() => {});
      // Small delay for UI response
      setTimeout(() => alert(`Session Created!\nInvitation Link copied to clipboard:\n${link}`), 100);
    }
  };

  const handleJoinExisting = (roomId: string) => {
    onJoin({
      roomId,
      userName: userName || "Interviewer",
      userColor: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    });
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center pt-24 px-6 relative z-10 font-sans">
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-white mb-2">Create New Session</h3>
              <p className="text-sm text-zinc-400 mb-6">Enter the candidate's name or a descriptive title for this interview session. A secure 8-character ID will be generated automatically.</p>
              
              <form onSubmit={(e) => handleCreateRoomAction(e, 'join')} className="flex flex-col gap-4">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. John Doe - Frontend Assessment"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    type="submit"
                    className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm transition-colors cursor-pointer"
                  >
                    Create & Join Now
                  </button>
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={(e) => handleCreateRoomAction(e, 'create')}
                      className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
                    >
                      Create Only
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCreateRoomAction(e, 'schedule')}
                      className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
                    >
                      Create & Schedule
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full mt-2 px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl w-full max-w-lg flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedEval.candidate || selectedEval.candidateName || "Unknown Candidate"}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{selectedEval.criteria || "No Reason Provided"}</p>
                </div>
                <div className="bg-indigo-900/40 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-indigo-300 font-bold tracking-widest text-sm">
                  {selectedEval.score}
                </div>
              </div>
              
              <div className="h-px w-full bg-zinc-800" />
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Date of Session</span>
                <span className="text-sm text-zinc-300">{new Date(selectedEval.date).toLocaleString()}</span>
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Interviewer Notes</span>
                <textarea
                  value={selectedEval.notes}
                  onChange={(e) => handleUpdateNotes(selectedEval.id || selectedEval.roomId || "", e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded p-4 text-sm text-zinc-300 h-32 resize-none focus:outline-none focus:border-indigo-500 transition-colors w-full"
                  placeholder="One line description is MUST..."
                />
              </div>
              
              <button
                onClick={() => setSelectedEval(null)}
                className="w-full mt-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-sm tracking-widest uppercase transition-colors cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl flex flex-col gap-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Interviewer Dashboard</h2>
            <p className="text-sm text-zinc-400">Manage your technical assessments and candidate evaluations.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold tracking-widest uppercase text-xs transition-colors shrink-0 cursor-pointer"
          >
            Create New Session
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Active Rooms Column */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Active Sessions</h3>
            <div className="flex flex-col gap-3">
              {activeRooms.map(room => (
                <div key={room.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded flex flex-col gap-3">
                  <div className="flex flex-col">
                    <span className="text-zinc-200 font-semibold truncate" title={room.name}>{room.name}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-indigo-400 text-[11px] font-bold tracking-widest">{room.id}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${((roomStats[room.id]?.candidates) || 0) > 0 ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-zinc-600"}`}></div>
                        <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400">
                          {roomStats[room.id]?.candidates || 0} Waiting
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinExisting(room.id)}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold tracking-widest uppercase rounded transition-colors cursor-pointer"
                  >
                    Join
                  </button>
                </div>
              ))}
              {activeRooms.length === 0 && (
                <div className="text-zinc-500 text-sm italic">No active sessions.</div>
              )}
            </div>
          </div>

          {/* Evaluations Column */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Recent Evaluations</h3>
            <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/50">
                    <th className="px-4 py-3 font-semibold text-zinc-400 text-xs tracking-wider uppercase">Candidate</th>
                    <th className="px-4 py-3 font-semibold text-zinc-400 text-xs tracking-wider uppercase">Reason</th>
                    <th className="px-4 py-3 font-semibold text-zinc-400 text-xs tracking-wider uppercase">Score</th>
                    <th className="px-4 py-3 font-semibold text-zinc-400 text-xs tracking-wider uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {evaluations.map(evalData => (
                    <tr 
                      key={evalData.id || evalData.roomId} 
                      onClick={() => setSelectedEval(evalData)}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-4 text-zinc-200 font-medium whitespace-nowrap">
                        {evalData.candidate || evalData.candidateName || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-zinc-500 text-xs whitespace-nowrap truncate max-w-[150px]">
                        {evalData.criteria || "N/A"}
                      </td>
                      <td className="px-4 py-4 text-indigo-400 font-bold whitespace-nowrap">
                        {evalData.score}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={(e) => handleDeleteEval(evalData.id || evalData.roomId || "", e)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer inline-flex"
                          title="Delete Session"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {evaluations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 text-sm italic">
                        No past sessions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
