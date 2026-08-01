export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    element?: "whiteboard" | "editor";
    line?: number;
    ch?: number;
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
  userId: string;
  userName: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userName: string;
  userColor: string;
  text: string;
}

export type CodeLanguage = "javascript" | "python" | "html" | "css";
