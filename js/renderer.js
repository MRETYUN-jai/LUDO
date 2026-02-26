// ============================================================
// LUDO KING — renderer.js  (Canvas board + bounce animation)
// ============================================================

const COLOR_MAP = {
    red: { fill: '#e74c3c', light: '#ff8a7a', dark: '#c0392b' },
    green: { fill: '#27ae60', light: '#6fcf97', dark: '#1e8449' },
    yellow: { fill: '#f1c40f', light: '#ffeaa7', dark: '#d4ac0d' },
    blue: { fill: '#2980b9', light: '#74b9ff', dark: '#1a5276' },
};

// Board palette
const BD = {
    bg: '#f5e6c8',   // cream board background
    pathWhite: '#ffffff',
    pathBorder: '#cccccc',
    centerBg: '#ffffff',
    safe: '#f0f0f0',
    starColor: '#f9ca24',
};

class Renderer {
    constructor(audio) {
        this.audio = audio;
        this.canvas = document.getElementById('ludo-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tokenEls = {};          // key "color-id" → DOM div (for click detection)
        this.tokenPos = {};          // key "color-id" → {x,y} pixel centre
        this.bouncing = new Set();   // keys currently bouncing
        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._buildTokenDivs();
    }

    // ── Size ─────────────────────────────────────────────────
    _resize() {
        const size = Math.min(window.innerWidth * 0.94, window.innerHeight * 0.85, 580);
        this.size = size;
        this.cell = size / 15;
        this.canvas.width = size;
        this.canvas.height = size;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        // Move token divs too
        Object.keys(this.tokenEls).forEach(key => {
            const p = this.tokenPos[key];
            if (p) this._positionDiv(this.tokenEls[key], p.x, p.y);
        });
    }

    // ── Token DOM layer (for click events + CSS animation) ────
    _buildTokenDivs() {
        const wrapper = document.getElementById('token-layer');
        wrapper.innerHTML = '';
        COLORS.forEach(color => {
            for (let i = 0; i < 4; i++) {
                const key = `${color}-${i}`;
                const div = document.createElement('div');
                div.className = `token token-${color}`;
                div.id = `token-${color}-${i}`;
                div.dataset.color = color;
                div.dataset.id = i;
                div.innerHTML = `<div class="token-inner"><span class="tok-num">${i + 1}</span></div>`;
                wrapper.appendChild(div);
                this.tokenEls[key] = div;
            }
        });
    }

    _positionDiv(div, cx, cy) {
        const r = this.cell * 0.38;
        div.style.left = (cx - r) + 'px';
        div.style.top = (cy - r) + 'px';
        div.style.width = (r * 2) + 'px';
        div.style.height = (r * 2) + 'px';
    }

    // ── Master render ─────────────────────────────────────────
    render(state) {
        this._drawBoard();
        this._placeAllTokens(state);
        this._applyHighlights(state);
        this._drawDice(state.diceValue);
        this._updateTurnLabel(state);
        this._updatePanels(state);
    }

    // ── Board Drawing ─────────────────────────────────────────
    _drawBoard() {
        const { ctx, size, cell } = this;
        ctx.clearRect(0, 0, size, size);

        // Background
        ctx.fillStyle = BD.bg;
        ctx.fillRect(0, 0, size, size);

        // Outer border
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, size - 2, size - 2);

        // Draw all path cells
        BOARD_PATH.forEach(([r, c]) => this._drawCell(r, c, BD.pathWhite, true));

        // Color the path cells for each color (entry strips)
        this._colorPathStrip('red', [[6, 1]]);
        this._colorPathStrip('green', [[1, 8]]);
        this._colorPathStrip('yellow', [[8, 13]]);
        this._colorPathStrip('blue', [[13, 6]]);

        // Draw home columns (colored)
        COLORS.forEach(color => {
            HOME_COLUMNS[color].forEach(([r, c]) => {
                this._drawCell(r, c, COLOR_MAP[color].fill, false);
            });
        });

        // Draw connector cells (also colored matching their side)
        this._drawCell(0, 7, COLOR_MAP.red.fill, false);      // top connector (red home entry)
        this._drawCell(7, 14, COLOR_MAP.yellow.fill, false);  // right connector
        this._drawCell(14, 7, COLOR_MAP.blue.fill, false);    // bottom connector
        this._drawCell(7, 0, COLOR_MAP.green.fill, false);    // left connector

        // Draw star safe cells
        SAFE_PATH_INDICES.forEach(idx => {
            const [r, c] = BOARD_PATH[idx];
            const isEntry = Object.values(ENTRY_INDEX).includes(idx);
            this._drawCell(r, c, isEntry ? COLOR_MAP[Object.keys(ENTRY_INDEX).find(k => ENTRY_INDEX[k] === idx)].fill : BD.pathWhite, true);
            this._drawStar(r, c);
        });

        // Draw yard boxes
        COLORS.forEach(color => this._drawYard(color));

        // Draw centre home (conic triangles)
        this._drawCentre();

        // Draw home column arrows (triangles pointing to centre)
        this._drawHomeArrow('red');
        this._drawHomeArrow('green');
        this._drawHomeArrow('yellow');
        this._drawHomeArrow('blue');
    }

