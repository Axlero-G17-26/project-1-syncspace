export interface Room {
  id: string;
  name: string;
  candidates: number;
}

const ROOMS_KEY = "syncspace_rooms";

export const localstore = {
  getRooms: (): Room[] => {
    try {
      const data = localStorage.getItem(ROOMS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Failed to parse rooms from local storage", err);
    }
    // Default rooms if none exist
    return [
      { id: "TECH-1001", name: "Initial Tech Screen", candidates: 1 },
      { id: "CODE-9942", name: "Frontend Final", candidates: 0 },
    ];
  },
  
  saveRooms: (rooms: Room[]): void => {
    try {
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    } catch (err) {
      console.error("Failed to save rooms to local storage", err);
    }
  },

  addRoom: (room: Room): void => {
    const rooms = localstore.getRooms();
    const newRooms = [room, ...rooms];
    localstore.saveRooms(newRooms);
  },

  removeRoom: (roomId: string): void => {
    const rooms = localstore.getRooms();
    const newRooms = rooms.filter(r => r.id !== roomId);
    localstore.saveRooms(newRooms);
  }
};
