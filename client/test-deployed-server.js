const { io } = require('socket.io-client');

console.log('Starting socket.io client test for deployed server...');

// Connect to the deployed Socket.io server on Render.com
const socketUrl = 'https://battleships-expo-p2p.onrender.com';
console.log(`Socket URL: ${socketUrl}`);

try {
      // Use the same configuration that worked in our local test
      const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            forceNew: true,
            timeout: 20000,
      });

      console.log(`Socket object created: ${!!socket}`);

      socket.on('connect', () => {
            console.log(`Connected to server with ID: ${socket.id}`);

            // Create a test game
            const gameCode = 'TEST123';
            console.log(`Creating test game with code: ${gameCode}`);
            socket.emit('create-game', gameCode);

            // Set up a timeout to disconnect after 10 seconds
            setTimeout(() => {
                  console.log('Test complete, disconnecting...');
                  socket.disconnect();
                  process.exit(0);
            }, 10000);
      });

      socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            console.error('Error details:', {
                  message: error.message,
                  description: error.description,
                  type: error.type,
            });
            process.exit(1);
      });

      socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
      });

      socket.on('error', (error) => {
            console.error('Server error:', error);
            process.exit(1);
      });

      socket.on('game-created', (data) => {
            console.log('Game created:', data.gameCode);
      });
} catch (error) {
      console.error('Error initializing socket:', error);
      process.exit(1);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
      console.log('Caught interrupt signal, disconnecting...');
      process.exit(0);
});
