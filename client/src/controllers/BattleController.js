/**
 * BattleController.js
 * 
 * This controller handles all battle logic and communication during the game phase.
 * It follows the controller pattern to separate business logic from UI components.
 */

import { createEmptyBoard, processAttack, areAllShipsSunk, isShipSunk, CELL_STATE } from '../utils/gameState';

class BattleController {
    constructor() {
        this.connection = null;
        this.gameCode = null;
        this.isHost = false;
        this.playerBoard = null;
        this.opponentBoard = null;
        this.isMyTurn = false;
        this.gameOver = false;
        this.winner = null;
        this.lastAttack = null;
        this.sunkShips = { player: [], opponent: [] };
        this.listeners = {
            onPlayerBoardUpdated: null,
            onOpponentBoardUpdated: null,
            onTurnChanged: null,
            onGameOver: null,
            onLastAttackUpdated: null,
            onSunkShipsUpdated: null,
            onConnectionLost: null,
        };
        
        // Bind methods
        this.handleGameData = this.handleGameData.bind(this);
    }

    /**
     * Initialize the battle controller with connection and game parameters
     */
    initialize(connection, gameCode, isHost, playerBoard) {
        console.log('BattleController: Initializing with gameCode:', gameCode, 'isHost:', isHost);
        this.connection = connection;
        this.gameCode = gameCode;
        this.isHost = isHost;
        this.playerBoard = playerBoard;
        this.opponentBoard = createEmptyBoard();
        this.isMyTurn = isHost; // Host goes first
        this.gameOver = false;
        this.winner = null;
        this.lastAttack = null;
        this.sunkShips = { player: [], opponent: [] };
        
        // Set up message handler
        if (connection) {
            const originalOnDataReceived = connection.onDataReceived;
            connection.onDataReceived = (data) => {
                // Handle game-specific messages
                const handled = this.handleGameData(data);
                
                // Pass unhandled messages to the original handler
                if (!handled && originalOnDataReceived) {
                    originalOnDataReceived(data);
                }
            };
        }
        
        // Notify listeners of initial state
        if (this.listeners.onPlayerBoardUpdated) {
            this.listeners.onPlayerBoardUpdated(this.playerBoard);
        }
        if (this.listeners.onOpponentBoardUpdated) {
            this.listeners.onOpponentBoardUpdated(this.opponentBoard);
        }
        if (this.listeners.onTurnChanged) {
            this.listeners.onTurnChanged(this.isMyTurn);
        }
    }

    /**
     * Handle incoming game data
     * @returns {boolean} true if the message was handled, false otherwise
     */
    handleGameData(data) {
        console.log('BattleController: Received game data:', data);
        
        switch (data.type) {
            case 'attack':
                this.handleIncomingAttack(data.row, data.col);
                return true;
                
            case 'attack_result':
                this.handleAttackResult(data);
                return true;
                
            case 'game_over':
                this.handleGameOver(false); // Opponent won
                return true;
                
            case 'ping':
            case 'pong':
                // Handle ping/pong internally
                return true;
                
            default:
                // Not handled by this controller
                return false;
        }
    }

    /**
     * Attack the opponent's board at the specified coordinates
     */
    attackCell(row, col) {
        console.log('BattleController: Attacking cell:', row, col);
        
        // Can only attack on your turn and if game is not over
        if (!this.isMyTurn || this.gameOver) {
            console.log('BattleController: Cannot attack - not your turn or game is over');
            return false;
        }
        
        // Can't attack a cell that's already been attacked
        if (this.opponentBoard[row][col].state === CELL_STATE.HIT || 
            this.opponentBoard[row][col].state === CELL_STATE.MISS) {
            console.log('BattleController: Cannot attack - cell already attacked');
            return false;
        }
        
        // Send attack to opponent
        if (this.connection) {
            const sendSuccess = this.connection.sendGameData({
                type: 'attack',
                row,
                col,
            });
            
            // If sending failed, return false
            if (!sendSuccess) {
                console.log('BattleController: Failed to send attack');
                return false;
            }
        }
        
        // Temporarily disable turns until we get a response
        this.isMyTurn = false;
        this.lastAttack = { row, col, board: 'opponent' };
        
        // Notify listeners
        if (this.listeners.onTurnChanged) {
            this.listeners.onTurnChanged(this.isMyTurn);
        }
        if (this.listeners.onLastAttackUpdated) {
            this.listeners.onLastAttackUpdated(this.lastAttack);
        }
        
        return true;
    }

