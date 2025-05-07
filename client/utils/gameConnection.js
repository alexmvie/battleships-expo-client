import Peer from 'peerjs';
import { Alert } from 'react-native';

class GameConnection {
  constructor(gameCode, isHost, onConnectionEstablished, onDataReceived, onDisconnect) {
    this.peer = null;
    this.connection = null;
    this.gameCode = gameCode;
    this.isHost = isHost;
    this.onConnectionEstablished = onConnectionEstablished;
    this.onDataReceived = onDataReceived;
    this.onDisconnect = onDisconnect;
    
    this.init();
  }

  async init() {
    try {
      // Initialize peer with random ID for client, specific ID for host
      const peerId = this.isHost ? `battleships-${this.gameCode}` : Math.random().toString(36).substring(2, 15);
      
      this.peer = new Peer(peerId);
      
      this.peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        
        if (!this.isHost) {
          this.connectToHost();
        }
      });
      
      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });
      
      this.peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        Alert.alert('Connection Error', 'Failed to establish connection');
        this.onDisconnect();
      });
    } catch (error) {
      console.error('Failed to initialize peer:', error);
    }
  }
  
  connectToHost() {
    const conn = this.peer.connect(`battleships-${this.gameCode}`);
    this.handleConnection(conn);
  }
  
  handleConnection(conn) {
    this.connection = conn;
    
    conn.on('open', () => {
      console.log('Connection established');
      this.onConnectionEstablished();
    });
    
    conn.on('data', (data) => {
      console.log('Received data:', data);
      this.onDataReceived(data);
    });
    
    conn.on('close', () => {
      console.log('Connection closed');
      this.onDisconnect();
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.onDisconnect();
    });
  }
  
  sendGameData(data) {
    if (this.connection && this.connection.open) {
      this.connection.send(data);
    }
  }
  
  disconnect() {
    if (this.connection) {
      this.connection.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export default GameConnection;