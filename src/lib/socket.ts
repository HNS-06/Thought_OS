import { io } from 'socket.io-client';

// If running in Electron (file protocol) or dev, force localhost:3005
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const URL = isFileProtocol || process.env.NODE_ENV !== 'production' 
  ? 'http://localhost:3005' 
  : undefined;

export const socket = io(URL as string, {
  autoConnect: true
});
