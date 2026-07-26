import React, { useState, useEffect, useRef } from "react";
import * as Y from "yjs";
import { motion, AnimatePresence } from "motion/react";
import { Stroke, Point, User, ActivityLog } from "./types";
import RoomSelector from "./components/RoomSelector";
import Whiteboard from "./components/Whiteboard";
import CodeEditor from "./components/CodeEditor";
import Auth from "./components/Auth";
import SplashScreen from "./components/SplashScreen";
import ActivityLogs from "./components/ActivityLogs";
import InterviewerDashboard from "./components/InterviewerDashboard";
// No icons for typography-driven design

// Robust Uint8Array to Hex string converters for safe browser transit without Buffer
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem("syncspace_token"));
  const [authUser, setAuthUser] = useState<any>(() => {
    const saved = localStorage.getItem("syncspace_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [session, setSession] = useState<{ roomId: string; userName: string; userColor: string } | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [connStatus, setConnStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [showHowTo, setShowHowTo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isWhiteboardLocked, setIsWhiteboardLocked] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // End Session Evaluation States
  const [showEndSession, setShowEndSession] = useState(false);
  const [evalCandidate, setEvalCandidate] = useState("");
  const [evalCriteria, setEvalCriteria] = useState("");
  const [evalScore, setEvalScore] = useState("");
  const [evalNotes, setEvalNotes] = useState("");

  useEffect(() => {
    // Splash screen will now always show on refresh
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const socketRef = useRef<WebSocket | null>(null);
  const currentUserIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const yDocRef = useRef<Y.Doc>(new Y.Doc());

  // Detect and join room automatically if URL has a roomId already
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      // Room param exists, but auth flow will block it until authenticated
    }
  }, []);

  const handleLogin = (user: any, token: string) => {
    localStorage.setItem("syncspace_token", token);
    localStorage.setItem("syncspace_user", JSON.stringify(user));
    setAuthUser(user);
    setIsAuthenticated(true);
  };

  const handleAppLogout = () => {
    localStorage.removeItem("syncspace_token");
    localStorage.removeItem("syncspace_user");
    setAuthUser(null);
    setIsAuthenticated(false);
    setSession(null);
  };

  // Set up WebSocket and CRDT document when user signs in and session is active
  useEffect(() => {
    if (!session || !isAuthenticated) return;

    const { roomId, userName, userColor } = session;
    const userId = currentUserIdRef.current;
    const yDoc = yDocRef.current;

    const connectWebSocket = () => {
      setConnStatus("connecting");
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:5000`;

      console.log(`Connecting to real-time room websocket at ${wsUrl}...`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnStatus("connected");
        // Handshake join message
        socket.send(JSON.stringify({
          type: "join",
          payload: {
            roomId,
            userName,
            userColor,
            userId,
            role: authUser?.role || "candidate",
            adminToken: localStorage.getItem("syncspace_token")
          }
        }));

        // Add a local notification log
        addSystemLog(`Successfully connected to Room ${roomId} as ${userName}.`);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          switch (msg.type) {
            case "users:list": {
              setActiveUsers(msg.payload.users);
              break;
            }

            case "init:whiteboard": {
              setStrokes(msg.payload.strokes);
              break;
            }

            case "init:code": {
              // Apply Yjs document initialization chunk
              const { update } = msg.payload;
              if (update) {
                const updateBytes = hexToUint8Array(update);
                Y.applyUpdate(yDoc, updateBytes, "remote");
              }
              break;
            }

            case "whiteboard:stroke": {
              const { stroke } = msg.payload;
              setStrokes(prev => [...prev, stroke]);
              break;
            }

            case "whiteboard:clear": {
              setStrokes([]);
              break;
            }

            case "whiteboard:lock": {
              setIsWhiteboardLocked(true);
              break;
            }

            case "whiteboard:unlock": {
              setIsWhiteboardLocked(false);
              break;
            }

            case "whiteboard:sync_strokes": {
              const { strokes } = msg.payload;
              setStrokes(strokes);
              break;
            }

            case "room:kicked": {
              setIsKicked(true);
              break;
            }

            case "room:ended": {
              setSessionEnded(true);
              break;
            }

            case "code:update": {
              // Sync incoming Yjs byte updates
              const { update } = msg.payload;
              const updateBytes = hexToUint8Array(update);
              Y.applyUpdate(yDoc, updateBytes, "remote");
              break;
            }

            case "cursor:move": {
              // Update individual user cursor position inside state
              const { userId: remoteUserId, cursor } = msg.payload;
              setActiveUsers(prev => prev.map(user => {
                if (user.id === remoteUserId) {
                  return { ...user, cursor };
                }
                return user;
              }));
              break;
            }

            case "message:recv": {
              const chatLog = msg.payload;
              setLogs(prev => [...prev, chatLog]);
              break;
            }
          }
        } catch (err) {
          console.error("Error parsing incoming message:", err);
        }
      };

      socket.onclose = (event) => {
        setConnStatus("disconnected");
        console.warn("WebSocket closed. Attempting auto-reconnect in 3s...", event.reason);
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      };

      socket.onerror = (err) => {
        setConnStatus("disconnected");
        console.error("WebSocket connection error:", err);
      };
    };

    connectWebSocket();

    // Observe local edits on Yjs document and broadcast via Websocket
    const handleYDocUpdate = (update: Uint8Array, origin: any) => {
      // Guard sync loops: Only send local updates to server
      if (origin === "remote") return;

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const updateHex = uint8ArrayToHex(update);
        socket.send(JSON.stringify({
          type: "code:update",
          payload: {
            update: updateHex
          }
        }));
      }
    };

    yDoc.on("update", handleYDocUpdate);

    return () => {
      yDoc.off("update", handleYDocUpdate);
      socketRef.current?.close();
    };
  }, [session]);

  const addSystemLog = (text: string) => {
    const systemLog: ActivityLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      userName: "", // empty indicates system log
      userColor: "",
      text
    };
    setLogs(prev => [...prev, systemLog]);
  };

  // 1. Send strokes
  const handleSendStroke = (stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
    
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "whiteboard:stroke",
        payload: { stroke }
      }));
    }
  };

  // 2. Clear Board
  const handleClearBoard = () => {
    setStrokes([]);
    
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "whiteboard:clear"
      }));
    }
  };

  // 3. Send cursors
  const handleSendCursor = (cursor: any) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "cursor:move",
        payload: { cursor }
      }));
    }
  };

  // 4. Send custom messages / activity logs
  const handleSendMessage = (text: string) => {
    if (!session) return;
    
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "message:send",
        payload: {
          message: text,
          userName: session.userName,
          userColor: session.userColor
        }
      }));
    }
  };

  const handleSendActivityLog = (message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "message:send",
        payload: { message, userName: session.userName, userColor: session.userColor }
      }));
    }
  };

  const handleKickUser = (userId: string) => {
    if (socketRef.current?.readyState === 1) {
      socketRef.current.send(JSON.stringify({
        type: "room:kick",
        payload: { targetUserId: userId }
      }));
    }
  };

  const handleEndSessionClick = () => {
    const candidate = activeUsers.find(u => u.id !== currentUserIdRef.current);
    if (candidate) {
      setEvalCandidate(candidate.name);
    }
    setShowEndSession(true);
  };

  const handleEndSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save evaluation
    const newEval = {
      id: Math.random().toString(36).substring(7),
      candidateName: evalCandidate || "Unknown Candidate",
      date: new Date().toLocaleDateString(),
      score: evalScore,
      notes: `Criteria: ${evalCriteria}\nNotes: ${evalNotes}`
    };
    const saved = JSON.parse(localStorage.getItem("syncspace_evaluations") || "[]");
    localStorage.setItem("syncspace_evaluations", JSON.stringify([newEval, ...saved]));

    // Broadcast end session
    if (socketRef.current?.readyState === 1) {
      socketRef.current.send(JSON.stringify({ type: "room:end_session" }));
    }
    
    setShowEndSession(false);
    handleLeaveRoom();
  };

  const handleSendUpdatedStrokes = (updatedStrokes: Stroke[]) => {
    setStrokes(updatedStrokes);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "whiteboard:sync_strokes",
        payload: { strokes: updatedStrokes }
      }));
    }
  };

  // Handle URL Room Copy
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link");
    }
  };

  // Handle Log out / Leave Room
  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    setSession(null);
    setActiveUsers([]);
    setLogs([]);
    setIsWhiteboardLocked(false);
    setShowParticipants(false);
    setIsKicked(false);
    setSessionEnded(false);
    yDocRef.current.destroy();
    yDocRef.current = new Y.Doc();
    // Remove query param
    window.history.pushState({}, "", window.location.pathname);
  };


  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  // Screen landing selector if no active room is joined
  if (!session) {
    if (authUser?.role === "interviewer") {
      return (
        <div className="min-h-screen bg-[#0a0a0b] flex flex-col font-sans relative">
          <header className="absolute top-0 w-full p-6 flex justify-end z-20">
            <button
              onClick={handleAppLogout}
              className="text-[11px] font-semibold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </header>
          <InterviewerDashboard 
            userName={authUser.name}
            onJoin={(p) => {
              window.history.pushState({}, "", `?room=${p.roomId}`);
              setSession({ ...p, userName: authUser?.name || p.userName });
            }}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col font-sans relative">
        <header className="absolute top-0 w-full p-6 flex justify-end z-10">
          <button
            onClick={handleAppLogout}
            className="text-[11px] font-semibold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </header>
        <RoomSelector onJoin={(p) => {
          window.history.pushState({}, "", `?room=${p.roomId}`);
          setSession({ ...p, userName: authUser?.name || p.userName });
        }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden h-screen">
      
      {/* 1. Universal Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 shrink-0 flex items-center justify-between select-none shadow-md relative z-20">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white text-lg font-bold">S</span>
            </div>
            <h1 className="text-lg font-extrabold tracking-[0.15em] text-white hidden sm:block">SYNCSPACE</h1>
          </div>
          
          <div className="hidden md:flex flex-col border-l border-slate-700/50 pl-6 justify-center">
            <div className="flex items-center gap-3">
               <span className="text-sm font-bold text-slate-100 tracking-wide">{session.roomName || "Interview Session"}</span>
               <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 tracking-wider">
                 ID: {session.roomId}
               </span>
            </div>
          </div>
        </div>

        {/* Sync Status Info */}
        <div className="hidden md:flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400" style={{ backgroundColor: session.userColor }} />
            <span>Editing as <strong style={{ color: session.userColor }}>{session.userName}</strong></span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium tracking-tight uppercase text-zinc-500">
            {connStatus === "connected" && <span className="text-emerald-500">Connected</span>}
            {connStatus === "connecting" && <span className="text-amber-500">Connecting...</span>}
            {connStatus === "disconnected" && <span className="text-red-500">Disconnected</span>}
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300">{activeUsers.length} Users</span>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-3">
          {authUser?.role === "interviewer" && (
            <div className="relative">
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className={`text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded transition-all flex items-center gap-2 cursor-pointer ${
                  showParticipants ? "bg-indigo-600 text-white" : "text-indigo-400 hover:text-white border border-indigo-500/50 hover:bg-indigo-500/20"
                }`}
              >
                People ({activeUsers.length})
              </button>
              
              <AnimatePresence>
                {showParticipants && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Active Participants
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {activeUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color }} />
                            <span className="text-sm font-medium text-slate-200 truncate max-w-[120px]">{u.name}</span>
                          </div>
                          {u.id !== currentUserIdRef.current && (
                            <button
                              onClick={() => {
                                handleKickUser(u.id);
                                setShowParticipants(false);
                              }}
                              className="text-[10px] font-bold text-red-400 hover:text-white hover:bg-red-500 px-2 py-1 rounded transition-colors uppercase tracking-wider cursor-pointer"
                            >
                              Kick
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {authUser?.role === "interviewer" && (
            <button
              onClick={handleEndSessionClick}
              className="text-[11px] font-semibold uppercase tracking-widest text-orange-400 hover:text-white border border-orange-500/50 hover:bg-orange-500/20 px-3 py-1.5 rounded transition-all cursor-pointer mr-1"
            >
              End Session
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400 hover:text-white border border-indigo-500/50 hover:bg-indigo-500/20 px-3 py-1.5 rounded transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>{copiedLink ? "Copied" : "Share"}</span>
          </button>
          <button
            onClick={handleLeaveRoom}
            className="text-[11px] font-semibold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors cursor-pointer ml-2"
          >
            Leave
          </button>
        </div>
      </header>

      {/* 2. Help/How-To overlay bar with Parallel Sync Logic explained */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900/95 backdrop-blur-md border-b border-indigo-950/80 px-6 py-4 text-xs text-slate-300 relative z-10 overflow-hidden shadow-inner"
          >
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <span className="text-indigo-400 font-bold shrink-0">✨</span>
                  <span>How Parallel Sync Works</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  When multiple people edit code or draw at the same time, we don't lock your screen or overwrite your work. Instead, every keystroke and stroke is broken into small, individual pieces of digital puzzle.
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  When these pieces arrive on other screens, our intelligent sync engine automatically stitches them together in the exact same mathematical order. Think of it like a smart highway merge where cars smoothly interlock without any collisions. The result is a fully synced, conflict-free workspace for everyone!
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-indigo-300/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHowTo(false)}
                className="py-1.5 px-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-all self-end md:self-center shrink-0"
              >
                Close Guide
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Main Split-Screen Workspace Board Layout */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row relative">
        {/* Left Panel: Whiteboard Container */}
        <section className="flex-1 min-w-0 h-1/2 md:h-full flex flex-col relative" aria-label="Interactive Whiteboard">
          <Whiteboard
            strokes={strokes}
            activeUsers={activeUsers}
            currentUserId={currentUserIdRef.current}
            userName={session.userName}
            userColor={session.userColor}
            isWhiteboardLocked={isWhiteboardLocked}
            isInterviewer={authUser?.role === "interviewer"}
            onSendStroke={handleSendStroke}
            onSendUpdatedStrokes={handleSendUpdatedStrokes}
            onClearBoard={handleClearBoard}
            onSendCursor={handleSendCursor}
            onLockBoard={() => socketRef.current?.send(JSON.stringify({ type: "whiteboard:lock" }))}
            onUnlockBoard={() => socketRef.current?.send(JSON.stringify({ type: "whiteboard:unlock" }))}
          />
        </section>

        {/* Right Panel: Live Code Editor Container */}
        <section className="flex-1 min-w-0 h-1/2 md:h-full flex flex-col relative border-t md:border-t-0 md:border-l border-slate-800" aria-label="Collaborative Code Editor">
          <CodeEditor
            yDoc={yDocRef.current}
            activeUsers={activeUsers}
            currentUserId={currentUserIdRef.current}
            userName={session.userName}
            userColor={session.userColor}
            onSendCursor={handleSendCursor}
            onSendActivityLog={handleSendActivityLog}
          />
        </section>
      </main>

      {/* 4. Bottom Section: Live Activity Logs and Message Stream */}
      <footer className="shrink-0 select-none">
        <ActivityLogs
          logs={logs}
          activeUsers={activeUsers}
          onSendMessage={handleSendMessage}
        />
      </footer>
      {isKicked && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-4 border-red-500/20">
              <span className="text-4xl">🚪</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-wide">Session Terminated</h2>
              <p className="text-slate-400 text-sm">
                You have been removed from this session by the Interviewer. 
              </p>
            </div>
            <button
              onClick={() => {
                setIsKicked(false);
                handleLeaveRoom();
              }}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer uppercase tracking-widest text-sm"
            >
              Return to Home
            </button>
          </motion.div>
        </div>
      )}

      {sessionEnded && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-orange-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(249,115,22,0.15)] flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center border-4 border-orange-500/20">
              <span className="text-4xl">🏁</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-wide">Interview Ended</h2>
              <p className="text-slate-400 text-sm">
                The Interviewer has successfully concluded this session.
              </p>
            </div>
            <button
              onClick={() => {
                setSessionEnded(false);
                handleLeaveRoom();
              }}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer uppercase tracking-widest text-sm"
            >
              Return to Home
            </button>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {showEndSession && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">End Session & Evaluate</h3>
                <button 
                  onClick={() => setShowEndSession(false)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleEndSessionSubmit} className="p-6 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Candidate Name</label>
                    <input
                      type="text"
                      value={evalCandidate}
                      onChange={e => setEvalCandidate(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="bg-slate-950 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marks/Score</label>
                    <input
                      type="text"
                      value={evalScore}
                      onChange={e => setEvalScore(e.target.value)}
                      placeholder="e.g. 8.5/10"
                      className="bg-slate-950 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evaluation Criteria</label>
                  <input
                    type="text"
                    value={evalCriteria}
                    onChange={e => setEvalCriteria(e.target.value)}
                    placeholder="e.g. Problem Solving, Communication, Code Quality"
                    className="bg-slate-950 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interview Notes</label>
                  <textarea
                    value={evalNotes}
                    onChange={e => setEvalNotes(e.target.value)}
                    placeholder="Enter detailed feedback here..."
                    className="bg-slate-950 border border-slate-700 text-white text-sm rounded px-3 py-2 h-24 resize-none outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEndSession(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded transition-colors cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded transition-colors cursor-pointer text-sm"
                  >
                    Submit & End
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Final review complete