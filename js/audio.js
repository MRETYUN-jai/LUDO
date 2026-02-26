// ============================================================
// LUDO KING — audio.js
// Web Audio API sound synthesis (no external files needed)
// ============================================================

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._init();
    }

    _init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    _resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    _playTone(frequency, duration, type = 'sine', volume = 0.3, delay = 0) {
        if (!this.enabled || !this.ctx) return;
        this._resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime + delay);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration);
    }

    _playNoise(duration, volume = 0.15) {
        if (!this.enabled || !this.ctx) return;
        this._resume();
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
    }

    playDiceRoll() {
        this._playNoise(0.3, 0.2);
        this._playTone(200, 0.15, 'square', 0.1);
        this._playTone(300, 0.1, 'square', 0.1, 0.1);
    }

    playMove() {
        this._playTone(440, 0.08, 'sine', 0.2);
        this._playTone(550, 0.08, 'sine', 0.2, 0.08);
    }

    playCapture() {
        this._playTone(300, 0.1, 'square', 0.25);
        this._playTone(200, 0.1, 'square', 0.25, 0.1);
        this._playTone(100, 0.2, 'sawtooth', 0.25, 0.2);
    }

    playTokenHome() {
        this._playTone(523, 0.1, 'sine', 0.3);
        this._playTone(659, 0.1, 'sine', 0.3, 0.1);
        this._playTone(784, 0.2, 'sine', 0.3, 0.2);
    }

    playWin() {
        const notes = [523, 659, 784, 1047, 784, 1047, 1175, 1568];
        notes.forEach((freq, i) => {
            this._playTone(freq, 0.18, 'sine', 0.4, i * 0.15);
        });
    }

    playSix() {
        this._playTone(880, 0.12, 'sine', 0.3);
        this._playTone(1100, 0.12, 'sine', 0.3, 0.12);
    }
}
