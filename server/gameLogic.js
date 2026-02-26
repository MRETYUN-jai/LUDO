// ============================================================
// server/gameLogic.js — Server-side Ludo engine (CommonJS)
// ============================================================

// ── Constants ─────────────────────────────────────────────
const COLORS = ['red', 'green', 'yellow', 'blue'];
const PATH_LENGTH = 51;

const BOARD_PATH = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0],
];

const ENTRY_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };

const HOME_ENTRY_PATH_INDEX = { red: 50, green: 11, yellow: 24, blue: 37 };

const HOME_COLUMNS = {
    red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

const SAFE_PATH_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const STATUS = { YARD: 'yard', ACTIVE: 'active', HOME: 'home' };

// ── Game Engine ───────────────────────────────────────────
class ServerGameEngine {
    constructor(playerConfig) {
        // playerConfig: [{color, userId, username}]
        this.players = playerConfig.map(cfg => ({
            color: cfg.color,
            userId: cfg.userId,
            username: cfg.username,
            tokens: [0, 1, 2, 3].map(i => ({
                id: i, color: cfg.color,
                status: STATUS.YARD, pathIndex: -1, homeIndex: -1,
            })),
            finishedTokens: 0,
        }));
        this.currentPlayerIndex = 0;
        this.diceValue = null;
        this.phase = 'roll';
        this.winner = null;
        this.movableTokens = [];
        this.consecutiveSixes = 0;
    }

    get currentPlayer() { return this.players[this.currentPlayerIndex]; }

    _ringDist(from, to) { return (to - from + PATH_LENGTH) % PATH_LENGTH; }

    _canMove(token, color, dice) {
        if (token.status === STATUS.HOME) return false;
        if (token.status === STATUS.YARD) return dice === 6;
        if (token.homeIndex >= 0) return (token.homeIndex + dice) <= 5;
        const entryIdx = HOME_ENTRY_PATH_INDEX[color];
        const dist = this._ringDist(token.pathIndex, entryIdx);
        if (dist === 0) return dice <= 5;
        if (dice > dist) return (dice - dist - 1) <= 4;
        return true;
    }

    rollDice() {
        if (this.phase !== 'roll' || this.winner) return null;
        this.diceValue = Math.floor(Math.random() * 6) + 1;

        if (this.diceValue === 6) {
            this.consecutiveSixes++;
            if (this.consecutiveSixes >= 3) {
                this.consecutiveSixes = 0;
                setTimeout(() => this.advanceTurn(), 800);
                return this.diceValue;
            }
        } else {
            this.consecutiveSixes = 0;
        }

        this.movableTokens = this.players[this.currentPlayerIndex].tokens
            .filter(t => this._canMove(t, this.players[this.currentPlayerIndex].color, this.diceValue));
        this.phase = 'move';
        if (this.movableTokens.length === 0) {
            setTimeout(() => this.advanceTurn(), 800);
        }
        return this.diceValue;
    }

    moveToken(tokenId) {
        if (this.phase !== 'move' || this.winner) return null;
        const player = this.currentPlayer;
        const token = player.tokens.find(t => t.id === tokenId);
        if (!token || !this.movableTokens.find(t => t.id === tokenId)) return null;

        const dice = this.diceValue;
        this._applyMove(token, player, dice);

        let captured = false;
        if (token.status === STATUS.ACTIVE && token.homeIndex < 0) {
            captured = this._checkCapture(token, player);
        }

        const result = { captured };
        if (player.finishedTokens === 4) {
            this.winner = player.color;
            this.phase = 'done';
            result.winner = { color: player.color, username: player.username };
            return result;
        }

        const keepTurn = (dice === 6 || captured);
        if (keepTurn) {
            this.phase = 'roll';
        } else {
            this.advanceTurn();
        }
        return result;
    }

    _applyMove(token, player, dice) {
        if (token.status === STATUS.YARD) {
            token.status = STATUS.ACTIVE;
            token.pathIndex = ENTRY_INDEX[player.color];
            token.homeIndex = -1;
            return;
        }
        if (token.homeIndex >= 0) {
            token.homeIndex += dice;
            if (token.homeIndex >= 5) { token.homeIndex = 5; token.status = STATUS.HOME; player.finishedTokens++; }
            return;
        }
        const entryIdx = HOME_ENTRY_PATH_INDEX[player.color];
        const dist = this._ringDist(token.pathIndex, entryIdx);
        if (dice > dist) {
            token.homeIndex = dice - dist - 1;
            token.pathIndex = entryIdx;
            if (token.homeIndex >= 5) { token.homeIndex = 5; token.status = STATUS.HOME; player.finishedTokens++; }
        } else {
            token.pathIndex = (token.pathIndex + dice) % PATH_LENGTH;
        }
    }

    _checkCapture(movedToken, movingPlayer) {
        if (SAFE_PATH_INDICES.has(movedToken.pathIndex)) return false;
        let captured = false;
        for (const player of this.players) {
            if (player.color === movingPlayer.color) continue;
            for (const token of player.tokens) {
                if (token.status === STATUS.ACTIVE && token.homeIndex < 0 && token.pathIndex === movedToken.pathIndex) {
                    token.status = STATUS.YARD; token.pathIndex = -1; token.homeIndex = -1;
                    captured = true;
                }
            }
        }
        return captured;
    }

    advanceTurn() {
        this.diceValue = null; this.movableTokens = []; this.consecutiveSixes = 0; this.phase = 'roll';
        let tries = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            tries++;
        } while (this.currentPlayer.finishedTokens === 4 && tries < this.players.length);
    }

    getSnapshot() {
        return {
            players: this.players.map(p => ({
                color: p.color, userId: p.userId, username: p.username,
                finishedTokens: p.finishedTokens,
                tokens: p.tokens.map(t => ({ ...t })),
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            currentColor: this.currentPlayer.color,
            currentUserId: this.currentPlayer.userId,
            diceValue: this.diceValue,
            phase: this.phase,
            winner: this.winner,
            movableTokenIds: this.movableTokens.map(t => t.id),
        };
    }
}

module.exports = { ServerGameEngine, COLORS, STATUS };
