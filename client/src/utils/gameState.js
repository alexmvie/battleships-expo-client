/**
 * Game state management for Battleships
 * Handles the core game logic, board state, and turn management
 */

// Ship types with their sizes
export const SHIPS = {
  CARRIER: { id: 'carrier', size: 5, name: 'Carrier' },
  BATTLESHIP: { id: 'battleship', size: 4, name: 'Battleship' },
  CRUISER: { id: 'cruiser', size: 3, name: 'Cruiser' },
  SUBMARINE: { id: 'submarine', size: 3, name: 'Submarine' },
  DESTROYER: { id: 'destroyer', size: 2, name: 'Destroyer' },
};

// Game board size
export const BOARD_SIZE = 10;

// Cell states
export const CELL_STATE = {
  EMPTY: 'empty',
  SHIP: 'ship',
  HIT: 'hit',
  MISS: 'miss',
};

// Game phases
export const GAME_PHASE = {
  SETUP: 'setup',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
};

/**
 * Creates an empty game board
 * @returns {Array} 2D array representing the game board
 */
export const createEmptyBoard = () => {
  const board = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const row = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      row.push({
        state: CELL_STATE.EMPTY,
        ship: null,
      });
    }
    board.push(row);
  }
  return board;
};

/**
 * Checks if a ship placement is valid
 * @param {Array} board - The game board
 * @param {Object} ship - The ship to place
 * @param {number} row - Starting row
 * @param {number} col - Starting column
 * @param {boolean} isHorizontal - Ship orientation
 * @returns {boolean} Whether the placement is valid
 */
export const isValidPlacement = (board, ship, row, col, isHorizontal) => {
  // Check if ship is within board boundaries
  if (isHorizontal) {
    if (col + ship.size > BOARD_SIZE) return false;
  } else {
    if (row + ship.size > BOARD_SIZE) return false;
  }

  // Check if cells are empty and no adjacent ships
  for (let i = 0; i < ship.size; i++) {
    const currentRow = isHorizontal ? row : row + i;
    const currentCol = isHorizontal ? col + i : col;

    // Check the cell itself
    if (board[currentRow][currentCol].state !== CELL_STATE.EMPTY) {
      return false;
    }

    // Check adjacent cells (including diagonals)
    for (let r = Math.max(0, currentRow - 1); r <= Math.min(BOARD_SIZE - 1, currentRow + 1); r++) {
      for (let c = Math.max(0, currentCol - 1); c <= Math.min(BOARD_SIZE - 1, currentCol + 1); c++) {
        if (board[r][c].state === CELL_STATE.SHIP) {
          return false;
        }
      }
    }
  }

  return true;
};

/**
 * Places a ship on the board
 * @param {Array} board - The game board
 * @param {Object} ship - The ship to place
 * @param {number} row - Starting row
 * @param {number} col - Starting column
 * @param {boolean} isHorizontal - Ship orientation
 * @returns {Array} Updated game board
 */
export const placeShip = (board, ship, row, col, isHorizontal) => {
  if (!isValidPlacement(board, ship, row, col, isHorizontal)) {
    return board;
  }

  const newBoard = JSON.parse(JSON.stringify(board));
  
  for (let i = 0; i < ship.size; i++) {
    const currentRow = isHorizontal ? row : row + i;
    const currentCol = isHorizontal ? col + i : col;
    
    newBoard[currentRow][currentCol] = {
      state: CELL_STATE.SHIP,
      ship: ship.id,
    };
  }
  
  return newBoard;
};

/**
 * Processes an attack on the board
 * @param {Array} board - The game board
 * @param {number} row - Target row
 * @param {number} col - Target column
 * @returns {Object} Result containing updated board and hit status
 */
export const processAttack = (board, row, col) => {
  const newBoard = JSON.parse(JSON.stringify(board));
  const cell = newBoard[row][col];
  
  // Cell already attacked
  if (cell.state === CELL_STATE.HIT || cell.state === CELL_STATE.MISS) {
    return { board: newBoard, hit: false, alreadyAttacked: true };
  }
  
  if (cell.state === CELL_STATE.SHIP) {
    newBoard[row][col].state = CELL_STATE.HIT;
    return { board: newBoard, hit: true, shipId: cell.ship, alreadyAttacked: false };
  } else {
    newBoard[row][col].state = CELL_STATE.MISS;
    return { board: newBoard, hit: false, alreadyAttacked: false };
  }
};

/**
 * Checks if all ships on a board are sunk
 * @param {Array} board - The game board
 * @returns {boolean} Whether all ships are sunk
 */
export const areAllShipsSunk = (board) => {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col].state === CELL_STATE.SHIP) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Checks if a specific ship is completely sunk
 * @param {Array} board - The game board
 * @param {string} shipId - The ship ID to check
 * @returns {boolean} Whether the ship is sunk
 */
export const isShipSunk = (board, shipId) => {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      if (cell.ship === shipId && cell.state === CELL_STATE.SHIP) {
        return false;
      }
    }
  }
  return true;
};
