// ============================================================
// js/onlineUI.js — Auth, Lobby, Waiting Room screens
// ============================================================

const SC = window.SocketClient;

// Show/hide screens
function showScreen(id) {
    ['auth-screen', 'lobby-screen', 'room-screen', 'setup-screen', 'game-container', 'win-screen']
        .forEach(s => document.getElementById(s)?.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
}

// ── Auth Screen ───────────────────────────────────────────
function initAuth() {
    SC.boot();

    const saved = localStorage.getItem('ludo_token');
    SC.on('auth:result', handleAuthResult);
    SC.on('auth:expired', () => {
        localStorage.removeItem('ludo_token');
        showScreen('auth-screen');
        setAuthError('Session expired. Please log in again.');
    });

    if (saved) {
        SC.authVerify(saved);
    } else {
        showScreen('auth-screen');
    }

    document.getElementById('auth-login-btn').addEventListener('click', () => {
        const u = document.getElementById('auth-username').value.trim();
        const p = document.getElementById('auth-password').value;
        if (!u || !p) { setAuthError('Please fill in all fields'); return; }
        setAuthError('');
        SC.authLogin(u, p);
    });
    document.getElementById('auth-register-btn').addEventListener('click', () => {
        const u = document.getElementById('auth-username').value.trim();
        const p = document.getElementById('auth-password').value;
        if (!u || !p) { setAuthError('Please fill in all fields'); return; }
        setAuthError('');
        SC.authRegister(u, p);
    });
    document.getElementById('auth-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('auth-login-btn').click();
    });
}

function handleAuthResult(data) {
    if (!data.ok) { setAuthError(data.msg || 'Error'); return; }
    SC.setSession(data.token, data.userId, data.username);
    localStorage.setItem('ludo_token', data.token);
    initLobby();
}

function setAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) el.textContent = msg;
}

// ── Lobby Screen ──────────────────────────────────────────
function initLobby() {
    showScreen('lobby-screen');
    document.getElementById('lobby-username').textContent = SC.getUsername();

    SC.on('room:created', ({ roomCode }) => {
        SC.setRoom(roomCode);
        initWaitingRoom(roomCode);
    });
    SC.on('room:joined', ({ roomCode }) => {
        SC.setRoom(roomCode);
        initWaitingRoom(roomCode);
    });
    SC.on('room:error', ({ msg }) => setLobbyError(msg));

    document.getElementById('create-room-btn').addEventListener('click', () => {
        setLobbyError('');
        SC.roomCreate();
    });
    document.getElementById('join-room-btn').addEventListener('click', () => {
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        if (code.length !== 6) { setLobbyError('Enter the 6-character room code'); return; }
        setLobbyError('');
        SC.roomJoin(code);
    });
    document.getElementById('join-code').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('join-room-btn').click();
    });
    document.getElementById('lobby-logout-btn').addEventListener('click', () => {
        localStorage.removeItem('ludo_token');
        location.reload();
    });
}

function setLobbyError(msg) {
    const el = document.getElementById('lobby-error');
    if (el) el.textContent = msg;
}

// ── Waiting Room Screen ───────────────────────────────────
function initWaitingRoom(roomCode) {
    showScreen('room-screen');
    document.getElementById('room-code-display').textContent = roomCode;

    SC.on('room:update', ({ room }) => renderWaitingRoom(room));
    SC.on('game:started', ({ state }) => {
        // Game starts — hand off to online game handler
        startOnlineGame(state);
    });

    // Copy code
    document.getElementById('copy-code-btn').onclick = () => {
        navigator.clipboard.writeText(roomCode).catch(() => { });
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = '📋 Copy', 1500);
    };

    document.getElementById('start-game-btn').onclick = () => { SC.roomStart(); };
    document.getElementById('leave-room-btn').onclick = () => {
        SC.roomLeave(); SC.setRoom(null); initLobby();
    };

    // Waiting room chat
    document.getElementById('room-chat-send').onclick = sendWaitingChat;
    document.getElementById('room-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sendWaitingChat();
    });
}

function sendWaitingChat() {
    const input = document.getElementById('room-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    SC.chatSend(msg);
    input.value = '';
}

function renderWaitingRoom(room) {
    const list = document.getElementById('room-players-list');
    const colors = ['red', 'green', 'yellow', 'blue'];
    list.innerHTML = '';
    room.players.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'room-player-item';
        const colorDot = room.status === 'in-game' ? `<span class="dot-${colors[i]}" style="width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;"></span>` : '';
        const isHost = p.userId === room.host ? ' 👑' : '';
        div.innerHTML = `${colorDot}<strong>${p.username}</strong>${isHost}`;
        list.appendChild(div);
    });

    // Show/hide start button based on host
    const startBtn = document.getElementById('start-game-btn');
    startBtn.classList.toggle('hidden', room.host !== SC.getUserId() || room.players.length < 2);

    // Append new chat messages
    if (room.chat && room.chat.length > 0) {
        const chatEl = document.getElementById('room-chat-messages');
        chatEl.innerHTML = '';
        room.chat.forEach(m => appendChatMessage(chatEl, m));
        chatEl.scrollTop = chatEl.scrollHeight;
    }
}

