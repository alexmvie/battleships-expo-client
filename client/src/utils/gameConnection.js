import Peer from 'peerjs';
import { Alert, Platform } from 'react-native';

class GameConnection {
      constructor(gameCode, isHost, onConnectionEstablished, onDataReceived, onDisconnect) {
            this.peer = null;
            this.connection = null;
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
                  // Initialize peer with random ID for client, specific ID for host
                  // Use a simpler ID format to avoid potential issues
                  const peerId = this.isHost ? `bs-${this.gameCode}` : `client-${Math.floor(Math.random() * 1000000)}`;

                  // Configure PeerJS with more reliable options
                  // Use 0.peerjs.com which is a public PeerJS server
                  this.peer = new Peer(peerId, {
                        debug: 3, // Enable detailed logging
                        host: '0.peerjs.com',
                        port: 443,
                        secure: true,
                        path: '/',
                        config: {
                              iceServers: [
                                    { urls: 'stun:stun.l.google.com:19302' },
                                    { urls: 'stun:stun1.l.google.com:19302' },
                                    { urls: 'stun:stun2.l.google.com:19302' },
                                    { urls: 'stun:stun3.l.google.com:19302' },
                                    { urls: 'stun:stun4.l.google.com:19302' },
                                    { urls: 'stun:global.stun.twilio.com:3478' },
                              ],
                              iceCandidatePoolSize: 10,
                        },
                        // Increase timeouts for better reliability
                        pingInterval: 3000,
                  });

                  this.peer.on('open', (id) => {
                        console.log('My peer ID is: ' + id);
                        console.log('PeerJS connection established with server');
                        console.log('isHost:', this.isHost);
                        console.log('gameCode:', this.gameCode);

                        // Add a small delay before connecting to host to ensure the server connection is fully established
                        if (!this.isHost) {
                              console.log('Will connect to host in 1 second...');
                              setTimeout(() => {
                                    console.log('Now connecting to host...');
                                    this.connectToHost();
                              }, 1000);
                        } else {
                              console.log('Host is ready to accept connections');
                        }
                  });

                  this.peer.on('connection', (conn) => {
                        this.handleConnection(conn);
                  });

                  this.peer.on('disconnected', () => {
                        console.log('Peer disconnected, attempting to reconnect...');
                        this.attemptReconnect();
                  });

                  this.peer.on('error', (err) => {
                        console.error('Peer connection error:', err);
                        console.error('Error type:', err.type);

                        // Log more detailed error information
                        if (err.type === 'peer-unavailable') {
                              const hostId = `bs-${this.gameCode}`;
                              console.error(`Could not find peer with ID: ${hostId}`);
                              console.error('This usually means the host has not created the game yet or has disconnected');

                              // If we're not the host and can't find the peer, wait a bit and try again
                              if (!this.isHost) {
                                    setTimeout(() => this.connectToHost(), 3000);
                              }
                        } else if (err.type === 'network') {
                              console.error('Network connection error');
                              console.error('Details:', err.message || 'No additional details');
                        } else if (err.type === 'server-error') {
                              console.error('PeerJS server error');
                              console.error('Details:', err.message || 'No additional details');
                        } else if (err.type === 'socket-error') {
                              console.error('Socket connection error');
                              console.error('Details:', err.message || 'No additional details');
                        } else if (err.type === 'socket-closed') {
                              console.error('Socket connection closed unexpectedly');
                              console.error('Details:', err.message || 'No additional details');
                        } else {
                              console.error('Unknown error type:', err.type);
                              console.error('Details:', err.message || 'No additional details');
                        }

                        // Don't show alert for expected errors during reconnection attempts
                        if (!this.isReconnecting) {
                              Alert.alert(
                                    'Connection Error',
                                    `Connection issue detected (${err.type}). Attempting to reconnect...`,
                                    [{ text: 'OK' }]
                              );
                        }

                        // Always attempt to reconnect for any error
                        this.attemptReconnect();
                  });
            } catch (error) {
                  console.error('Failed to initialize peer:', error);
                  Alert.alert('Connection Error', 'Failed to initialize connection');
            }
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
                        if (this.peer && this.peer.disconnected) {
                              console.log('Attempting to reconnect peer...');
                              this.peer.reconnect();
                        }

                        if (!this.connection || this.connection.closed) {
                              console.log('Attempting to reestablish connection...');
                              if (this.isHost) {
                                    // Host just waits for new connections
                                    console.log('Host waiting for new connection...');
                              } else {
                                    // Client tries to reconnect
                                    this.connectToHost();
                              }
                        }