    _drawCell(r, c, fill, border) {
        const { ctx, cell } = this;
        const x = c * cell, y = r * cell;
        ctx.fillStyle = fill;
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        if (border) {
            ctx.strokeStyle = BD.pathBorder;
            ctx.lineWidth = 0.7;
            ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
    }

    _colorPathStrip(color, cells) {
        cells.forEach(([r, c]) => this._drawCell(r, c, COLOR_MAP[color].fill, false));
    }

    _drawStar(r, c) {
        const { ctx, cell } = this;
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        ctx.font = `bold ${cell * 0.55}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = BD.starColor;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 3;
        ctx.fillText('★', cx, cy);
        ctx.shadowBlur = 0;
    }

    _drawYard(color) {
        const { ctx, cell } = this;
        const map = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };
        const [row, col] = map[color];
        const x = col * cell, y = row * cell;
        const s = cell * 6;
        const cm = COLOR_MAP[color];

        // Outer filled box
        ctx.fillStyle = cm.fill;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, s - 2, s - 2, cell * 0.4);
        ctx.fill();

        // Inner white oval region
        const pad = cell * 0.65;
        ctx.fillStyle = '#f9f9f0';
        ctx.beginPath();
        ctx.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, cell * 0.5);
        ctx.fill();

        // Yard label
        ctx.fillStyle = cm.dark;
        ctx.font = `bold ${cell * 0.55}px Fredoka One, cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const names = { red: 'R', green: 'G', yellow: 'Y', blue: 'B' };
        // (no label, tokens will fill the spots)
    }

    _drawCentre() {
        const { ctx, cell } = this;
        const x = 6 * cell, y = 6 * cell, s = 3 * cell;
        const cx = x + s / 2, cy = y + s / 2;
        const colors = [COLOR_MAP.red.fill, COLOR_MAP.green.fill, COLOR_MAP.yellow.fill, COLOR_MAP.blue.fill];
        const angles = [Math.PI, Math.PI * 1.5, 0, Math.PI * 0.5]; // which quadrant each points from

        colors.forEach((clr, i) => {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const a1 = (i * Math.PI / 2) - Math.PI / 4;
            const a2 = a1 + Math.PI / 2;
            ctx.arc(cx, cy, s * 0.72, a1, a2);
            ctx.closePath();
            ctx.fillStyle = clr;
            ctx.fill();
        });

        // White star in centre
        ctx.font = `${cell}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('★', cx, cy);
    }

    _drawHomeArrow(color) {
        // Small triangle overlaid on first home column cell pointing toward centre
        const col = HOME_COLUMNS[color];
        if (!col) return;
        const { ctx, cell } = this;
        const [r, c] = col[0];
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        // Direction vectors toward centre [7,7]
        const dr = 7 - r, dc = 7 - c;
        const len = Math.sqrt(dr * dr + dc * dc) || 1;
        const nx = dc / len, ny = dr / len;
        const perp = 0.3 * cell;
        ctx.beginPath();
        ctx.moveTo(cx + ny * perp * .8, cy - nx * perp * .8);
        ctx.lineTo(cx - ny * perp * .8, cy + nx * perp * .8);
        ctx.lineTo(cx + nx * perp * 1.5, cy + ny * perp * 1.5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
    }

    // ── Token placement ───────────────────────────────────────
    _placeAllTokens(state) {
        state.players.forEach(player => {
            player.tokens.forEach(token => {
                const el = this.tokenEls[`${token.color}-${token.id}`];
                if (!el || el.classList.contains('animating')) return;
                const pos = this._getCellPos(token, player.color);
                if (pos) {
                    this.tokenPos[`${token.color}-${token.id}`] = pos;
                    this._positionDiv(el, pos.x, pos.y);
                }
                el.classList.toggle('hidden-token', !pos);
            });
        });
    }

    _getCellPos(token, color) {
        const { cell } = this;
        if (token.status === STATUS.HOME) {
            const [r, c] = HOME_CENTER;
            return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
        }
        if (token.status === STATUS.YARD) {
            const [r, c] = YARD_POSITIONS[color][token.id];
            return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
        }
        if (token.homeIndex >= 0) {
            if (token.homeIndex >= 5) {
                const [r, c] = HOME_CENTER;
                return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
            }
            const [r, c] = HOME_COLUMNS[color][token.homeIndex];
            return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
        }
        if (token.pathIndex >= 0) {
            const [r, c] = BOARD_PATH[token.pathIndex];
            return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
        }
        return null;
    }

    // ── Selection bounce highlight ────────────────────────────
    _applyHighlights(state) {
        COLORS.forEach(color => {
            for (let i = 0; i < 4; i++) {
                const el = this.tokenEls[`${color}-${i}`];
                el.classList.remove('selectable');
            }
        });
        state.movableTokenIds.forEach(id => {
            const el = this.tokenEls[`${state.currentColor}-${id}`];
            if (el) el.classList.add('selectable');
        });
    }

    // ── Token animation (step by step) ───────────────────────
    async animateToken(token, animPath) {
        if (!animPath || animPath.length === 0) return;
        const key = `${token.color}-${token.id}`;
        const el = this.tokenEls[key];
        if (!el) return;
        el.classList.add('animating');
        el.classList.remove('selectable');

        for (const [r, c] of animPath) {
            const x = (c + 0.5) * this.cell;
            const y = (r + 0.5) * this.cell;
            this.tokenPos[key] = { x, y };
            this._positionDiv(el, x, y);
            this.audio.playMove();
            await this._sleep(120);
        }
        el.classList.remove('animating');
    }

    // ── Dice rendering ────────────────────────────────────────
    _drawDice(value) {
        const face = document.getElementById('dice-face');
        face.querySelectorAll('.dot').forEach(d => d.remove());
        if (!value) return;
        const patterns = {
            1: [[2, 2]],
            2: [[1, 3], [3, 1]],
            3: [[1, 3], [2, 2], [3, 1]],
            4: [[1, 1], [1, 3], [3, 1], [3, 3]],
            5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
            6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]],
        };
        (patterns[value] || []).forEach(([row, col]) => {
            const d = document.createElement('div');
            d.className = 'dot';
            d.style.gridArea = `${row}/${col}`;
            face.appendChild(d);
        });
    }

    // ── Labels ────────────────────────────────────────────────
    _updateTurnLabel(state) {
        const el = document.getElementById('turn-indicator');
        if (!el) return;
        const color = state.currentColor;
        const cur = state.players[state.currentPlayerIndex];
        // Show username if available (online mode), otherwise color name
        const name = cur?.username
            ? `${cur.username}'s Turn`
            : `${color.charAt(0).toUpperCase() + color.slice(1)}'s Turn`;
        el.textContent = name;
        el.className = `turn-indicator turn-${color}`;
    }

    // NOTE: Roll button enable/disable is handled externally for online mode.
    // This only updates panel highlights and token counts.
    _updatePanels(state) {
        state.players.forEach((p, i) => {
            const panel = document.getElementById(`panel-${p.color}`);
            if (!panel) return;
            // Ensure panel is visible
            panel.classList.remove('hidden');
            panel.classList.toggle('active-panel', i === state.currentPlayerIndex);
            const fc = panel.querySelector('.finished-count');
            if (fc) fc.textContent = `🏁 ${p.finishedTokens}/4`;
            // Show username in panel type slot
            const pt = panel.querySelector('.panel-type');
            if (pt && p.username) pt.textContent = p.username;
        });
        // Roll button: only update for local (single-player) mode.
        // Online mode overrides this in onlineUI.js after render().
        const rollBtn = document.getElementById('roll-btn');
        if (rollBtn && state.players[0]?.isHuman !== undefined) {
            // Local mode — use isHuman
            const cur = state.players[state.currentPlayerIndex];
            rollBtn.disabled = !cur.isHuman || state.phase !== 'roll';
            rollBtn.classList.toggle('cpu-turn', !cur.isHuman);
        }
    }

    // ── capture effect ────────────────────────────────────────
    showCapture() {
        this.audio.playCapture();
        const el = document.createElement('div');
        el.className = 'capture-flash';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
