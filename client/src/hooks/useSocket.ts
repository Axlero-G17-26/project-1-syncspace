import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'http://localhost:3000';

export function useSocket(token: string | null): {
  socket: Socket | null;
  connected: boolean;
} {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = (window as any).__useSocketState
    ? (window as any).__useSocketState
    : [false, () => {}];

  useEffect(() => {
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  return { socket: socketRef.current, connected };
}
