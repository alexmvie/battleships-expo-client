/**
 * GameController.js
 * 
 * This controller handles all game logic and communication between screens and the server.
 * It follows the controller pattern to separate business logic from UI components.
 */

import { createEmptyBoard, isValidPlacement, placeShip } from '../utils/gameState';

class GameController {
    constructor() {
        this.connection = null;
        this.gameCode = null;
        this.isHost = false;
        this.board = createEmptyBoard();
        this.placedShips = [];
        this.playerReady = false;
        this.opponentReady = false;
        this.navigatingToGame = false;
        this.listeners = {
            onOpponentReady: null,
            onBothPlayersReady: null,
            onGameStart: null,
            onConnectionLost: null,
            onBoardUpdated: null,
            onPlacedShipsUpdated: null,
            onPlayerReadyUpdated: null,
            onOpponentReadyUpdated: null,
        };
        
        // Bind methods
        this.handleGameData = this.handleGameData.bind(this);
    }

    /**
     * Initialize the game controller with connection and game parameters
     */
    initialize(connection, gameCode, isHost) {
        console.log('GameController: Initializing with gameCode:', gameCode, 'isHost:', isHost);
        this.connection = connection;
        this.gameCode = gameCode;
        this.isHost = isHost;
        this.board = createEmptyBoard();
        this.placedShips = [];
        this.playerReady = false;
        this.opponentReady = false;
        this.navigatingToGame = false;
        
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
    }

    /**
     * Reset the game controller state
     */
    reset() {
        this.board = createEmptyBoard();
        this.placedShips = [];
        this.playerReady = false;
        this.opponentReady = false;
        this.navigatingToGame = false;
        
        // Notify listeners
        if (this.listeners.onBoardUpdated) {
            this.listeners.onBoardUpdated(this.board);
        }
        if (this.listeners.onPlacedShipsUpdated) {
            this.listeners.onPlacedShipsUpdated(this.placedShips);
        }
    }

    /**
     * Handle incoming game data
     * @returns {boolean} true if the message was handled, false otherwise
     */
    handleGameData(data) {
        console.log('GameController: Received game data:', data);
        
        switch (data.type) {
            case 'placement_ready':
                // Opponent is ready
                console.log('GameController: Opponent is ready!');
                if (!this.opponentReady) {
                    this.opponentReady = true;
                    
                    // Notify listeners
                    if (this.listeners.onOpponentReadyUpdated) {
                        this.listeners.onOpponentReadyUpdated(true);
                    }
                    
                    if (this.listeners.onOpponentReady) {
                        this.listeners.onOpponentReady();
                    }
                    
                    // If both players are ready and we're the host, start the game
                    if (this.playerReady && this.isHost) {
                        console.log('GameController: Both players ready, host starting game');
                        this.startGame();
                    }
                    
                    // If both players are ready, notify listeners
                    if (this.playerReady && this.listeners.onBothPlayersReady) {
                        this.listeners.onBothPlayersReady();
                    }
                } else {
                    console.log('GameController: Ignoring duplicate ready message from opponent');
                }
                return true;
                
            case 'start_battle':
                // Host has started the battle
                console.log('GameController: Received start_battle message');
                
                // Make sure we're ready before starting
                if (!this.playerReady) {
                    console.log('GameController: Received start_battle but we are not ready yet');
                    return true;
                }
                
                // Prevent duplicate game starts
                if (this.navigatingToGame) {
                    console.log('GameController: Already navigating to Game screen, ignoring duplicate start_battle message');
                    return true;
                }
                
                this.navigatingToGame = true;
                
                // Notify listeners
                if (this.listeners.onGameStart) {
                    this.listeners.onGameStart();
                }
                return true;
                
            case 'battle_start':
                // Server has confirmed both players are ready
                console.log('GameController: Received battle_start event from server');
                
                // Prevent duplicate game starts
                if (this.navigatingToGame) {
                    console.log('GameController: Already navigating to Game screen, ignoring duplicate battle_start message');
                    return true;
                }
                
                this.navigatingToGame = true;
                
                // Notify listeners
                if (this.listeners.onGameStart) {
                    this.listeners.onGameStart();
                }
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
     * Place a ship on the board
     */
    placeShip(ship, row, col, isHorizontal) {
        if (!ship || this.placedShips.includes(ship.id)) {
            return false;
        }
        
        if (isValidPlacement(this.board, ship, row, col, isHorizontal)) {
            this.board = placeShip(this.board, ship, row, col, isHorizontal);
            this.placedShips = [...this.placedShips, ship.id];
            
            // Notify listeners
            if (this.listeners.onBoardUpdated) {
                this.listeners.onBoardUpdated(this.board);
            }
            if (this.listeners.onPlacedShipsUpdated) {
                this.listeners.onPlacedShipsUpdated(this.placedShips);
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Mark the player as ready and notify the opponent
     */
    markPlayerReady() {
        console.log('GameController: Marking player as ready');
        
        // If already ready, do nothing
        if (this.playerReady) {
            console.log('GameController: Player already ready, ignoring');
            return false;
        }
        
        // Check if all ships are placed
        if (this.placedShips.length < 5) { // 5 ships in total
            console.log('GameController: Not all ships placed, cannot mark as ready');
            return false;
        }
        
        // Mark as ready
        this.playerReady = true;
        
        // Notify listeners
        if (this.listeners.onPlayerReadyUpdated) {
            this.listeners.onPlayerReadyUpdated(true);
        }
        
        // Send ready message to opponent
        if (this.connection) {
            console.log('GameController: Sending placement_ready message');
            
            // Send the ready message
            const success = this.connection.sendGameData({
                type: 'placement_ready',
                timestamp: Date.now(),
            });
            
            // Also send the ready_to_battle event to the server
            console.log('GameController: Sending ready_to_battle message to server');
            this.connection.sendGameData({
                type: 'ready_to_battle',
                timestamp: Date.now(),
            });
            
            if (!success) {
                console.log('GameController: Failed to send ready message');
                this.playerReady = false;
                
                // Notify listeners
                if (this.listeners.onPlayerReadyUpdated) {
                    this.listeners.onPlayerReadyUpdated(false);
                }
                
                return false;
            }
            
            // If both players are ready and we're the host, start the game
            if (this.opponentReady && this.isHost) {
                console.log('GameController: Both players ready, host starting game');
                this.startGame();
            }
            
            // If both players are ready, notify listeners
            if (this.opponentReady && this.listeners.onBothPlayersReady) {
                this.listeners.onBothPlayersReady();
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Start the game (host only)
     */
    startGame() {
        if (!this.isHost) {
            console.log('GameController: Only host can start the game');
            return false;
        }
        
        if (!this.playerReady || !this.opponentReady) {
            console.log('GameController: Both players must be ready to start the game');
            return false;
        }
        
        if (this.navigatingToGame) {
            console.log('GameController: Already navigating to Game screen');
            return false;
        }
        
        console.log('GameController: Starting game');
        this.navigatingToGame = true;
        
        // Send start_battle message
        if (this.connection) {
            this.connection.sendGameData({
                type: 'start_battle',
                timestamp: Date.now(),
            });
        }
        
        // Notify listeners
        if (this.listeners.onGameStart) {
            this.listeners.onGameStart();
        }
        
        return true;
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
            board: this.board,
            placedShips: this.placedShips,
            playerReady: this.playerReady,
            opponentReady: this.opponentReady,
            isHost: this.isHost,
            gameCode: this.gameCode,
        };
    }
}

// Create a singleton instance
const gameController = new GameController();

export default gameController;
