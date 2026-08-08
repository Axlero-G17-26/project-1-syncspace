import { useState, useCallback, useRef } from 'react';
import type { WhiteboardTool } from '../utils/constants';

interface DrawEvent {
  tool: WhiteboardTool;
  points: number[];
  color: string;
  strokeWidth: number;
  userId: string;
  timestamp: number;
}

export function useWhiteboard() {
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<DrawEvent[]>([]);
  const isDrawing = useRef(false);

  const startDraw = useCallback(() => { isDrawing.current = true; }, []);

  const endDraw = useCallback(() => { isDrawing.current = false; }, []);

  const addEvent = useCallback((event: DrawEvent) => {
    setHistory(prev => [...prev, event]);
  }, []);

  const clearCanvas = useCallback(() => { setHistory([]); }, []);

  const undo = useCallback(() => {
    setHistory(prev => prev.slice(0, -1));
  }, []);

  return {
    activeTool, setActiveTool,
    strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth,
    history, isDrawing,
    startDraw, endDraw, addEvent, clearCanvas, undo,
  };
}
