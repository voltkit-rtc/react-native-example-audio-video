/**
 * The backend's own live connection, for what happens outside any room: the 1v1 line, room list updates and
 * inbox notices. Everything inside a room goes over VoltKit instead.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  socket?.disconnect();
  socket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 8000 });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export const getSocket = () => socket;

/** Listens while mounted, and always calls the latest handler. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const s = socket;
    if (!s) return;
    const listener = (payload: T) => latest.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}