    /**
     * Handle an incoming attack from the opponent
     */
    handleIncomingAttack(row, col) {
        console.log('BattleController: Handling incoming attack at:', row, col);
        
        // Process the attack on our board
        const result = processAttack(this.playerBoard, row, col);
        this.playerBoard = result.board;
        this.lastAttack = { row, col, board: 'player' };
        
        // Check if a ship was sunk
        let sunkShipId = null;
        if (result.hit && result.shipId) {
            if (isShipSunk(result.board, result.shipId)) {
                sunkShipId = result.shipId;
                this.sunkShips.player = [...this.sunkShips.player, result.shipId];
            }
        }
        
        // Send result back to opponent
        if (this.connection) {
            this.connection.sendGameData({
                type: 'attack_result',
                row,
                col,
                hit: result.hit,
                shipId: result.shipId,
                sunkShipId,
            });
        }
        
        // Check if all ships are sunk (game over)
        if (areAllShipsSunk(result.board)) {
            if (this.connection) {
                this.connection.sendGameData({
                    type: 'game_over',
                });
            }
            this.handleGameOver(false); // We lost
        } else {
            // It's our turn now
            this.isMyTurn = true;
        }
        
        // Notify listeners
        if (this.listeners.onPlayerBoardUpdated) {
            this.listeners.onPlayerBoardUpdated(this.playerBoard);
        }
        if (this.listeners.onLastAttackUpdated) {
            this.listeners.onLastAttackUpdated(this.lastAttack);
        }
        if (this.listeners.onSunkShipsUpdated) {
            this.listeners.onSunkShipsUpdated(this.sunkShips);
        }
        if (this.listeners.onTurnChanged) {
            this.listeners.onTurnChanged(this.isMyTurn);
        }
    }

    /**
     * Handle the result of an attack we made
     */
    handleAttackResult(data) {
        console.log('BattleController: Handling attack result:', data);
        
        const { row, col, hit, shipId, sunkShipId } = data;
        
        // Update opponent's board based on attack result
        const newBoard = [...this.opponentBoard];
        newBoard[row][col] = {
            state: hit ? CELL_STATE.HIT : CELL_STATE.MISS,
            ship: shipId,
        };
        this.opponentBoard = newBoard;
        
        // Update sunk ships
        if (sunkShipId) {
            this.sunkShips.opponent = [...this.sunkShips.opponent, sunkShipId];
            
            // Check if all ships are sunk (game over)
            if (this.sunkShips.opponent.length === 5) { // 5 ships in total
                this.handleGameOver(true); // We won
            }
        }
        
        // Notify listeners
        if (this.listeners.onOpponentBoardUpdated) {
            this.listeners.onOpponentBoardUpdated(this.opponentBoard);
        }
        if (this.listeners.onSunkShipsUpdated) {
            this.listeners.onSunkShipsUpdated(this.sunkShips);
        }
    }

    /**
     * Handle game over
     */
    handleGameOver(didWin) {
        console.log('BattleController: Game over, winner:', didWin ? 'player' : 'opponent');
        
        this.gameOver = true;
        this.winner = didWin ? 'player' : 'opponent';
        
        // Notify listeners
        if (this.listeners.onGameOver) {
            this.listeners.onGameOver(didWin);
        }
    }

    /**
     * Register event listeners
     */
    on(event, callback) {
        if (this.listeners.hasOwnProperty(event)) {
            this.listeners[event] = callback;
        }
    }

    /**
     * Get the current game state
     */
    getGameState() {
        return {
            playerBoard: this.playerBoard,
            opponentBoard: this.opponentBoard,
            isMyTurn: this.isMyTurn,
            gameOver: this.gameOver,
            winner: this.winner,
            lastAttack: this.lastAttack,
            sunkShips: this.sunkShips,
            isHost: this.isHost,
            gameCode: this.gameCode,
        };
    }
}

// Create a singleton instance
const battleController = new BattleController();

export default battleController;
