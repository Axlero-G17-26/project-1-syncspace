import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Stroke, Point, User } from "../types";
import { 
  Pen, 
  Square, 
  Trash2, 
  Undo2, 
  Download, 
  MousePointer2, 
  Maximize2,
  Info
} from "lucide-react";

interface WhiteboardProps {
  strokes: Stroke[];
  activeUsers: User[];
  currentUserId: string;
  userName: string;
  userColor: string;
  onSendStroke: (stroke: Stroke) => void;
  onClearBoard: () => void;
  onSendCursor: (cursor: { x: number; y: number; element: "whiteboard" }) => void;
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
  onSendStroke,
  onClearBoard,
  onSendCursor
}: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<"pen" | "eraser">("pen");
  const [brushColor, setBrushColor] = useState("#F59E0B"); // Amber default
  const [brushWidth, setBrushWidth] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 450 });
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Track temporary drawing stroke locally for smooth latency-free render
  const currentPointsRef = useRef<Point[]>([]);

  // 1. Monitor parent container size with ResizeObserver to adapt canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // Prevent zero size errors
      const newWidth = Math.max(width, 300);
      const newHeight = Math.max(height, 300);
      
      setCanvasSize({ width: newWidth, height: newHeight });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Perform canvas drawing cycle when strokes or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background (dark grid pattern style)
    ctx.fillStyle = "#0f172a"; // Slate-900 background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid dots
    ctx.fillStyle = "rgba(148, 163, 184, 0.07)"; // Slate-400 with opacity
    const gridSize = 25;
    for (let x = 0; x < canvas.width; x += gridSize) {
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw all completed strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === "eraser" ? "#0f172a" : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Scale drawings dynamically if canvas sizing varies (stored as ratio or raw)
      // For simplicity and high accuracy, we draw standard relative scale points
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);

      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      ctx.stroke();
    });

    // Draw active drawing stroke if drawing
    if (isDrawing && currentPointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentTool === "eraser" ? "#0f172a" : brushColor;
      ctx.lineWidth = brushWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const firstPoint = currentPointsRef.current[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);

      for (let i = 1; i < currentPointsRef.current.length; i++) {
        const p = currentPointsRef.current[i];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      ctx.stroke();
    }
  }, [strokes, canvasSize, isDrawing, brushColor, brushWidth, currentTool]);

  // Handle coordinates mapping
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Normalized points from 0.0 to 1.0 so they sync perfectly regardless of users' screen resolutions!
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  // 3. User interaction events
  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent default scrolling on mobile touches
    if ("touches" in e) {
      e.preventDefault();
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    currentPointsRef.current = [coords];

    // Emit initial cursor position
    onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      // Just moving mouse (hover) - track cursor location for presence display
      const coords = getCanvasCoords(e);
      if (coords && !("touches" in e)) {
        onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });
      }
      return;
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    currentPointsRef.current = [...currentPointsRef.current, coords];
    onSendCursor({ x: coords.x, y: coords.y, element: "whiteboard" });

    // Request animation frame updates via canvas repaint
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
    }
    
    currentPointsRef.current = [];
  };

  const handleClearBoard = () => {
    if (confirmClear) {
      onClearBoard();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Reset confirmation state
    }
  };

  const handleLocalUndo = () => {
    // Find last stroke owned by current user
    const lastUserStrokeIdx = [...strokes].reverse().findIndex(s => s.userId === currentUserId);
    if (lastUserStrokeIdx !== -1) {
      const actualIdx = strokes.length - 1 - lastUserStrokeIdx;
      // Filter out that stroke
      const updatedStrokes = strokes.filter((_, idx) => idx !== actualIdx);
      // We trigger clear + rebuild in real world, but let's notify room if possible.
      // For this high fidelity app, the server handles undo by resetting room or clients.
      // Since whiteboard history is standard, a quick clear-and-resubmit acts as undo.
      // Let's broadcast whiteboard clear + send remaining strokes!
      onClearBoard();
      updatedStrokes.forEach(s => onSendStroke(s));
    }
  };

  // Export board as PNG file
  const handleExportBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary link
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden select-none" id="whiteboard-container">
      {/* 1. Whiteboard Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border-b border-slate-800 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-1.5">
          {/* Pen Tool */}
          <button
            id="tool-pen"
            type="button"
            onClick={() => setCurrentTool("pen")}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              currentTool === "pen" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            }`}
            title="Pen Tool"
          >
            <Pen className="w-4 h-4" />
          </button>
          
          {/* Eraser Tool */}
          <button
            id="tool-eraser"
            type="button"
            onClick={() => setCurrentTool("eraser")}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              currentTool === "eraser" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            }`}
            title="Eraser Tool"
          >
            <Square className="w-4 h-4 fill-transparent border-slate-400" />
          </button>

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
                title={`${width.name} thickness`}
              >
                {width.name}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette (disabled when eraser is active) */}
        {currentTool === "pen" && (
          <div className="flex items-center gap-1.5 bg-slate-950/40 px-2 py-1 rounded-lg border border-slate-800/60 overflow-x-auto max-w-[200px] sm:max-w-none scrollbar-none">
            {BRUSH_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBrushColor(color)}
                className="w-5.5 h-5.5 rounded-full border border-slate-950 transition-all cursor-pointer hover:scale-110 active:scale-95 shrink-0 flex items-center justify-center"
                style={{ backgroundColor: color }}
                title={color}
              >
                {brushColor === color && (
                  <span className="w-1.5 h-1.5 bg-slate-950 rounded-full mix-blend-difference" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Action Panel: Undo, Export, Clear */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            id="action-undo"
            type="button"
            onClick={handleLocalUndo}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            title="Undo last stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            id="action-export"
            type="button"
            onClick={handleExportBoard}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            title="Export as PNG"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            id="action-clear"
            type="button"
            onClick={handleClearBoard}
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-xs font-medium ${
              confirmClear 
                ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse" 
                : "text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
            }`}
            title="Clear entire whiteboard"
          >
            <Trash2 className="w-4 h-4" />
            {confirmClear && <span>Confirm?</span>}
          </button>
        </div>
      </div>

      {/* 2. Interactive Canvas Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full bg-slate-950 relative overflow-hidden"
      >
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
          className="absolute inset-0 block cursor-crosshair"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Live cursors for other users */}
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
                <MousePointer2
                  className="w-4.5 h-4.5 drop-shadow-md"
                  style={{
                    color: user.color,
                    fill: user.color,
                    transform: "rotate(-10deg) translate(-2px, -2px)"
                  }}
                />
                <span 
                  className="absolute left-4 top-2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow text-white font-sans truncate max-w-[100px] border border-white/10"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name}
                </span>
              </div>
            );
          })}

        {/* Floating status / helper message */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-800 text-[11px] text-slate-400 py-1.5 px-3 rounded-lg flex items-center gap-1.5 pointer-events-none">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>Draw with fine controls. Everyone sees updates instantly!</span>
        </div>
      </div>
    </div>
  );
}