// ── Online Game Handler ──────────────────────────────────────────
let onlineRenderer = null;
let myColor = null;
let onlineGameStarted = false;  // prevent double-init

function startOnlineGame(initialState) {
    if (onlineGameStarted) { updateOnlineGame(initialState); return; }
    onlineGameStarted = true;

    showScreen('game-container');
    // chat panel is hidden by default; remove hidden so it exists (still off-screen until toggled)
    document.getElementById('chat-panel').classList.remove('hidden');

    // ── Identify my color ─────────────────────────────────
    const me = initialState.players.find(p => p.userId === SC.getUserId());
    myColor = me?.color || null;

    // ── Build renderer ────────────────────────────────────
    if (!onlineRenderer) {
        onlineRenderer = new Renderer(new AudioEngine());
    }

    // ── Show only panels for players in this game ─────────
    const activeColors = new Set(initialState.players.map(p => p.color));
    ['red', 'green', 'yellow', 'blue'].forEach(c => {
        const panel = document.getElementById(`panel-${c}`);
        if (panel) panel.classList.toggle('hidden', !activeColors.has(c));
        // Hide tokens for colours not in this game
        document.querySelectorAll(`.token-${c}`).forEach(el => {
            el.classList.toggle('inactive-token', !activeColors.has(c));
        });
    });

    // ── Initial render ────────────────────────────────────
    onlineRenderer.render(initialState);
    _setRollBtn(initialState);

    // ── Socket event handlers ─────────────────────────────
    SC.on('game:state', (state) => updateOnlineGame(state));
    SC.on('game:capture', () => onlineRenderer.showCapture());
    SC.on('game:win', ({ color, username }) => {
        document.getElementById('win-screen').classList.remove('hidden');
        const banner = document.getElementById('win-banner');
        banner.textContent = `${username} (${color}) Wins! 🏆`;
        banner.className = `win-banner win-banner-${color}`;
        startConfetti();
    });
    SC.on('chat:message', (msg) => {
        const chatEl = document.getElementById('in-game-chat-messages');
        appendChatMessage(chatEl, msg);
        chatEl.scrollTop = chatEl.scrollHeight;
    });

    // ── Roll dice button ──────────────────────────────────
    document.getElementById('roll-btn').onclick = () => {
        if (!myColor) return;
        document.getElementById('dice-face').classList.add('rolling');
        setTimeout(() => document.getElementById('dice-face').classList.remove('rolling'), 500);
        SC.gameRoll();
    };

    // ── Token clicks ──────────────────────────────────────
    document.getElementById('token-layer').addEventListener('click', e => {
        const el = e.target.closest('.token');
        if (!el) return;
        if (el.dataset.color !== myColor) return;
        SC.gameMove(parseInt(el.dataset.id));
    });

    // ── In-game chat ──────────────────────────────────────
    document.getElementById('in-game-chat-send').onclick = sendInGameChat;
    document.getElementById('in-game-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sendInGameChat();
    });
    document.getElementById('chat-toggle-btn').onclick = () => {
        document.getElementById('chat-panel').classList.toggle('chat-open');
    };
}

function sendInGameChat() {
    const input = document.getElementById('in-game-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    SC.chatSend(msg);
    input.value = '';
}

// Called every time the server broadcasts a new game state
function updateOnlineGame(state) {
    if (!onlineRenderer) return;
    onlineRenderer.render(state);
    _setRollBtn(state);
}

// Sets roll button enabled/disabled based on whether it's this player's turn
function _setRollBtn(state) {
    const rollBtn = document.getElementById('roll-btn');
    if (!rollBtn) return;
    const isMyTurn = state.currentColor === myColor;
    const canRoll = isMyTurn && state.phase === 'roll';
    rollBtn.disabled = !canRoll;
    rollBtn.classList.toggle('cpu-turn', !isMyTurn);
    rollBtn.title = !isMyTurn
        ? `Waiting for ${state.players[state.currentPlayerIndex]?.username || state.currentColor}…`
        : '';
}

// ── Chat helper ───────────────────────────────────────────
function appendChatMessage(container, { username, color, message }) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name" style="color:var(--${color === 'gray' ? 'text2' : color})">${username}:</span> <span class="chat-text">${escapeHtml(message)}</span>`;
    container.appendChild(div);
    // Keep max 80 messages
    while (container.children.length > 80) container.removeChild(container.firstChild);
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initAuth);
