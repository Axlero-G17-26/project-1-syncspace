import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ActivityLog, User } from "../types";
import { Send, Users, Activity, MessageSquare } from "lucide-react";

interface ActivityLogsProps {
  logs: ActivityLog[];
  activeUsers: User[];
  onSendMessage: (text: string) => void;
}

export default function ActivityLogs({
  logs,
  activeUsers,
  onSendMessage
}: ActivityLogsProps) {
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs on new items
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    onSendMessage(messageText.trim());
    setMessageText("");
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 h-64 shrink-0 flex flex-col overflow-hidden text-slate-300">
      {/* Tab panel header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800/60 select-none">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Team Activity & Chat</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-400 font-semibold">{activeUsers.length} online</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 divide-x divide-slate-800/40">
        {/* Active team members side bar */}
        <div className="w-40 bg-slate-900/45 p-3 overflow-y-auto space-y-2 select-none">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Connected</span>
          <div className="space-y-1.5">
            {activeUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/40 transition-colors">
                {/* Colored accent avatar ring */}
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-xs font-medium text-slate-300 truncate max-w-[100px]" title={user.name}>
                  {user.name}
                </span>
                {/* Typing or drawing indicator if currently active */}
                {user.cursor?.element && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title={`Active on ${user.cursor.element}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic scrollable stream */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950/20">
          <div 
            ref={scrollRef}
            className="flex-1 p-3.5 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-800"
          >
            <AnimatePresence initial={false}>
              {logs.map((log) => {
                const isSystemLog = !log.userName;
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-2 text-xs font-sans leading-relaxed"
                  >
                    {/* Timestamp */}
                    <span className="text-[10px] font-mono text-slate-600 pt-0.5 shrink-0 select-none">
                      {log.timestamp}
                    </span>

                    {isSystemLog ? (
                      <span className="text-indigo-400 font-normal italic">
                        {log.text}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-x-1.5 items-baseline">
                        <span 
                          className="font-bold shrink-0 text-[11px]" 
                          style={{ color: log.userColor }}
                        >
                          {log.userName}:
                        </span>
                        <span className="text-slate-200 font-normal">
                          {log.text}
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Chat Message Input form */}
          <form 
            onSubmit={handleSend}
            className="p-2 border-t border-slate-800/60 bg-slate-900/50 flex gap-2"
          >
            <input
              type="text"
              required
              maxLength={200}
              placeholder="Send coordination message to room..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold shadow shadow-indigo-950/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
