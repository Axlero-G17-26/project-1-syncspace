import React, { useState, useEffect, useRef } from "react";
import * as Y from "yjs";
import { motion, AnimatePresence } from "motion/react";
import { Stroke, Point, User, ActivityLog } from "./types";
import RoomSelector from "./components/RoomSelector";
import Whiteboard from "./components/Whiteboard";
import CodeEditor from "./components/CodeEditor";
import ActivityLogs from "./components/ActivityLogs";
import { 
  Users, 
  Copy, 
  Check, 
  ExternalLink, 
  Wifi, 
  WifiOff, 
  LogOut,
  Sparkles,
  HelpCircle,
  FileCode
} from "lucide-react";

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
  const [session, setSession] = useState<{ roomId: string; userName: string; userColor: string } | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [connStatus, setConnStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const currentUserIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const yDocRef = useRef<Y.Doc>(new Y.Doc());

  // Detect and join room automatically if URL has a roomId already
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      // Prompt selector handles pre-loading the room ID; user just supplies name.
    }
  }, []);

  // Set up WebSocket and CRDT document when user signs in and session is active
  useEffect(() => {
    if (!session) return;

    const { roomId, userName, userColor } = session;
    const userId = currentUserIdRef.current;
    const yDoc = yDocRef.current;

    const connectWebSocket = () => {
      setConnStatus("connecting");
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;

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
            userId
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
    if (!session) return;
    handleSendMessage(`[action] ${message}`);
  };

  // Handle URL Room Copy
  const handleCopyLink = () => {
    if (!session) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${session.roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle Log out / Leave Room
  const handleLeaveRoom = () => {
    if (confirm("Are you sure you want to leave this workspace?")) {
      setSession(null);
      setStrokes([]);
      setLogs([]);
      setActiveUsers([]);
      // Reset Yjs doc text
      yDocRef.current = new Y.Doc();
      // Remove query param
      window.history.pushState({}, "", window.location.pathname);
    }
  };

  // Open active workspace in another window to test collaboration side-by-side
  const handleOpenTestWindow = () => {
    if (!session) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${session.roomId}`;
    window.open(url, "_blank");
  };

  // Screen landing selector if no active room is joined
  if (!session) {
    return <RoomSelector onJoin={(p) => {
      // Set query params in address bar so it's shareable
      window.history.pushState({}, "", `?room=${p.roomId}`);
      setSession(p);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden h-screen">
      
      {/* 1. Universal Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 shrink-0 flex items-center justify-between select-none shadow-md relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wide text-white">SHARED WORKSPACE</h1>
            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span>WORKSPACE ID:</span>
              <span className="text-indigo-400 font-bold bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                {session.roomId}
              </span>
            </p>
          </div>
        </div>

        {/* Sync Status Info */}
        <div className="hidden md:flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400" style={{ backgroundColor: session.userColor }} />
            <span>Editing as <strong style={{ color: session.userColor }}>{session.userName}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 rounded-full px-3 py-1 text-xs">
            {connStatus === "connected" ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">LIVE SYNCED</span>
              </>
            ) : connStatus === "connecting" ? (
              <>
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-indigo-400">CONNECTING...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="text-rose-400">OFFLINE</span>
              </>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-2">
          {/* Share Room Button */}
          <button
            id="share-room-btn"
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm border border-slate-700/60"
            title="Copy invitation link to clipboard"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{copiedLink ? "Link Copied!" : "Share Room"}</span>
          </button>

          {/* Simulate Client helper */}
          <button
            id="open-test-tab-btn"
            type="button"
            onClick={handleOpenTestWindow}
            className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 bg-slate-800/40 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer shadow-sm border border-slate-800"
            title="Open side-by-side browser window to test"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Test Parallel Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHowTo(!showHowTo)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            title="Help / Guidelines"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-6 bg-slate-800 mx-1" />

          {/* Leave Workspace Button */}
          <button
            id="leave-room-btn"
            type="button"
            onClick={handleLeaveRoom}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
            title="Leave Workspace"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Leave</span>
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
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
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
                  <span>Tip: Click "Test Parallel Sync" to open a side-by-side tab and watch it auto-merge live!</span>
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
            onSendStroke={handleSendStroke}
            onClearBoard={handleClearBoard}
            onSendCursor={handleSendCursor}
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
    </div>
  );
}
