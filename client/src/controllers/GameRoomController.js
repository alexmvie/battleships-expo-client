/**
 * GameRoomController.js
 *
 * This controller manages the game room and all clients in it.
 * It follows a client-based model rather than player/opponent to support multiple players.
 */

import { createEmptyBoard } from '../utils/gameState';
import { GAME_STATES, APP_VERSION, DEBUG_MODE, shortenId } from '../config/appConfig';

class GameRoomController {
      constructor() {
            // Core game properties
            this.gameCode = null;
            this.connection = null;
            this.localClientId = null;
            this.isHost = false;

            // Client management
            this.clients = {}; // Map of clientId -> client data
            this.clientOrder = []; // Order of clients for turns
            this.currentTurnIndex = 0;

            // Game state
            this.gameState = GAME_STATES.SETUP;
            this.winner = null;

            // Event listeners
            this.listeners = {
                  onClientJoined: null,
                  onClientLeft: null,
                  onGameStateChanged: null,
                  onClientReadyChanged: null,
                  onAllClientsReady: null,
                  onTurnChanged: null,
                  onBoardUpdated: null,
                  onAttackResult: null,
                  onGameOver: null,
                  onConnectionLost: null,
            };

            // Bind methods
            this.handleGameData = this.handleGameData.bind(this);
      }

