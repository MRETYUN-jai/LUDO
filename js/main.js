// ============================================================
// LUDO KING — main.js  (canvas version)
// ============================================================

let game = null;
let renderer = null;
let audio = null;
let activeColors = [];

document.addEventListener('DOMContentLoaded', () => {
    audio = new AudioEngine();
    setupScreen();
    window.game = { cheatWin: (c) => game && game.cheatWin(c) };
    document.getElementById('play-again-btn').addEventListener('click', playAgain);
});

// ── Setup screen ──────────────────────────────────────────
function setupScreen() {
    document.getElementById('start-btn').addEventListener('click', startGame);

    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePlayerRows(parseInt(btn.dataset.count));
        });
    });
    updatePlayerRows(4);
}

function updatePlayerRows(count) {
    document.querySelectorAll('.player-row').forEach((row, i) => {
        row.classList.toggle('hidden', i >= count);
    });
}

function startGame() {
    const count = parseInt(document.querySelector('.count-btn.active')?.dataset.count || 4);
    const allColors = ['red', 'green', 'yellow', 'blue'];
    const usedColors = new Set();
    const playerConfig = [];

    for (let i = 0; i < count; i++) {
        const row = document.querySelectorAll('.player-row')[i];
        let color = row.querySelector('.color-select')?.value || allColors[i];
        if (usedColors.has(color)) color = allColors.find(c => !usedColors.has(c)) || allColors[i];
        usedColors.add(color);
        const isHuman = row.querySelector('.type-select')?.value === 'human';
        playerConfig.push({ color, isHuman });
    }
    activeColors = [...usedColors];

    // Show/hide panels
    allColors.forEach(c => {
        const panel = document.getElementById(`panel-${c}`);
        panel && panel.classList.toggle('hidden', !usedColors.has(c));
        // hide tokens not in game
        document.querySelectorAll(`.token-${c}`).forEach(el =>
            el.classList.toggle('inactive-token', !usedColors.has(c)));
    });

    // Update Human/CPU labels
    playerConfig.forEach(cfg => {
        const el = document.getElementById(`type-${cfg.color}`);
        if (el) el.textContent = cfg.isHuman ? 'Human' : 'CPU';
    });

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    // Init
    renderer = new Renderer(audio);
    game = new GameEngine(playerConfig);
    window.game.engine = game;

    game.onStateChange = (state, animPath, animToken) => {
        if (animPath && animToken && animPath.length > 0) {
            renderer.animateToken(animToken, animPath).then(() => renderer.render(state));
        } else {
            renderer.render(state);
        }
    };

    game.onCapture = () => renderer.showCapture();
    game.onWin = (color) => { audio.playWin(); showWinScreen(color); };
    game.onTokenArrivedHome = () => audio.playTokenHome();

    // Dice button
    document.getElementById('roll-btn').addEventListener('click', onRollClick);

    // Token clicks on the canvas layer
    document.getElementById('token-layer').addEventListener('click', e => {
        const el = e.target.closest('.token');
        if (!el || game.phase !== 'move' || !game.currentPlayer.isHuman) return;
        if (el.dataset.color !== game.currentPlayer.color) return;
        if (!game.movableTokens.some(t => t.id === parseInt(el.dataset.id))) return;
        game.moveToken(parseInt(el.dataset.id));
    });

    renderer.render(game.getSnapshot());

    if (!game.currentPlayer.isHuman) setTimeout(() => game._doAiTurn(), 1000);
}

function onRollClick() {
    if (!game || game.phase !== 'roll' || !game.currentPlayer.isHuman) return;
    audio.playDiceRoll();
    document.getElementById('dice-face').classList.add('rolling');
    setTimeout(() => document.getElementById('dice-face').classList.remove('rolling'), 500);
    game.rollDice();
    if (game.diceValue === 6) audio.playSix();
}

// ── Win screen ────────────────────────────────────────────
function showWinScreen(color) {
    document.getElementById('win-screen').classList.remove('hidden');
    const banner = document.getElementById('win-banner');
    banner.textContent = `${color.charAt(0).toUpperCase() + color.slice(1)} Wins! 🏆`;
    banner.className = `win-banner win-banner-${color}`;
    startConfetti();
}

function playAgain() {
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    COLORS.forEach(c => {
        document.getElementById(`panel-${c}`)?.classList.add('hidden');
        document.querySelectorAll(`.token-${c}`).forEach(el => el.classList.remove('inactive-token'));
    });
    // Remove old roll listener to avoid duplicates
    const rb = document.getElementById('roll-btn');
    const newRb = rb.cloneNode(true);
    rb.parentNode.replaceChild(newRb, rb);
}

// ── Confetti ──────────────────────────────────────────────
function startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const ptcls = Array.from({ length: 130 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
        w: Math.random() * 10 + 4, h: Math.random() * 6 + 3,
        clr: ['#e74c3c', '#27ae60', '#f1c40f', '#2980b9', '#9b59b6', '#e67e22'][Math.floor(Math.random() * 6)],
        speed: Math.random() * 3 + 1, angle: Math.random() * 360, spin: (Math.random() - .5) * 5,
    }));
    let running = true;
    const loop = () => {
        if (!running) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ptcls.forEach(p => {
            p.y += p.speed; p.angle += p.spin;
            if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180);
            ctx.fillStyle = p.clr; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
        });
        requestAnimationFrame(loop);
    };
    loop();
    setTimeout(() => { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }, 6000);
}
