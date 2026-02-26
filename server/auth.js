// ============================================================
// server/auth.js — Register / Login with JWT
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'ludo-king-dev-secret-2026';
const SALT_ROUNDS = 10;

// In-memory user store: { userId: { username, passwordHash } }
const users = new Map(); // userId → user record
const byName = new Map(); // username → userId  (for fast lookup)

function register(username, password) {
    if (!username || username.length < 3) return { ok: false, msg: 'Username must be ≥ 3 characters' };
    if (!password || password.length < 4) return { ok: false, msg: 'Password must be ≥ 4 characters' };
    if (byName.has(username.toLowerCase())) return { ok: false, msg: 'Username already taken' };

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    users.set(userId, { userId, username, passwordHash });
    byName.set(username.toLowerCase(), userId);

    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '12h' });
    return { ok: true, token, userId, username };
}

function login(username, password) {
    const userId = byName.get(username.toLowerCase());
    if (!userId) return { ok: false, msg: 'User not found' };
    const user = users.get(userId);
    if (!bcrypt.compareSync(password, user.passwordHash)) return { ok: false, msg: 'Wrong password' };

    const token = jwt.sign({ userId, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    return { ok: true, token, userId, username: user.username };
}

function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch { return null; }
}

module.exports = { register, login, verifyToken };
