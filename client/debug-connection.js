const { io } = require('socket.io-client');

console.log('Starting detailed socket.io client test...');

// Connect to the deployed Socket.io server on Render.com
const socketUrl = 'https://battleships-expo-p2p.onrender.com';
console.log(`Socket URL: ${socketUrl}`);

// Create a more detailed test with verbose logging
try {
  console.log('Creating socket with options...');
  
  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    forceNew: true,
    timeout: 20000,
    autoConnect: false, // Don't connect automatically
  });
  
  console.log('Socket object created:', !!socket);
  console.log('Socket ID (before connect):', socket.id);
  console.log('Socket connected (before connect):', socket.connected);
  
  // Set up all event listeners before connecting
  
  // Connection established with the server
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    console.log('Socket connected status:', socket.connected);
    
    // Create a test game
    const gameCode = 'DEBUG123';
    console.log(`Creating test game with code: ${gameCode}`);
    socket.emit('create-game', gameCode);
    
    // Set up a timeout to disconnect after 10 seconds
    setTimeout(() => {
      console.log('Test complete, disconnecting...');
      socket.disconnect();
      process.exit(0);
    }, 10000);
  });
  
  // Connection error
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    console.error('Error details:', {
      message: error.message,
      description: error.description,
      type: error.type,
    });
  });
  
  // Disconnected from server
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
  });
  
  // Server error
  socket.on('error', (error) => {
    console.error('Server error:', error);
  });
  
  // Game created successfully
  socket.on('game-created', (data) => {
    console.log('Game created:', data.gameCode);
  });
  
  // Now connect to the server
  console.log('Connecting to server...');
  socket.connect();
  
  // Check connection status after a short delay
  setTimeout(() => {
    console.log('Connection status after 1 second:');
    console.log('Socket ID:', socket.id);
    console.log('Socket connected:', socket.connected);
    
    if (!socket.connected) {
      console.log('Still not connected after 1 second, checking engine.io state...');
      // Try to access internal engine.io state if available
      if (socket.io && socket.io.engine) {
        console.log('Engine state:', socket.io.engine.readyState);
        console.log('Transport:', socket.io.engine.transport && socket.io.engine.transport.name);
      }
    }
  }, 1000);
  
} catch (error) {
  console.error('Error initializing socket:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('Caught interrupt signal, disconnecting...');
  process.exit(0);
});
