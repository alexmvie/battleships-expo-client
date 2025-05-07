# Project Structure

This repository contains a Battleship multiplayer game with the following structure:

## Root Directory

The root directory contains:

- `README.md` - Main documentation for the project
- `.gitignore` - Git ignore file for the entire repository
- `.gitmodules` - Git submodules configuration
- `PROJECT_STRUCTURE.md` - This file explaining the project structure

## Client Directory

The `client` directory contains the Expo/React Native application:

- `App.js` - Main application component
- `app.json` - Expo configuration
- `babel.config.js` - Babel configuration
- `package.json` - NPM dependencies and scripts
- `src/` - Source code for the application
  - `components/` - Reusable React components
  - `screens/` - Screen components
  - `utils/` - Utility functions and classes
- `.expo/` - Expo configuration
- `node_modules/` - NPM dependencies
- `.vscode/` - VS Code configuration

## Server Directory

The `server` directory is a Git submodule pointing to the server repository:

- `index.js` - Main server file
- `package.json` - NPM dependencies and scripts
- `node_modules/` - NPM dependencies

The server code is available at: https://github.com/alexmvie/battleships-expo-socket--server

## Development Workflow

1. Clone the repository with submodules:
   ```
   git clone --recurse-submodules https://github.com/alexmvie/battleships-expo-socket--client.git
   ```

2. To run the client:
   ```
   cd client
   npm install
   npm start
   ```

3. To run the server:
   ```
   cd server
   npm install
   npm start
   ```
