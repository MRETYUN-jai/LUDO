// ============================================================
// js/socket.js — Client Socket.IO wrapper
// ============================================================

// ⚠️  Set this to your Render backend URL after deploying.
//     e.g. 'https://ludo-king-xxxx.onrender.com'
//     Leave empty string to connect to the same origin (local dev).
const SOCKET_SERVER_URL = '';

// Socket.IO client is loaded via CDN script tag in index.html
let _socket = null;
let _token = null;
let _userId = null;
let _username = null;
let _roomCode = null;
const _handlers = {};

function initSocket() {
    if (_socket) return;
    _socket = io(SOCKET_SERVER_URL || undefined); // connects to Render URL, or same origin if empty

    // Route all events to registered handlers
    const events = [
        'auth:result', 'auth:expired',
        'room:created', 'room:joined', 'room:update', 'room:error',
        'game:started', 'game:state', 'game:capture', 'game:win',
        'chat:message',
    ];
    events.forEach(ev => {
        _socket.on(ev, data => {
            if (_handlers[ev]) _handlers[ev](data);
        });
    });
}

function on(event, fn) { _handlers[event] = fn; }

function setSession(token, userId, username) {
    _token = token; _userId = userId; _username = username;
}

function setRoom(code) { _roomCode = code; }
function getRoom() { return _roomCode; }
function getToken() { return _token; }
function getUserId() { return _userId; }
function getUsername() { return _username; }

// ── Emit helpers ──────────────────────────────────────────
function emit(event, payload = {}) {
    if (!_socket) initSocket();
    _socket.emit(event, { token: _token, roomCode: _roomCode, ...payload });
}

function authRegister(username, password) { _socket.emit('auth:register', { username, password }); }
function authLogin(username, password) { _socket.emit('auth:login', { username, password }); }
function authVerify(token) { _socket.emit('auth:verify', { token }); }
function roomCreate() { emit('room:create'); }
function roomJoin(code) { emit('room:join', { roomCode: code.toUpperCase() }); }
function roomLeave() { emit('room:leave'); }
function roomStart() { emit('room:start'); }
function gameRoll() { emit('game:roll'); }
function gameMove(tokenId) { emit('game:move', { tokenId }); }
function chatSend(message) { emit('chat:send', { message }); }

// Boot
function boot() { initSocket(); }

window.SocketClient = {
    boot, on, setSession, setRoom, getRoom, getToken, getUserId, getUsername,
    authRegister, authLogin, authVerify,
    roomCreate, roomJoin, roomLeave, roomStart,
    gameRoll, gameMove, chatSend,
};
