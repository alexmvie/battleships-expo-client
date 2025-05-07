# Battleship Multiplayer Game

A mobile-friendly multiplayer Battleship game built with React Native and Expo, featuring real-time multiplayer functionality via Socket.io.

## Features

- **Multiplayer Gameplay**: Play against friends in real-time using a Socket.io server
- **Ship Placement**: Place ships on the board by tapping
- **Turn-Based Gameplay**: Take turns attacking your opponent's ships
- **Animations**: Visual feedback for hits, misses, and sunk ships
- **Responsive Design**: Works on mobile and desktop browsers

## Recent Fixes

- **Fixed Ready Button**: Prevented multiple clicks on the "READY TO BATTLE" button
- **Improved Game State Management**: Made game state transitions more stable and reliable
- **Added Navigation Guards**: Prevented duplicate navigation to the Game screen
- **Enhanced Server-Side Validation**: Improved handling of ready messages and game starts

## Setup Instructions

### Client Setup

1. Install dependencies:

      ```
      npm install
      ```

2. Start the development server:

      ```
      npm start
      ```

3. Open the app in a web browser:
      ```
      npm run web
      ```

### Server Setup

1. Navigate to the server directory:

      ```
      cd server
      ```

2. Install dependencies:

      ```
      npm install
      ```

3. Start the server:
      ```
      npm start
      ```

## Deployment

### Client Deployment

The client can be deployed to Expo or any other React Native hosting service.

### Server Deployment

The Socket.io server is deployed on Render.com at:

```
https://battleships-expo-p2p.onrender.com
```

To deploy your own instance:

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Configure the service:
      - Name: battleship-socket-server
      - Environment: Node
      - Root Directory: server
      - Build Command: `npm install`
      - Start Command: `npm start`
4. Deploy the service

## How to Play

1. One player creates a game and gets a game code
2. The second player joins using the game code
3. Both players place their ships
4. Players take turns firing at the opponent's grid
5. The first player to sink all opponent's ships wins

## Technologies Used

- **Frontend**: React Native with Expo
- **Multiplayer**: Socket.io for real-time communication
- **Server**: Node.js with Express
- **Deployment**: Render.com for hosting the Socket.io server

## Testing

The project includes test scripts to verify the Socket.io connection:

- `test-deployed-server.js`: Tests connection to the deployed server
- `test-socket.js`: Tests connection to a local server
- `test-cors.html`: Tests CORS configuration with a browser-based client
