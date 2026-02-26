// ============================================================
// server/roomManager.js — Create, join, and manage rooms
// ============================================================
const { ServerGameEngine } = require('./gameLogic');

// In-memory room store: roomCode → Room object
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return rooms.has(code) ? generateCode() : code;
}

function createRoom(host) {
    const roomCode = generateCode();
    const room = {
        roomCode,
        host: host.userId,
        players: [{ userId: host.userId, username: host.username, color: null, ready: false, socketId: host.socketId }],
        maxPlayers: 4,
        status: 'waiting',   // 'waiting' | 'in-game' | 'finished'
        engine: null,
        chat: [],
    };
    rooms.set(roomCode, room);
    return room;
}

function joinRoom(roomCode, user) {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { ok: false, msg: 'Room not found' };
    if (room.status !== 'waiting') return { ok: false, msg: 'Game already started' };
    if (room.players.length >= room.maxPlayers) return { ok: false, msg: 'Room is full' };
    if (room.players.find(p => p.userId === user.userId)) return { ok: false, msg: 'Already in room' };

    room.players.push({ userId: user.userId, username: user.username, color: null, ready: false, socketId: user.socketId });
    return { ok: true, room };
}

function leaveRoom(roomCode, userId) {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players = room.players.filter(p => p.userId !== userId);
    if (room.players.length === 0) { rooms.delete(roomCode); return null; }
    if (room.host === userId && room.players.length > 0) room.host = room.players[0].userId;
    return room;
}

function assignColors(room) {
    const allColors = ['red', 'green', 'yellow', 'blue'];
    room.players.forEach((p, i) => { p.color = allColors[i]; });
}

function startGame(roomCode, userId) {
    const room = rooms.get(roomCode);
    if (!room) return { ok: false, msg: 'Room not found' };
    if (room.host !== userId) return { ok: false, msg: 'Only host can start' };
    if (room.players.length < 2) return { ok: false, msg: 'Need at least 2 players' };
    if (room.status !== 'waiting') return { ok: false, msg: 'Game already started' };

    assignColors(room);
    room.status = 'in-game';
    room.engine = new ServerGameEngine(room.players.map(p => ({
        color: p.color, userId: p.userId, username: p.username,
    })));
    return { ok: true, room };
}

function getRoom(roomCode) { return rooms.get(roomCode?.toUpperCase()) || null; }

function updateSocketId(roomCode, userId, socketId) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.userId === userId);
    if (player) player.socketId = socketId;
}

function getRoomSafe(room) {
    if (!room) return null;
    return {
        roomCode: room.roomCode,
        host: room.host,
        status: room.status,
        maxPlayers: room.maxPlayers,
        players: room.players.map(({ userId, username, color }) => ({ userId, username, color })),
        chat: room.chat.slice(-50),
    };
}

module.exports = { createRoom, joinRoom, leaveRoom, startGame, getRoom, updateSocketId, getRoomSafe };
