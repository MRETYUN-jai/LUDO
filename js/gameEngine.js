// ============================================================
// LUDO KING — gameEngine.js  (corrected)
// ============================================================

class GameEngine {
    constructor(playerConfig) {
        this.players = playerConfig.map(cfg => ({
            color: cfg.color,
            isHuman: cfg.isHuman,
            tokens: [0, 1, 2, 3].map(i => ({
                id: i, color: cfg.color,
                status: STATUS.YARD,
                pathIndex: -1,  // 0-50 on main ring
                homeIndex: -1,  // 0-4 in home col; 5 = finished
            })),
            finishedTokens: 0,
        }));
        this.currentPlayerIndex = 0;
        this.diceValue = null;
        this.phase = 'roll';       // 'roll' | 'move' | 'animating' | 'done'
        this.winner = null;
        this.movableTokens = [];
        this.consecutiveSixes = 0;

        this.onStateChange = null;
        this.onCapture = null;
        this.onWin = null;
        this.onTokenArrivedHome = null;
    }

    get currentPlayer() { return this.players[this.currentPlayerIndex]; }

    // ── Helpers ──────────────────────────────────────────────
    // forward distance from `from` to `to` along the ring
    _ringDist(from, to) {
        return (to - from + PATH_LENGTH) % PATH_LENGTH;
    }

    _isSafe(pathIndex, movingColor) {
        // Entry cells of each color are safe; so are the generic star cells
        return SAFE_PATH_INDICES.has(pathIndex);
    }

    // ── Dice ────────────────────────────────────────────────
    rollDice() {
        if (this.phase !== 'roll' || this.winner) return;
        this.diceValue = Math.floor(Math.random() * 6) + 1;

        if (this.diceValue === 6) {
            this.consecutiveSixes++;
            if (this.consecutiveSixes >= 3) {         // 3 sixes in a row → forfeit
                this.consecutiveSixes = 0;
                this._notify();
                setTimeout(() => this.advanceTurn(), 900);
                return;
            }
        } else {
            this.consecutiveSixes = 0;
        }

        this.movableTokens = this._getMovableTokens(this.currentPlayer, this.diceValue);
        this.phase = 'move';
        this._notify();

        if (this.movableTokens.length === 0) {
            setTimeout(() => this.advanceTurn(), 800);
        }
    }

    // ── Which tokens can move? ───────────────────────────────
    _getMovableTokens(player, dice) {
        return player.tokens.filter(t => this._canMove(t, player.color, dice));
    }

    _canMove(token, color, dice) {
        if (token.status === STATUS.HOME) return false;
        if (token.status === STATUS.YARD) return dice === 6;

        // In home column: must land EXACTLY on homeIndex 5 (centre) or earlier cell
        if (token.homeIndex >= 0) {
            const next = token.homeIndex + dice;
            return next <= 5;          // exact or within column
        }

        // On main ring: check if dice takes it into / past home entry
        const entryIdx = HOME_ENTRY_PATH_INDEX[color];
        const distToEntry = this._ringDist(token.pathIndex, entryIdx);

        if (distToEntry === 0) {
            // Already at home-entry cell, next step goes into column
            return dice <= 5;
        }
        if (dice > distToEntry) {
            // Would enter column — must not overshoot
            const stepsInHome = dice - distToEntry - 1;
            return stepsInHome <= 4;   // homeIndex 0-4 only; 5 = centre
        }
        return true;
    }

    // ── Move a token ─────────────────────────────────────────
    moveToken(tokenId) {
        if (this.phase !== 'move' || this.winner) return;
        const player = this.currentPlayer;
        const token = player.tokens.find(t => t.id === tokenId);
        if (!token || !this.movableTokens.includes(token)) return;

        const dice = this.diceValue;
        this.phase = 'animating';

        const animPath = this._computeAnimPath(token, player.color, dice);
        this._applyMove(token, player, dice);

        let captured = false;
        if (token.status === STATUS.ACTIVE && token.homeIndex < 0) {
            captured = this._checkCapture(token, player);
        }

        if (player.finishedTokens === 4) {
            this.winner = player.color;
            this.phase = 'done';
            this._notify(animPath, token);
            setTimeout(() => { if (this.onWin) this.onWin(player.color); }, animPath.length * 130 + 300);
            return;
        }

        this._notify(animPath, token);

        const keepTurn = (dice === 6) || captured;
        setTimeout(() => {
            if (keepTurn) {
                this.phase = 'roll';
                this._notify();
                if (!this.currentPlayer.isHuman) setTimeout(() => this._doAiTurn(), 900);
            } else {
                this.advanceTurn();
            }
        }, animPath.length * 130 + 350);
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
            if (token.homeIndex >= 5) {
                token.homeIndex = 5;
                token.status = STATUS.HOME;
                player.finishedTokens++;
                if (this.onTokenArrivedHome) this.onTokenArrivedHome(player.color);
            }
            return;
        }

