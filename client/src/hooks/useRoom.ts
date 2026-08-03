import { useState, useCallback } from 'react';

interface RoomState {
  roomId: string | null;
  isOwner: boolean;
  collaborators: string[];
  mode: 'normal' | 'interview';
}

export function useRoom() {
  const [room, setRoom] = useState<RoomState>({
    roomId: null, isOwner: false, collaborators: [], mode: 'normal',
  });

  const joinRoom = useCallback((roomId: string, isOwner = false) => {
    setRoom(prev => ({ ...prev, roomId, isOwner }));
  }, []);

  const leaveRoom = useCallback(() => {
    setRoom({ roomId: null, isOwner: false, collaborators: [], mode: 'normal' });
  }, []);

  const addCollaborator = useCallback((username: string) => {
    setRoom(prev => ({
      ...prev,
      collaborators: prev.collaborators.includes(username)
        ? prev.collaborators
        : [...prev.collaborators, username],
    }));
  }, []);

  const removeCollaborator = useCallback((username: string) => {
    setRoom(prev => ({
      ...prev,
      collaborators: prev.collaborators.filter(u => u !== username),
    }));
  }, []);

  const setInterviewMode = useCallback((active: boolean) => {
    setRoom(prev => ({ ...prev, mode: active ? 'interview' : 'normal' }));
  }, []);

  return { ...room, joinRoom, leaveRoom, addCollaborator, removeCollaborator, setInterviewMode };
}
