// ============================================================
// server/server.js — Main Express + Socket.IO server
// ============================================================
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const auth = require('./auth');
const rm = require('./roomManager');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Serve the ludo-king frontend (one level up from this server/ dir)
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());

// ── Socket.IO ──────────────────────────────────────────────
// Map socket.id → { userId, username, roomCode }
const socketMeta = new Map();

io.on('connection', socket => {
    console.log('+ socket', socket.id);

    // ── Auth ────────────────────────────────────────────────
    socket.on('auth:register', ({ username, password }) => {
        const result = auth.register(username, password);
        socket.emit('auth:result', result);
    });

    socket.on('auth:login', ({ username, password }) => {
        const result = auth.login(username, password);
        socket.emit('auth:result', result);
    });

    socket.on('auth:verify', ({ token }) => {
        const payload = auth.verifyToken(token);
        if (payload) socket.emit('auth:result', { ok: true, userId: payload.userId, username: payload.username, token });
        else socket.emit('auth:result', { ok: false, msg: 'Session expired, please login again' });
    });

    // ── Rooms ───────────────────────────────────────────────
    socket.on('room:create', ({ token }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const room = rm.createRoom({ ...user, socketId: socket.id });
        socketMeta.set(socket.id, { ...user, roomCode: room.roomCode });
        socket.join(room.roomCode);
        socket.emit('room:created', { roomCode: room.roomCode });
        broadcastRoom(room.roomCode);
    });

    socket.on('room:join', ({ token, roomCode }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const result = rm.joinRoom(roomCode, { ...user, socketId: socket.id });
        if (!result.ok) { socket.emit('room:error', { msg: result.msg }); return; }
        socketMeta.set(socket.id, { ...user, roomCode: result.room.roomCode });
        socket.join(result.room.roomCode);
        socket.emit('room:joined', { roomCode: result.room.roomCode });
        broadcastRoom(result.room.roomCode);
    });

    socket.on('room:leave', ({ token, roomCode }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const room = rm.leaveRoom(roomCode, user.userId);
        socket.leave(roomCode);
        socketMeta.delete(socket.id);
        if (room) broadcastRoom(roomCode);
    });

    socket.on('room:start', ({ token, roomCode }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const result = rm.startGame(roomCode, user.userId);
        if (!result.ok) { socket.emit('room:error', { msg: result.msg }); return; }
        broadcastRoom(roomCode);
        io.to(roomCode).emit('game:started', { state: result.room.engine.getSnapshot() });
    });

    // ── Game ────────────────────────────────────────────────
    socket.on('game:roll', ({ token, roomCode }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const room = rm.getRoom(roomCode);
        if (!room || room.status !== 'in-game' || !room.engine) return;
        const engine = room.engine;
        if (engine.currentPlayer.userId !== user.userId) return; // not your turn
        if (engine.phase !== 'roll') return;

        const diceVal = engine.rollDice();
        io.to(roomCode).emit('game:state', engine.getSnapshot());

        if (engine.phase === 'move' && engine.movableTokens.length === 0) {
            // advanceTurn happens inside engine via setTimeout; re-emit after delay
            setTimeout(() => io.to(roomCode).emit('game:state', engine.getSnapshot()), 900);
        }
    });

    socket.on('game:move', ({ token, roomCode, tokenId }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const room = rm.getRoom(roomCode);
        if (!room || room.status !== 'in-game' || !room.engine) return;
        const engine = room.engine;
        if (engine.currentPlayer.userId !== user.userId) return;
        if (engine.phase !== 'move') return;

        const result = engine.moveToken(tokenId);
        if (!result) return;

        io.to(roomCode).emit('game:state', engine.getSnapshot());

        if (result.captured) {
            io.to(roomCode).emit('game:capture', {});
        }
        if (result.winner) {
            room.status = 'finished';
            io.to(roomCode).emit('game:win', result.winner);
        } else {
            // Re-broadcast after advance-turn timeout
            setTimeout(() => io.to(roomCode).emit('game:state', engine.getSnapshot()), 400);
        }
    });

    // ── Chat ────────────────────────────────────────────────
    socket.on('chat:send', ({ token, roomCode, message }) => {
        const user = requireAuth(socket, token); if (!user) return;
        const room = rm.getRoom(roomCode);
        if (!room) return;
        const trimmed = (message || '').trim().slice(0, 200);
        if (!trimmed) return;
        const player = room.players.find(p => p.userId === user.userId);
        const color = player?.color || 'gray';
        const msg = { username: user.username, color, message: trimmed, ts: Date.now() };
        room.chat.push(msg);
        if (room.chat.length > 100) room.chat.shift();
        io.to(roomCode).emit('chat:message', msg);
    });

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('- socket', socket.id);
        const meta = socketMeta.get(socket.id);
        if (meta?.roomCode) {
            const room = rm.leaveRoom(meta.roomCode, meta.userId);
            if (room) {
                io.to(meta.roomCode).emit('chat:message', {
                    username: 'System', color: 'gray',
                    message: `${meta.username} left the room`, ts: Date.now(),
                });
                broadcastRoom(meta.roomCode);
            }
        }
        socketMeta.delete(socket.id);
    });
});

// ── Helpers ───────────────────────────────────────────────
function requireAuth(socket, token) {
    const user = auth.verifyToken(token);
    if (!user) { socket.emit('auth:expired', {}); return null; }
    return user;
}

function broadcastRoom(roomCode) {
    const room = rm.getRoom(roomCode);
    io.to(roomCode).emit('room:update', { room: rm.getRoomSafe(room) });
}

// ── Start ─────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🎲 Ludo King Server running at http://localhost:${PORT}\n`);
});
