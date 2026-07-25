import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Stroke, Point, User } from "../types";

interface WhiteboardProps {
  strokes: Stroke[];
  activeUsers: User[];
  currentUserId: string;
  userName: string;
  userColor: string;
  isWhiteboardLocked?: boolean;
  isInterviewer?: boolean;
  onSendStroke: (stroke: Stroke) => void;
  onSendUpdatedStrokes: (strokes: Stroke[]) => void;
  onClearBoard: () => void;
  onSendCursor: (cursor: { x: number; y: number; element: "whiteboard" }) => void;
  onLockBoard?: () => void;
  onUnlockBoard?: () => void;
}

const BRUSH_COLORS = [
  "#F8FAFC", // White/Slate-50
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
];

const BRUSH_WIDTHS = [
  { name: "Fine", value: 3 },
  { name: "Medium", value: 6 },
  { name: "Bold", value: 12 },
  { name: "Jumbo", value: 24 }
];

export default function Whiteboard({
  strokes,
  activeUsers,
  currentUserId,
  userName,
  userColor,
  isWhiteboardLocked,
  isInterviewer,
  onSendStroke,
  onSendUpdatedStrokes,
  onClearBoard,
  onSendCursor,
  onLockBoard,
  onUnlockBoard
}: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<"pen" | "eraser" | "circle" | "rectangle">("pen");
  const [brushColor, setBrushColor] = useState("#F59E0B"); // Amber default
  const [brushWidth, setBrushWidth] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 450 });
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Replay feature state
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [forceRender, setForceRender] = useState(0);
  
  const currentPointsRef = useRef<Point[]>([]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      const newWidth = Math.max(width, 300);
      const newHeight = Math.max(height, 300);
      setCanvasSize({ width: newWidth, height: newHeight });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "rgba(148, 163, 184, 0.07)";
    const gridSize = 25;
    for (let x = 0; x < canvas.width; x += gridSize) {
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    const visibleStrokes = isReplayMode ? strokes.slice(0, replayIndex) : strokes;

    visibleStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === "eraser" ? "#0f172a" : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "circle" || stroke.tool === "rectangle") {
        const firstPoint = stroke.points[0];
        const lastPoint = stroke.points[stroke.points.length - 1];
        const x = firstPoint.x * canvas.width;
        const y = firstPoint.y * canvas.height;
        const endX = lastPoint.x * canvas.width;
        const endY = lastPoint.y * canvas.height;
        const w = endX - x;
        const h = endY - y;
        
        if (stroke.tool === "rectangle") {
          ctx.strokeRect(x, y, w, h);
        } else if (stroke.tool === "circle") {
          const r = Math.sqrt(w*w + h*h);
          ctx.arc(x, y, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        const firstPoint = stroke.points[0];
        ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
        }
        ctx.stroke();
      }
    });

    if (!isReplayMode && isDrawing && currentPointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentTool === "eraser" ? "#0f172a" : brushColor;
      ctx.lineWidth = brushWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentTool === "circle" || currentTool === "rectangle") {
        const firstPoint = currentPointsRef.current[0];
        const lastPoint = currentPointsRef.current[currentPointsRef.current.length - 1];
        const x = firstPoint.x * canvas.width;
        const y = firstPoint.y * canvas.height;
        const endX = lastPoint.x * canvas.width;
        const endY = lastPoint.y * canvas.height;
        const w = endX - x;
        const h = endY - y;
        
        if (currentTool === "rectangle") {
          ctx.strokeRect(x, y, w, h);
        } else if (currentTool === "circle") {
          const r = Math.sqrt(w*w + h*h);
          ctx.arc(x, y, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        const firstPoint = currentPointsRef.current[0];
        ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
        for (let i = 1; i < currentPointsRef.current.length; i++) {
          const p = currentPointsRef.current[i];
          ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
        }
        ctx.stroke();
      }
    }
  }, [strokes, canvasSize, isDrawing, brushColor, brushWidth, currentTool, isReplayMode, replayIndex, forceRender]);

  useEffect(() => {
    if (!isPlaying || !isReplayMode) return;
    const intervalMs = Math.max(40, 600 / playbackSpeed);
    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= strokes.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isPlaying, isReplayMode, playbackSpeed, strokes.length]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStartDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReplayMode) return;
    if (!isInterviewer && isWhiteboardLocked) return;
    
    if ("touches" in e) {
      e.preventDefault();
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    currentPointsRef.current = [coords];
    onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });
  };

  const handleDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReplayMode) return;
    
    if (!isDrawing) {
      const coords = getCanvasCoords(e);
      if (coords && !("touches" in e)) {
        onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });
      }
      return;
    }

    if (!isInterviewer && isWhiteboardLocked) {
      setIsDrawing(false);
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    currentPointsRef.current = [...currentPointsRef.current, coords];
    onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });

    // Request animation frame updates for pen/eraser
    if (currentTool === "pen" || currentTool === "eraser") {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx && currentPointsRef.current.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = currentTool === "eraser" ? "#0f172a" : brushColor;
          ctx.lineWidth = brushWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          const points = currentPointsRef.current;
          const prev = points[points.length - 2];
          const curr = points[points.length - 1];

          ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
          ctx.lineTo(curr.x * canvas.width, curr.y * canvas.height);
          ctx.stroke();
        }
      }
    } else {
      // Force whole canvas render cycle to preview dragging shape
      setForceRender(prev => prev + 1);
    }
  };

  const handleStopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length >= 1) {
      const newStroke: Stroke = {
        id: Math.random().toString(36).substring(7),
        points: currentPointsRef.current,
        color: brushColor,
        width: brushWidth,
        tool: currentTool,
        userId: currentUserId,
        userName
      };
      
      onSendStroke(newStroke);
      setRedoStack([]); // Clear redo stack on new action
    }
    
    currentPointsRef.current = [];
  };

  const handleClearBoard = () => {
    if (confirmClear) {
      if (isInterviewer) {
        onClearBoard(); // Interviewer clears everyone's strokes
      } else {
        // Candidate only clears their own strokes
        const remainingStrokes = strokes.filter(s => s.userId !== currentUserId);
        onSendUpdatedStrokes(remainingStrokes);
      }
      setRedoStack([]);
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const handleLocalUndo = () => {
    const lastUserStrokeIdx = [...strokes].reverse().findIndex(s => s.userId === currentUserId);
    if (lastUserStrokeIdx !== -1) {
      const actualIdx = strokes.length - 1 - lastUserStrokeIdx;
      const strokeToUndo = strokes[actualIdx];
      const updatedStrokes = strokes.filter((_, idx) => idx !== actualIdx);
      onSendUpdatedStrokes(updatedStrokes);
      setRedoStack(prev => [...prev, strokeToUndo]);
    }
  };

  const handleLocalRedo = () => {
    if (redoStack.length > 0) {
      const strokeToRedo = redoStack[redoStack.length - 1];
      onSendStroke(strokeToRedo);
      setRedoStack(prev => prev.slice(0, -1));
    }
  };

  const handleExportBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const hideTools = !isInterviewer && isWhiteboardLocked;

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden select-none" id="whiteboard-container">
      {/* 1. Whiteboard Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border-b border-slate-800 shrink-0 z-10 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {!hideTools && (
            <>
              <button
                onClick={() => setCurrentTool("pen")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-semibold tracking-widest uppercase ${
                  currentTool === "pen" 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                Pen
              </button>
              
              <button
                onClick={() => setCurrentTool("circle")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-semibold tracking-widest uppercase ${
                  currentTool === "circle" 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                Circle
              </button>

              <button
                onClick={() => setCurrentTool("rectangle")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-semibold tracking-widest uppercase ${
                  currentTool === "rectangle" 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                Rectangle
              </button>

              {isInterviewer && (
                <button
                  onClick={() => setCurrentTool("eraser")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-semibold tracking-widest uppercase ${
                    currentTool === "eraser" 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  Eraser
                </button>
              )}

              <div className="h-6 w-[1px] bg-slate-800 mx-1" />

              {/* Preset Brush Widths */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                {BRUSH_WIDTHS.map((width) => (
                  <button
                    key={width.value}
                    type="button"
                    onClick={() => setBrushWidth(width.value)}
                    className={`px-2 py-1 text-[10px] font-medium rounded transition-all cursor-pointer ${
                      brushWidth === width.value
                        ? "bg-slate-800 text-indigo-400"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {width.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {isInterviewer && (
            <>
              {!hideTools && <div className="h-6 w-[1px] bg-slate-800 mx-1" />}
              <button
                onClick={() => isWhiteboardLocked ? onUnlockBoard?.() : onLockBoard?.()}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-semibold tracking-widest uppercase border ${
                  isWhiteboardLocked 
                    ? "bg-red-950/30 text-red-400 border-red-900/50 hover:bg-red-900/40" 
                    : "text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/30"
                }`}
              >
                {isWhiteboardLocked ? "Unlock Board" : "Lock Board"}
              </button>
            </>
          )}
        </div>

        {!hideTools && currentTool !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-slate-950/40 px-2 py-1 rounded-lg border border-slate-800/60 overflow-x-auto max-w-[200px] sm:max-w-none scrollbar-none">
            {BRUSH_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBrushColor(color)}
                className="w-5.5 h-5.5 rounded-full border border-slate-950 transition-all cursor-pointer hover:scale-110 active:scale-95 shrink-0 flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                {brushColor === color && (
                  <span className="w-1.5 h-1.5 bg-slate-950 rounded-full mix-blend-difference" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Action Panel: Replay, Undo, Export, Clear - Nicely aligned to right */}
        <div className="flex items-center gap-2 ml-auto shrink-0 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/60">
          <button
            onClick={() => {
              const nextReplay = !isReplayMode;
              setIsReplayMode(nextReplay);
              if (nextReplay) setReplayIndex(strokes.length);
              else setIsPlaying(false);
            }}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer text-[10px] font-semibold tracking-wider uppercase ${
              isReplayMode ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {isReplayMode ? "Exit Replay" : "Replay"}
          </button>
          
          {!hideTools && (
            <>
              <div className="w-[1px] h-4 bg-slate-800" />

              <button
                onClick={handleLocalUndo}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Undo (Only removes your own strokes)"
              >
                <span className="text-[10px] font-bold tracking-widest uppercase">Undo</span>
              </button>

              <button
                onClick={handleLocalRedo}
                disabled={redoStack.length === 0}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                  redoStack.length > 0 ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-slate-600 cursor-not-allowed"
                }`}
                title="Redo"
              >
                <span className="text-[10px] font-bold tracking-widest uppercase">Redo</span>
              </button>
            </>
          )}

          <div className="w-[1px] h-4 bg-slate-800" />

          <button
            onClick={handleExportBoard}
            className="px-3 py-1.5 rounded-md transition-all cursor-pointer text-[10px] font-semibold tracking-wider uppercase text-slate-400 hover:text-slate-200"
          >
            Export
          </button>

          {!hideTools && (
            <>
              <div className="w-[1px] h-4 bg-slate-800" />

              <button
                onClick={handleClearBoard}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  confirmClear ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
                title={isInterviewer ? "Clear Board" : "Clear My Drawings"}
              >
                {confirmClear ? "Confirm" : "Clear"}
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full bg-slate-950 relative overflow-hidden">
        <canvas
          id="whiteboard-canvas"
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleStartDrawing}
          onMouseMove={handleDraw}
          onMouseUp={handleStopDrawing}
          onMouseLeave={handleStopDrawing}
          onTouchStart={handleStartDrawing}
          onTouchMove={handleDraw}
          onTouchEnd={handleStopDrawing}
          className={`absolute inset-0 block ${!isInterviewer && isWhiteboardLocked ? "cursor-not-allowed opacity-80" : "cursor-crosshair"}`}
          style={{ width: "100%", height: "100%" }}
        />

        {!isInterviewer && isWhiteboardLocked && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/80 backdrop-blur-md border border-red-500/30 text-red-400 px-6 py-3 rounded-2xl shadow-xl z-20 pointer-events-none flex flex-col items-center">
            <span className="text-sm font-bold uppercase tracking-widest mb-1">Board Locked</span>
            <span className="text-[10px] text-slate-400">The interviewer has paused drawing.</span>
          </div>
        )}

        {activeUsers
          .filter((user) => user.id !== currentUserId && user.cursor && user.cursor.element === "whiteboard")
          .map((user) => {
            const cursor = user.cursor!;
            return (
              <div
                key={user.id}
                className="absolute pointer-events-none transition-all duration-75 select-none z-30"
                style={{
                  left: `${cursor.x * canvasSize.width}px`,
                  top: `${cursor.y * canvasSize.height}px`,
                }}
              >
                <span className="text-xl leading-none" style={{ color: user.color }}>↗</span>
                <span 
                  className="absolute left-4 top-2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow text-white font-sans truncate max-w-[100px] border border-white/10"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name}
                </span>
              </div>
            );
          })}

        {isReplayMode && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-md border border-slate-800/80 px-5 py-3 rounded-2xl flex flex-col gap-2 w-[90%] max-w-lg shadow-2xl select-none z-30 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
              <span className="text-indigo-400 font-bold uppercase tracking-wider">Replay Mode</span>
              <span>
                Stroke {replayIndex} of {strokes.length}
                {replayIndex > 0 && strokes[replayIndex - 1] && (
                  <span className="text-emerald-400 font-medium">
                    {" "}(drawn by {strokes[replayIndex - 1].userName})
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (replayIndex >= strokes.length) setReplayIndex(0);
                  setIsPlaying(!isPlaying);
                }}
                className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-md shrink-0"
              >
                {isPlaying ? (
                  <span className="flex gap-1 justify-center items-center">
                    <span className="w-1 h-3.5 bg-white rounded-sm" />
                    <span className="w-1 h-3.5 bg-white rounded-sm" />
                  </span>
                ) : (
                  <span className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-0.5" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={strokes.length}
                value={replayIndex}
                onChange={(e) => {
                  setReplayIndex(Number(e.target.value));
                  if (isPlaying) setIsPlaying(false);
                }}
                className="flex-1 accent-indigo-500 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer border border-slate-800"
              />

              <div className="flex gap-1 items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg shrink-0">
                {([1, 2, 5, 10] as const).map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                      playbackSpeed === speed
                        ? "bg-slate-800 text-indigo-400"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-800 text-[11px] text-slate-400 py-1.5 px-3 rounded-lg flex items-center gap-1.5 pointer-events-none">
          <span className="text-indigo-400 font-bold">i</span>
          <span>{isReplayMode ? "Scrub timeline to review drawing evolution." : "Draw with fine controls. Everyone sees updates instantly!"}</span>
        </div>
      </div>
    </div>
  );
}