      /**
       * Initialize the game room controller
       */
      initialize(connection, gameCode, isHost, localClientId) {
            console.log('GameRoomController: Initializing with gameCode:', gameCode, 'isHost:', isHost);
            this.connection = connection;
            this.gameCode = gameCode;
            this.isHost = isHost;
            this.localClientId = localClientId || `client_${Date.now()}`;
            this.gameState = GAME_STATES.SETUP;

            // Initialize local client
            this.clients[this.localClientId] = {
                  id: this.localClientId,
                  isLocal: true,
                  isHost: isHost,
                  ready: false,
                  board: createEmptyBoard(),
                  placedShips: [],
                  sunkShips: [],
                  attacks: [], // Attacks made by this client
                  hits: [], // Successful hits by this client
                  misses: [], // Missed attacks by this client
            };

            // Add local client to order
            this.clientOrder.push(this.localClientId);

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

                  // Announce ourselves to the server
                  this.sendClientInfo();
            }
      }

      /**
       * Send client information to the server
       */
      sendClientInfo() {
            if (this.connection) {
                  this.connection.sendGameData({
                        type: 'client_info',
                        clientId: this.localClientId,
                        isHost: this.isHost,
                  });
            }
      }

      /**
       * Handle incoming game data
       */
      handleGameData(data) {
            console.log('GameRoomController: Received game data:', data);

            switch (data.type) {
                  case 'client_info':
                        this.handleClientInfo(data);
                        return true;

                  case 'client_ready':
                        this.handleClientReady(data);
                        return true;

                  case 'game_state_change':
                        this.handleGameStateChange(data);
                        return true;

                  case 'attack':
                        this.handleAttack(data);
                        return true;

                  case 'attack_result':
                        this.handleAttackResult(data);
                        return true;

                  case 'game_over':
                        this.handleGameOver(data);
                        return true;

                  case 'client_left':
                        this.handleClientLeft(data);
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
       * Handle client info message
       */
      handleClientInfo(data) {
            const { clientId, isHost } = data;

            // Don't add ourselves again
            if (clientId === this.localClientId) return;

            // Add or update client
            if (!this.clients[clientId]) {
                  // New client
                  this.clients[clientId] = {
                        id: clientId,
                        isLocal: false,
                        isHost: isHost,
                        ready: false,
                        board: createEmptyBoard(),
                        placedShips: [],
                        sunkShips: [],
                        attacks: [],
                        hits: [],
                        misses: [],
                  };

                  // Add to order
                  this.clientOrder.push(clientId);

                  // Notify listeners
                  if (this.listeners.onClientJoined) {
                        this.listeners.onClientJoined(this.clients[clientId]);
                  }

                  // If we're the host, send current game state to the new client
                  if (this.isHost) {
                        this.connection.sendGameData({
                              type: 'game_state_change',
                              state: this.gameState,
                              clientOrder: this.clientOrder,
                              currentTurnIndex: this.currentTurnIndex,
                        });
                  }
            } else {
                  // Update existing client
                  this.clients[clientId].isHost = isHost;
            }
      }

      /**
       * Handle client ready message
       */
      handleClientReady(data) {
            const { clientId, ready } = data;

            if (this.clients[clientId]) {
                  this.clients[clientId].ready = ready;

                  // Notify listeners
                  if (this.listeners.onClientReadyChanged) {
                        this.listeners.onClientReadyChanged(clientId, ready);
                  }

                  // Check if all clients are ready
                  if (this.areAllClientsReady() && this.listeners.onAllClientsReady) {
                        this.listeners.onAllClientsReady();

                        // If we're the host, advance the game state
                        if (this.isHost && this.gameState === GAME_STATES.PLACEMENT) {
                              this.startBattle();
                        }
                  }
            }
      }

      /**
       * Handle game state change message
       */
      handleGameStateChange(data) {
            const { state, clientOrder, currentTurnIndex } = data;

            // Update game state
            this.gameState = state;

            // Update client order if provided
            if (clientOrder) {
                  this.clientOrder = clientOrder;
            }

            // Update current turn if provided
            if (currentTurnIndex !== undefined) {
                  this.currentTurnIndex = currentTurnIndex;

                  // Notify turn change
                  if (this.listeners.onTurnChanged) {
                        this.listeners.onTurnChanged(this.getCurrentTurnClientId());
                  }
            }

            // Notify listeners
            if (this.listeners.onGameStateChanged) {
                  this.listeners.onGameStateChanged(state);
            }
      }

      /**
       * Handle attack message
       */
      handleAttack(data) {
            const { fromClientId, toClientId, row, col } = data;

            // Only process attacks directed at us
            if (toClientId !== this.localClientId) return;

            // Process the attack on our board
            const result = this.processAttackOnBoard(fromClientId, row, col);

            // Send result back
            if (this.connection) {
                  this.connection.sendGameData({
                        type: 'attack_result',
                        fromClientId: this.localClientId,
                        toClientId: fromClientId,
                        row,
                        col,
                        hit: result.hit,
                        shipId: result.shipId,
                        sunkShipId: result.sunkShipId,
                  });
            }

            // Check if all our ships are sunk
            if (this.areAllShipsSunk(this.localClientId)) {
                  // We're out of the game
                  this.clients[this.localClientId].ready = false;

                  // Check if game is over (only one client left with ships)
                  const activePlayers = this.getActivePlayerCount();
                  if (activePlayers <= 1) {
                        // Game over
                        const winner = this.getLastActivePlayer();
                        this.handleGameOver({ winnerId: winner });
                  }
            }
      }

      /**
       * Handle attack result message
       */
      handleAttackResult(data) {
            const { fromClientId, toClientId, row, col, hit, shipId, sunkShipId } = data;

            // Only process results for our attacks
            if (fromClientId !== this.localClientId) return;

            // Update target client's board in our local state
            if (this.clients[toClientId]) {
                  // Record the attack
                  this.clients[this.localClientId].attacks.push({ targetId: toClientId, row, col });

                  if (hit) {
                        this.clients[this.localClientId].hits.push({ targetId: toClientId, row, col, shipId });

                        // If a ship was sunk, record it
                        if (sunkShipId) {
                              this.clients[toClientId].sunkShips.push(sunkShipId);
                        }
                  } else {
                        this.clients[this.localClientId].misses.push({ targetId: toClientId, row, col });
                  }

                  // Notify listeners
                  if (this.listeners.onAttackResult) {
                        this.listeners.onAttackResult(toClientId, row, col, hit, shipId, sunkShipId);
                  }

                  // If we're the host, advance the turn
                  if (this.isHost) {
                        this.advanceTurn();
                  }
            }
      }

      /**
       * Handle game over message
       */
      handleGameOver(data) {
            const { winnerId } = data;

            this.gameState = GAME_STATES.FINISHED;
            this.winner = winnerId;

            // Notify listeners
            if (this.listeners.onGameOver) {
                  this.listeners.onGameOver(winnerId);
            }

            // If we're the host, broadcast game over
            if (this.isHost) {
                  this.connection.sendGameData({
                        type: 'game_over',
                        winnerId,
                  });
            }
      }

      /**
       * Handle client left message
       */
      handleClientLeft(data) {
            const { clientId } = data;

            if (this.clients[clientId]) {
                  // Remove client
                  delete this.clients[clientId];

                  // Remove from order
                  this.clientOrder = this.clientOrder.filter((id) => id !== clientId);

                  // Adjust current turn if needed
                  if (this.currentTurnIndex >= this.clientOrder.length) {
                        this.currentTurnIndex = 0;
                  }

                  // Notify listeners
                  if (this.listeners.onClientLeft) {
                        this.listeners.onClientLeft(clientId);
                  }

                  // If we're the host, check if game should end
                  if (this.isHost && this.gameState === GAME_STATES.BATTLE) {
                        const activePlayers = this.getActivePlayerCount();
                        if (activePlayers <= 1) {
                              // Game over
                              const winner = this.getLastActivePlayer();
                              this.handleGameOver({ winnerId: winner });
                        }
                  }
            }
      }

      /**
       * Process an attack on our board
       */
      processAttackOnBoard(fromClientId, row, col) {
            // TODO: Implement attack processing logic
            // This would use the existing processAttack function from gameState.js
            // For now, return a dummy result
            return {
                  hit: false,
                  shipId: null,
                  sunkShipId: null,
            };
      }

      /**
       * Check if all clients are ready
       */
      areAllClientsReady() {
            return Object.values(this.clients).every((client) => client.ready);
      }

      /**
       * Check if all ships of a client are sunk
       */
      areAllShipsSunk(clientId) {
            // TODO: Implement ship sinking check
            // For now, return false
            return false;
      }

      /**
       * Get the number of active players (with ships still afloat)
       */
      getActivePlayerCount() {
            return Object.values(this.clients).filter((client) => !this.areAllShipsSunk(client.id)).length;
      }

      /**
       * Get the ID of the last active player
       */
      getLastActivePlayer() {
            const activePlayers = Object.values(this.clients).filter((client) => !this.areAllShipsSunk(client.id));
            return activePlayers.length > 0 ? activePlayers[0].id : null;
      }

      /**
       * Mark the local client as ready
       */
      markReady(ready = true) {
            if (this.clients[this.localClientId]) {
                  this.clients[this.localClientId].ready = ready;

                  // Send ready status to other clients
                  if (this.connection) {
                        this.connection.sendGameData({
                              type: 'client_ready',
                              clientId: this.localClientId,
                              ready,
                        });
                  }

                  // Notify listeners
                  if (this.listeners.onClientReadyChanged) {
                        this.listeners.onClientReadyChanged(this.localClientId, ready);
                  }

                  // Check if all clients are ready
                  if (this.areAllClientsReady() && this.listeners.onAllClientsReady) {
                        this.listeners.onAllClientsReady();

                        // If we're the host, advance the game state
                        if (this.isHost && this.gameState === GAME_STATES.PLACEMENT) {
                              this.startBattle();
                        }
                  }

                  return true;
            }

            return false;
      }

      /**
       * Start the battle phase (host only)
       */
      startBattle() {
            if (!this.isHost) return false;

            this.gameState = GAME_STATES.BATTLE;
            this.currentTurnIndex = 0; // Host goes first

            // Send game state change to all clients
            if (this.connection) {
                  this.connection.sendGameData({
                        type: 'game_state_change',
                        state: GAME_STATES.BATTLE,
                        clientOrder: this.clientOrder,
                        currentTurnIndex: this.currentTurnIndex,
                  });
            }

            // Notify listeners
            if (this.listeners.onGameStateChanged) {
                  this.listeners.onGameStateChanged(GAME_STATES.BATTLE);
            }

            if (this.listeners.onTurnChanged) {
                  this.listeners.onTurnChanged(this.getCurrentTurnClientId());
            }

            return true;
      }

      /**
       * Advance to the next turn (host only)
       */
      advanceTurn() {
            if (!this.isHost) return false;

            // Move to next client
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.clientOrder.length;

            // Send turn change to all clients
            if (this.connection) {
                  this.connection.sendGameData({
                        type: 'game_state_change',
                        state: this.gameState,
                        currentTurnIndex: this.currentTurnIndex,
                  });
            }

            // Notify listeners
            if (this.listeners.onTurnChanged) {
                  this.listeners.onTurnChanged(this.getCurrentTurnClientId());
            }

            return true;
      }

      /**
       * Attack another client
       */
      attackClient(targetClientId, row, col) {
            // Check if it's our turn
            if (this.getCurrentTurnClientId() !== this.localClientId) {
                  console.log('GameRoomController: Not your turn');
                  return false;
            }

            // Check if target client exists
            if (!this.clients[targetClientId]) {
                  console.log('GameRoomController: Target client does not exist');
                  return false;
            }

            // Send attack to target
            if (this.connection) {
                  this.connection.sendGameData({
                        type: 'attack',
                        fromClientId: this.localClientId,
                        toClientId: targetClientId,
                        row,
                        col,
                  });

                  return true;
            }

            return false;
      }

      /**
       * Get the client ID whose turn it is
       */
      getCurrentTurnClientId() {
            return this.clientOrder[this.currentTurnIndex];
      }

      /**
       * Check if it's the local client's turn
       */
      isLocalClientTurn() {
            return this.getCurrentTurnClientId() === this.localClientId;
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
                  gameCode: this.gameCode,
                  localClientId: this.localClientId,
                  isHost: this.isHost,
                  clients: this.clients,
                  clientOrder: this.clientOrder,
                  currentTurnIndex: this.currentTurnIndex,
                  gameState: this.gameState,
                  winner: this.winner,
            };
      }
}

// Create a singleton instance
const gameRoomController = new GameRoomController();

export default gameRoomController;
