const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// WebSocket-only configuration as specified
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket']
});

const PALETTE = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899'];
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('join-room', ({ roomId, name, hostKey }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        nodes: [],
        edges: [],
        users: new Map(),
        colorCounter: 0,
        hostKey: hostKey || null,
        viewOnly: false,
        chat: []
      });
    }

    const room = rooms.get(roomId);
    if (!room.hostKey && hostKey) {
      room.hostKey = hostKey;
    }

    const isHost = Boolean(room.hostKey && hostKey && room.hostKey === hostKey);
    const color = PALETTE[room.colorCounter % PALETTE.length];
    room.colorCounter += 1;

    const user = {
      id: socket.id,
      name: name || 'Guest',
      color,
      isHost
    };

    room.users.set(socket.id, user);

    // Send full current room state including viewOnly and chat to the joining socket only
    socket.emit('room-state', {
      nodes: room.nodes,
      edges: room.edges,
      users: Array.from(room.users.values()),
      viewOnly: Boolean(room.viewOnly),
      chat: room.chat || []
    });

    // Notify all clients in the room about the updated user list
    io.to(roomId).emit('users-update', Array.from(room.users.values()));
  });

  socket.on('chat-message', (data) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const user = room.users.get(socket.id);
    if (!user) return;

    const rawText = typeof data === 'object' && data !== null && 'text' in data ? data.text : data;
    if (typeof rawText !== 'string') return;
    const trimmed = rawText.trim();
    if (!trimmed) return;
    const text = trimmed.slice(0, 500);

    const msg = {
      id: Math.random().toString(36).slice(2, 11),
      userId: socket.id,
      name: user.name,
      color: user.color,
      text,
      ts: Date.now()
    };

    if (!room.chat) room.chat = [];
    room.chat.push(msg);
    if (room.chat.length > 100) {
      room.chat.shift();
    }

    io.to(currentRoomId).emit('chat-message', msg);
  });

  socket.on('set-view-only', (data) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const user = room.users.get(socket.id);
    if (!user || !user.isHost) return;

    const val = typeof data === 'object' && data !== null && 'value' in data ? Boolean(data.value) : Boolean(data);
    room.viewOnly = val;
    io.to(currentRoomId).emit('view-only', { value: val });
  });

  socket.on('flow-update', ({ nodes, edges }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const user = room.users.get(socket.id);
    // Ignore flow-update from non-hosts when view-only mode is active
    if (room.viewOnly && (!user || !user.isHost)) return;

    room.nodes = nodes || [];
    room.edges = edges || [];
    // Broadcast latest flowchart to others in room (last write wins)
    socket.to(currentRoomId).emit('flow-update', { nodes: room.nodes, edges: room.edges });
  });

  socket.on('cursor-move', ({ x, y }) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    const user = room.users.get(socket.id);
    if (!user) return;
    socket.to(currentRoomId).emit('cursor-move', {
      id: socket.id,
      name: user.name,
      color: user.color,
      x,
      y
    });
  });

  socket.on('latency-check', (ack) => {
    if (typeof ack === 'function') ack();
  });

  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.users.delete(socket.id);

    // Notify room of user departure
    io.to(currentRoomId).emit('users-update', Array.from(room.users.values()));
    socket.to(currentRoomId).emit('cursor-leave', socket.id);

    // Clean up empty room
    if (room.users.size === 0) {
      rooms.delete(currentRoomId);
    }
  });
});

// Serve client build in production
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Flowroom server running on http://0.0.0.0:${PORT}`);
});
