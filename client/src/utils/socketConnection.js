// Import socket.io-client directly
// Server code repository: https://github.com/alexmvie/battleships-expo-socket--server
// Client code repository: https://github.com/alexmvie/battleships-expo-socket--client
import { io } from 'socket.io-client';
import { Alert, Platform } from 'react-native';
import { SERVER_URL } from '../config/appConfig';

class SocketConnection {
      constructor(gameCode, isHost, onConnectionEstablished, onDataReceived, onDisconnect) {
            this.socket = null;
            this.gameCode = gameCode;
            this.isHost = isHost;
            this.onConnectionEstablished = onConnectionEstablished;
            this.onDataReceived = onDataReceived;
            this.onDisconnect = onDisconnect;
            this.heartbeatInterval = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.isConnected = false;
            this.isReconnecting = false;

            this.init();
      }

      async init() {
            try {
                  console.log('Initializing socket connection to server...');

                  // Connect to the deployed Socket.io server on Render.com
                  const socketUrl = SERVER_URL;
                  console.log('Socket URL:', socketUrl);

                  // Use the exact same configuration that worked in our CORS test page
                  this.socket = io(socketUrl, {
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        forceNew: true,
                        timeout: 20000,
                        withCredentials: false,
                  });

                  console.log('Socket object created:', !!this.socket);

                  // Log socket properties
                  console.log('Socket properties:', {
                        connected: this.socket.connected,
                        id: this.socket.id,
                        disconnected: this.socket.disconnected,
                  });

                  // Set up event listeners
                  this.setupEventListeners();

                  // Create or join a game
                  if (this.isHost) {
                        this.createGame();
                  } else {
                        this.joinGame();
                  }
            } catch (error) {
                  console.error('Failed to initialize socket connection:', error);
                  Alert.alert('Connection Error', 'Failed to initialize connection');
            }
      }

      setupEventListeners() {
            console.log('Setting up socket event listeners...');

            if (!this.socket) {
                  console.error('Cannot set up event listeners: socket is null');
                  return;
            }

            // Connection established with the server
            this.socket.on('connect', () => {
                  console.log('Connected to server with ID:', this.socket.id);
                  this.isConnected = true;

                  // If we're the host, create a game
                  if (this.isHost) {
                        console.log('Host creating game with code:', this.gameCode);
                        this.createGame();
                  } else {
                        console.log('Client joining game with code:', this.gameCode);
                        this.joinGame();
                  }

                  if (this.onConnectionEstablished) {
                        this.onConnectionEstablished();
                  }
            });

            // Connection error
            this.socket.on('connect_error', (error) => {
                  console.error('Connection error:', error);
                  console.error('Error details:', {
                        message: error.message,
                        description: error.description,
                        type: error.type,
                  });
                  this.attemptReconnect();
            });

            // Disconnected from server
            this.socket.on('disconnect', (reason) => {
                  console.log('Disconnected from server:', reason);
                  this.isConnected = false;
                  this.attemptReconnect();
            });

            // Server error
            this.socket.on('error', (error) => {
                  console.error('Server error:', error);
                  Alert.alert('Error', error.message || 'An error occurred');
            });

            // Game created successfully (host only)
            this.socket.on('game-created', (data) => {
                  console.log('Game created:', data.gameCode);
            });

            // Game joined successfully (client only)
            this.socket.on('game-joined', (data) => {
                  console.log('Game joined:', data.gameCode);
            });

            // Game is ready (both players connected)
            this.socket.on('game-ready', (data) => {
                  console.log('Game ready:', data.gameCode);
                  this.isConnected = true;
                  this.reconnectAttempts = 0;
                  this.startHeartbeat();

                  if (this.onConnectionEstablished) {
                        this.onConnectionEstablished();
                  }
            });

            // Received game data from the other player
            this.socket.on('game-data', (data) => {
                  console.log('Received game data:', data);

                  if (this.onDataReceived) {
                        this.onDataReceived(data);
                  }
            });

            // Handle start_game event specifically
            this.socket.on('start_game', () => {
                  console.log('Received direct start_game event');

                  if (this.onDataReceived) {
                        this.onDataReceived({ type: 'start_game' });
                  }
            });

            // Handle battle_start event specifically
            this.socket.on('battle_start', () => {
                  console.log('Received direct battle_start event');

                  if (this.onDataReceived) {
                        this.onDataReceived({ type: 'battle_start' });
                  }
            });

            // Opponent disconnected
            this.socket.on('opponent-disconnected', () => {
                  console.log('Opponent disconnected');
                  Alert.alert('Opponent Disconnected', 'Your opponent has left the game.');

                  if (this.onDisconnect) {
                        this.onDisconnect();
                  }
            });

            // Heartbeat acknowledgment
            this.socket.on('heartbeat-ack', () => {
                  console.log('Heartbeat acknowledged');
            });
      }