        // Main ring
        const entryIdx = HOME_ENTRY_PATH_INDEX[player.color];
        const distToEntry = this._ringDist(token.pathIndex, entryIdx);

        if (dice > distToEntry) {
            // Enter home column
            const stepsInHome = dice - distToEntry - 1;
            token.pathIndex = entryIdx;
            token.homeIndex = stepsInHome;
            if (token.homeIndex >= 5) {
                token.homeIndex = 5;
                token.status = STATUS.HOME;
                player.finishedTokens++;
                if (this.onTokenArrivedHome) this.onTokenArrivedHome(player.color);
            }
        } else {
            token.pathIndex = (token.pathIndex + dice) % PATH_LENGTH;
        }
    }

    _checkCapture(movedToken, movingPlayer) {
        const pos = movedToken.pathIndex;
        if (this._isSafe(pos)) return false;

        let captured = false;
        for (const player of this.players) {
            if (player.color === movingPlayer.color) continue;
            for (const token of player.tokens) {
                if (token.status === STATUS.ACTIVE && token.homeIndex < 0 && token.pathIndex === pos) {
                    token.status = STATUS.YARD;
                    token.pathIndex = -1;
                    token.homeIndex = -1;
                    captured = true;
                    if (this.onCapture) this.onCapture(token.color);
                }
            }
        }
        return captured;
    }

    // ── Animation path ────────────────────────────────────────
    _computeAnimPath(token, color, dice) {
        const path = [];

        if (token.status === STATUS.YARD) {
            path.push([...YARD_POSITIONS[color][token.id]]);
            path.push([...BOARD_PATH[ENTRY_INDEX[color]]]);
            return path;
        }

        if (token.homeIndex >= 0) {
            const col = HOME_COLUMNS[color];
            const start = token.homeIndex + 1;
            const end = Math.min(token.homeIndex + dice, 5);
            for (let i = start; i <= end; i++) {
                path.push(i < 5 ? [...col[i]] : [...HOME_CENTER]);
            }
            return path;
        }

        // Main ring
        const entryIdx = HOME_ENTRY_PATH_INDEX[color];
        const distToEntry = this._ringDist(token.pathIndex, entryIdx);
        let cur = token.pathIndex;
        let steps = dice;

        while (steps > 0) {
            cur = (cur + 1) % PATH_LENGTH;
            path.push([...BOARD_PATH[cur]]);
            steps--;

            if (cur === entryIdx && steps > 0) {
                // Transition into home column
                const col = HOME_COLUMNS[color];
                for (let h = 0; h < steps; h++) {
                    path.push(h < 4 ? [...col[h]] : [...HOME_CENTER]);
                }
                break;
            }
        }
        return path;
    }

    // ── Turn management ──────────────────────────────────────
    advanceTurn() {
        this.diceValue = null;
        this.movableTokens = [];
        this.consecutiveSixes = 0;
        this.phase = 'roll';

        let tries = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            tries++;
        } while (this.currentPlayer.finishedTokens === 4 && tries < this.players.length);

        this._notify();
        if (!this.currentPlayer.isHuman && !this.winner) {
            setTimeout(() => this._doAiTurn(), 900);
        }
    }

    // ── AI ───────────────────────────────────────────────────
    _doAiTurn() {
        if (this.winner || this.phase !== 'roll') return;
        this.rollDice();
        if (this.phase === 'move' && this.movableTokens.length > 0) {
            const chosen = aiChooseToken(this.currentPlayer, this.diceValue, this);
            setTimeout(() => { if (this.phase === 'move') this.moveToken(chosen.id); }, 700);
        }
    }

    // ── Debug cheat ──────────────────────────────────────────
    cheatWin(color) {
        const player = this.players.find(p => p.color === color);
        if (!player) return;
        player.tokens.forEach(t => {
            t.status = STATUS.ACTIVE;
            t.pathIndex = (HOME_ENTRY_PATH_INDEX[color] - 4 + PATH_LENGTH) % PATH_LENGTH;
            t.homeIndex = -1;
        });
        this._notify();
    }

    _notify(animPath, animToken) {
        if (this.onStateChange) this.onStateChange(this.getSnapshot(), animPath, animToken);
    }

    getSnapshot() {
        return {
            players: this.players.map(p => ({
                color: p.color, isHuman: p.isHuman, finishedTokens: p.finishedTokens,
                tokens: p.tokens.map(t => ({ ...t })),
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            diceValue: this.diceValue,
            phase: this.phase,
            winner: this.winner,
            movableTokenIds: this.movableTokens.map(t => t.id),
            currentColor: this.currentPlayer.color,
        };
    }
}
