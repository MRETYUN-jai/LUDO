# 🎲 Ludo King — Online Multiplayer

A real-time **online multiplayer Ludo** game with friend rooms, in-game chat, and an accurate authentic Ludo board — built with **Node.js + Socket.IO** on the backend and pure **HTML / CSS / JavaScript** on the frontend.

![Ludo Board](https://via.placeholder.com/800x400/0f0f1a/f9ca24?text=Ludo+King+Online)

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🔐 **Auth** | Register / Login with username & password (bcrypt + JWT) |
| 🏠 **Create Room** | Host creates a room, gets a 6-char code to share |
| 🔗 **Join Room** | Friends join with the code |
| 💬 **Chat** | Real-time chat in waiting room AND during the game |
| 🎲 **Accurate Rules** | Exact home-entry landing, entry-cell safety, 3-six forfeit |
| 🎨 **Canvas Board** | Authentic Ludo board drawn on `<canvas>` |
| 🏆 **Win Screen** | Confetti animation when someone wins |
| 🤖 **Server-Authoritative** | All game logic runs server-side — no cheating |

---

## 📁 Project Structure

```
ludo-king/
├── index.html          # Main page (Auth → Lobby → Room → Game)
├── style.css           # Core game styles
├── online.css          # Online multiplayer UI styles
├── js/
│   ├── constants.js    # Board path, colours, safe cells
│   ├── gameEngine.js   # Client-side game engine (reference)
│   ├── ai.js           # AI opponent logic
│   ├── renderer.js     # Canvas board + token rendering
│   ├── audio.js        # Web Audio API sound effects
│   ├── socket.js       # Socket.IO client wrapper
│   └── onlineUI.js     # Auth, lobby, room, chat UI controller
└── server/
    ├── package.json    # Node.js dependencies
    ├── server.js       # Express + Socket.IO server (entry point)
    ├── auth.js         # Register/login with bcrypt + JWT
    ├── roomManager.js  # Create/join/leave rooms
    └── gameLogic.js    # Server-side authoritative game engine
```

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ludo-king.git
cd ludo-king
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Start the server

```bash
node server.js
# or:  npm start
```

You'll see:
```
🎲 Ludo King Server running at http://localhost:3000
```

### 4. Open the game

Open **http://localhost:3000** in your browser.

To play with friends on the **same network**, share your local IP address:  
`http://YOUR_LOCAL_IP:3000`

---

## 🎮 How to Play Online

1. **Register** an account (or Login if you have one)
2. Click **Create Room** → a 6-character code appears (e.g. `AB3X7K`)
3. Share the code with friends
4. Friends open the same URL, click **Join Room**, enter the code
5. Once 2–4 players are in the room, the host clicks **🎲 Start Game**
6. Play! Only the current player can roll the dice
7. Use the **💬 chat button** to open the side chat panel during the game

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Board Rendering | HTML5 Canvas |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Authentication | bcryptjs + JSON Web Tokens |
| Storage | In-memory (no database required) |

---

## ⚙️ Environment Variables

Create a `.env` file in the `server/` folder (optional — defaults work fine for local dev):

```env
PORT=3000
JWT_SECRET=your-secret-key-here
```

---

## 📜 Ludo Rules Implemented

- Roll **6** to release a token from the yard
- Rolling **6** grants a **bonus turn**
- Making a **capture** grants a **bonus turn**
- **3 consecutive 6s** → forfeit the turn
- Tokens must land **exactly** on the home column cells (no overshooting)
- **Entry cells** (each player's start position) are safe — tokens there cannot be captured
- **8 star cells** are safe zones across the board
- First player to get all **4 tokens to the centre** wins

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first.

---

## 📄 License

MIT © 2026