      createGame() {
            console.log('Creating game with code:', this.gameCode);
            this.socket.emit('create-game', this.gameCode);
      }

      joinGame() {
            console.log('Joining game with code:', this.gameCode);
            this.socket.emit('join-game', this.gameCode);
      }

      attemptReconnect() {
            if (this.isReconnecting) return;

            this.isReconnecting = true;
            this.reconnectAttempts++;

            console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                  // Exponential backoff for reconnection attempts
                  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

                  setTimeout(() => {
                        console.log('Attempting to reconnect...');

                        // Check if the socket is already connected
                        if (this.socket && this.socket.connected) {
                              console.log('Socket is already connected, rejoining game room');
                              // Re-join the game room
                              if (this.isHost) {
                                    this.createGame();
                              } else {
                                    this.joinGame();
                              }

                              // Mark as connected
                              this.isConnected = true;

                              // Reset reconnection attempts
                              this.reconnectAttempts = 0;
                        } else if (this.socket) {
                              console.log('Socket is not connected, attempting to reconnect');

                              // Try to reconnect the socket
                              this.socket.connect();

                              // Set a timeout to check if the connection was successful
                              setTimeout(() => {
                                    if (this.socket && this.socket.connected) {
                                          console.log('Socket reconnected successfully, rejoining game room');
                                          // Re-join the game room
                                          if (this.isHost) {
                                                this.createGame();
                                          } else {
                                                this.joinGame();
                                          }

                                          // Mark as connected
                                          this.isConnected = true;

                                          // Reset reconnection attempts
                                          this.reconnectAttempts = 0;
                                    } else {
                                          console.log('Socket reconnection failed');
                                          // Try again with the next attempt
                                          this.isReconnecting = false;
                                          this.attemptReconnect();
                                    }
                              }, 1000);
                        } else {
                              console.log('Socket is null, cannot reconnect');
                              this.isReconnecting = false;

                              if (this.onDisconnect) {
                                    this.onDisconnect();
                              }
                              return;
                        }

                        this.isReconnecting = false;
                  }, delay);
            } else {
                  console.log('Max reconnection attempts reached');
                  this.isReconnecting = false;

                  if (this.onDisconnect) {
                        this.onDisconnect();
                  }
            }
      }

      startHeartbeat() {
            // Clear any existing heartbeat
            this.stopHeartbeat();

            // Send a heartbeat every 5 seconds to keep the connection alive
            this.heartbeatInterval = setInterval(() => {
                  if (this.socket && this.socket.connected) {
                        this.socket.emit('heartbeat');
                  } else {
                        console.log('Socket not connected during heartbeat');
                        this.stopHeartbeat();
                        this.attemptReconnect();
                  }
            }, 5000);

            // Make sure the interval doesn't prevent the app from sleeping on mobile
            if (Platform.OS !== 'web') {
                  // For React Native, we would use AppState to handle background/foreground transitions
                  // This is simplified for the web version
            }
      }

      stopHeartbeat() {
            if (this.heartbeatInterval) {
                  clearInterval(this.heartbeatInterval);
                  this.heartbeatInterval = null;
            }
      }

      sendGameData(data) {
            // Add more detailed logging to help debug connection issues
            if (!this.socket) {
                  console.error('Cannot send data: socket is null');
                  // Try to reinitialize the socket connection
                  setTimeout(() => this.init(), 500);
                  return false;
            }

            if (!this.isConnected) {
                  console.warn('Cannot send data: not marked as connected');
                  // Try to reconnect if the socket exists but is not connected
                  if (this.socket) {
                        this.attemptReconnect();
                  } else {
                        setTimeout(() => this.init(), 500);
                  }
                  return false;
            }

            if (this.socket && this.socket.connected) {
                  try {
                        console.log('Sending game data:', data);
                        this.socket.emit('game-data', {
                              gameCode: this.gameCode,
                              ...data,
                        });
                        return true;
                  } catch (error) {
                        console.error('Error sending data:', error);
                        this.attemptReconnect();
                        return false;
                  }
            } else {
                  console.warn('Cannot send data: socket not connected');
                  // Only attempt reconnect if we think we should be connected
                  if (this.isConnected) {
                        this.attemptReconnect();
                  } else if (this.socket) {
                        // Try to connect if the socket exists but is not connected
                        this.socket.connect();
                  } else {
                        // Reinitialize if the socket is null
                        setTimeout(() => this.init(), 500);
                  }
                  return false;
            }
      }

      disconnect() {
            this.stopHeartbeat();

            if (this.socket) {
                  this.socket.disconnect();
                  this.socket = null;
            }
      }
}

export default SocketConnection;
