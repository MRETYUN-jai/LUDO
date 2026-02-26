// ============================================================
// LUDO KING — ai.js
// Heuristic AI for computer-controlled players
// ============================================================

function aiChooseToken(player, dice, engine) {
    const movable = engine.movableTokens;
    if (movable.length === 0) return null;
    if (movable.length === 1) return movable[0];

    let best = null;
    let bestScore = -Infinity;

    movable.forEach(token => {
        let score = 0;

        // Priority 1: Win the game (token reaches home)
        if (_wouldReachHome(token, player.color, dice)) {
            score += 1000;
        }

        // Priority 2: Capture an opponent
        if (_wouldCapture(token, player.color, dice, engine)) {
            score += 500;
        }

        // Priority 3: Release from yard
        if (token.status === STATUS.YARD) {
            score += 100;
        }

        // Priority 4: Advance farthest token
        const progress = _getProgress(token, player.color);
        score += progress;

        // Priority 5: Move into a safe cell
        if (_wouldLandSafe(token, player.color, dice)) {
            score += 80;
        }

        // Avoid moving onto an unsafe cell with opponents nearby
        if (_isInDanger(token, player.color, dice, engine)) {
            score -= 60;
        }

        if (score > bestScore) {
            bestScore = score;
            best = token;
        }
    });

    return best || movable[0];
}

function _wouldReachHome(token, color, dice) {
    if (token.status === STATUS.YARD) return dice === 6 && false; // can't go home from yard in one move
    if (token.homeIndex >= 0) {
        return token.homeIndex + dice === 5;
    }
    const entryIndex = HOME_ENTRY_PATH_INDEX[color];
    const dist = _dist(token.pathIndex, entryIndex);
    if (dist < dice) {
        return (dice - dist - 1) === 5;
    }
    return false;
}

function _wouldCapture(token, color, dice, engine) {
    if (token.status === STATUS.YARD) return false;
    if (token.homeIndex >= 0) return false;

    const entryIndex = HOME_ENTRY_PATH_INDEX[color];
    const dist = _dist(token.pathIndex, entryIndex);
    if (dist < dice) return false; // entering home, no capture

    const newPos = (token.pathIndex + dice) % PATH_LENGTH;
    if (SAFE_PATH_INDICES.has(newPos)) return false;

    return engine.players.some(p => {
        if (p.color === color) return false;
        return p.tokens.some(t =>
            t.status === STATUS.ACTIVE && t.homeIndex < 0 && t.pathIndex === newPos
        );
    });
}

function _wouldLandSafe(token, color, dice) {
    if (token.status === STATUS.YARD || token.homeIndex >= 0) return false;
    const newPos = (token.pathIndex + dice) % PATH_LENGTH;
    return SAFE_PATH_INDICES.has(newPos);
}

function _isInDanger(token, color, dice, engine) {
    if (token.status === STATUS.YARD || token.homeIndex >= 0) return false;
    const newPos = (token.pathIndex + dice) % PATH_LENGTH;
    if (SAFE_PATH_INDICES.has(newPos)) return false;

    // Check if any opponent can reach this cell in 1-6 steps
    return engine.players.some(p => {
        if (p.color === color) return false;
        return p.tokens.some(t => {
            if (t.status !== STATUS.ACTIVE || t.homeIndex >= 0) return false;
            for (let d = 1; d <= 6; d++) {
                if ((t.pathIndex + d) % PATH_LENGTH === newPos) return true;
            }
            return false;
        });
    });
}

function _getProgress(token, color) {
    if (token.status === STATUS.YARD) return 0;
    if (token.homeIndex >= 0) return 52 + token.homeIndex * 10;
    const entryIndex = HOME_ENTRY_PATH_INDEX[color];
    const startIndex = ENTRY_INDEX[color];
    // How many steps from start
    let steps = token.pathIndex - startIndex;
    if (steps < 0) steps += PATH_LENGTH;
    return steps;
}

function _dist(from, to) {
    if (from <= to) return to - from;
    return (PATH_LENGTH - from) + to;
}
