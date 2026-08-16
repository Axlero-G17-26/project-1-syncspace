export const SOCKET_EVENTS = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",

  JOIN_ROOM: "join-room",
  ROOM_JOINED: "room-joined",

  LEAVE_ROOM: "leave-room",
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",

  ROOM_USERS: "room-users",

  SEND_MESSAGE: "send-message",
  RECEIVE_MESSAGE: "receive-message",

  SOCKET_ERROR: "socket-error",
};


// v2 — Interviewer-specific events
export const INTERVIEWER_START = 'interviewer:start';
export const INTERVIEWER_END   = 'interviewer:end';
export const INTERVIEWER_SYNC  = 'interviewer:sync';
