import { io } from 'socket.io-client';

const SERVER_HTTP_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001`
  : window.location.origin;

export const SERVER_WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:3001`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export const socket = io(SERVER_HTTP_URL, {
  transports: ['websocket'],
  autoConnect: false
});