                        this.isReconnecting = false;
                  }, delay);
            } else {
                  console.log('Max reconnection attempts reached');
                  this.isReconnecting = false;
                  this.onDisconnect();
            }
      }

      connectToHost() {
            const hostId = `bs-${this.gameCode}`;
            console.log(`Connecting to host: ${hostId}`);
            try {
                  const conn = this.peer.connect(hostId, {
                        reliable: true,
                        serialization: 'json',
                        metadata: { gameCode: this.gameCode },
                  });

                  if (!conn) {
                        console.error('Failed to create connection object');
                        setTimeout(() => this.connectToHost(), 2000);
                        return;
                  }

                  // Set a timeout in case the connection never triggers 'open' or 'error'
                  const connectionTimeout = setTimeout(() => {
                        console.warn('Connection timeout - retrying');
                        if (!this.isConnected) {
                              this.connectToHost();
                        }
                  }, 10000);

                  // Clear the timeout when connection opens or errors
                  conn.on('open', () => clearTimeout(connectionTimeout));
                  conn.on('error', () => clearTimeout(connectionTimeout));

                  this.handleConnection(conn);
            } catch (error) {
                  console.error('Error connecting to host:', error);
                  setTimeout(() => this.connectToHost(), 2000);
            }
      }

      handleConnection(conn) {
            if (!conn) {
                  console.error('Received null connection in handleConnection');
                  return;
            }

            this.connection = conn;

            conn.on('open', () => {
                  console.log('Connection established');
                  this.isConnected = true;
                  this.reconnectAttempts = 0;

                  // Start sending heartbeats to keep the connection alive
                  this.startHeartbeat();

                  // Make sure the connection is fully established before calling onConnectionEstablished
                  // This helps prevent the "Cannot read properties of null" error
                  setTimeout(() => {
                        console.log('Calling onConnectionEstablished after delay');
                        if (this.onConnectionEstablished) {
                              try {
                                    this.onConnectionEstablished();
                              } catch (error) {
                                    console.error('Error in onConnectionEstablished callback:', error);
                              }
                        }

                        // Send an initial ping to verify connection
                        this.sendGameData({ type: 'ping', timestamp: Date.now() });
                  }, 1000); // Increased delay for better reliability
            });

            conn.on('data', (data) => {
                  console.log('Received data:', data);

                  try {
                        // Handle heartbeat messages internally
                        if (data.type === 'ping') {
                              this.sendGameData({ type: 'pong', timestamp: data.timestamp });
                              return;
                        } else if (data.type === 'pong') {
                              const latency = Date.now() - data.timestamp;
                              console.log(`Connection latency: ${latency}ms`);
                              return;
                        }

                        if (this.onDataReceived) {
                              this.onDataReceived(data);
                        }
                  } catch (error) {
                        console.error('Error handling received data:', error);
                  }
            });

            conn.on('close', () => {
                  console.log('Connection closed');
                  this.isConnected = false;
                  this.stopHeartbeat();
                  this.attemptReconnect();
            });

            conn.on('error', (err) => {
                  console.error('Connection error:', err);
                  this.isConnected = false;
                  this.stopHeartbeat();
                  this.attemptReconnect();
            });

            // Add an additional check to verify the connection is working
            if (conn.open) {
                  console.log('Connection is already open');
                  this.isConnected = true;
                  this.reconnectAttempts = 0;
                  this.startHeartbeat();

                  if (this.onConnectionEstablished) {
                        setTimeout(() => {
                              try {
                                    this.onConnectionEstablished();
                              } catch (error) {
                                    console.error('Error in onConnectionEstablished callback (already open):', error);
                              }
                        }, 500);
                  }
            }
      }

      startHeartbeat() {
            // Clear any existing heartbeat
            this.stopHeartbeat();

            // Send a heartbeat every 5 seconds to keep the connection alive
            this.heartbeatInterval = setInterval(() => {
                  if (this.connection && this.connection.open) {
                        this.sendGameData({ type: 'ping', timestamp: Date.now() });
                  } else {
                        console.log('Connection not open during heartbeat');
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
            if (!this.connection) {
                  console.error('Cannot send data: connection is null');
                  return false;
            }

            if (!this.isConnected) {
                  console.warn('Cannot send data: not marked as connected');
                  return false;
            }

            if (this.connection && this.connection.open) {
                  try {
                        console.log('Sending data:', data);
                        this.connection.send(data);
                        return true;
                  } catch (error) {
                        console.error('Error sending data:', error);
                        this.attemptReconnect();
                        return false;
                  }
            } else {
                  console.warn('Cannot send data: connection not open');
                  // Only attempt reconnect if we think we should be connected
                  if (this.isConnected) {
                        this.attemptReconnect();
                  }
                  return false;
            }
      }

      disconnect() {
            this.stopHeartbeat();

            if (this.connection) {
                  this.connection.close();
                  this.connection = null;
            }

            if (this.peer) {
                  this.peer.destroy();
                  this.peer = null;
            }
      }
}

export default GameConnection;
