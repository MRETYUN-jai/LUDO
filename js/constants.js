// ============================================================
// LUDO KING — constants.js  (corrected)
// ============================================================

const COLORS = ['red', 'green', 'yellow', 'blue'];

// 51-cell BOARD_PATH (outer ring only, no home-column overlap).
// Grid is 15×15. Red=top-left, Green=top-right, Yellow=bottom-right, Blue=bottom-left.
// Traversal order: Red exits right → up → right → down → left → down → left → up
const BOARD_PATH = [
    // ── Red start segment (right along row 6) ──
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],          // 0-4
    // ── Up col 6 ──
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],    // 5-10
    // ── Top-centre connector ──
    [0, 7],                                   // 11  ← Green HOME-ENTRY
    // ── Down col 8 (Green start) ──
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],    // 12-17
    // ── Right along row 6 ──
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // 18-23
    // ── Right-centre connector ──
    [7, 14],                                  // 24  ← Yellow HOME-ENTRY
    // ── Left along row 8 (Yellow start) ──
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // 25-30
    // ── Down col 8 ──
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], // 31-36
    // ── Bottom-centre connector ──
    [14, 7],                                  // 37  ← Blue HOME-ENTRY
    // ── Up col 6 (Blue start) ──
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // 38-43
    // ── Left along row 8 ──
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],    // 44-49
    // ── Left-centre connector (Red HOME-ENTRY) ──
    [7, 0],                                   // 50  ← Red HOME-ENTRY
];
// Total: 51 cells (indices 0-50)
const PATH_LENGTH = 51;

// Where each color's token enters the main ring from the yard (must roll 6)
const ENTRY_INDEX = {
    red: 0,  // [6,1]
    green: 13, // [1,8]
    yellow: 26, // [8,13]
    blue: 39, // [13,6]
};

// The path index a token must PASS to start entering the home column.
// After reaching this cell the token goes into HOME_COLUMNS on the next move.
const HOME_ENTRY_PATH_INDEX = {
    red: 50, // [7,0]  → home column goes right  [7,1..5]
    green: 11, // [0,7]  → home column goes down   [1,7..5,7]
    yellow: 24, // [7,14] → home column goes left   [7,13..9]
    blue: 37, // [14,7] → home column goes up     [13,7..9,7]
};

// 5 colored home-column cells for each color (leading toward centre [7,7])
const HOME_COLUMNS = {
    red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],   // homeIndex 0-4
    green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};
// homeIndex 5 = centre [7,7] = finished

const HOME_CENTER = [7, 7];

// Safe (star) cells — cannot be captured here.
// Includes each color's entry cell + 4 mid-ring star squares.
const SAFE_PATH_INDICES = new Set([
    0,  // Red entry   [6,1]
    8,  // star        [2,6]
    13, // Green entry [1,8]
    21, // star        [6,12]
    26, // Yellow entry[8,13]
    34, // star        [12,8]
    39, // Blue entry  [13,6]
    47, // star        [8,2]
]);

// Yard token home positions for each color (4 circles inside the yard box)
const YARD_POSITIONS = {
    red: [[1, 1], [1, 3], [3, 1], [3, 3]],
    green: [[1, 11], [1, 13], [3, 11], [3, 13]],
    yellow: [[11, 11], [11, 13], [13, 11], [13, 13]],
    blue: [[11, 1], [11, 3], [13, 1], [13, 3]],
};

const STATUS = { YARD: 'yard', ACTIVE: 'active', HOME: 'home' };
