/**
 * Application configuration and constants
 */

// App version - update this when making significant changes
export const APP_VERSION = '1.1.0';

// Server URL
export const SERVER_URL = 'https://battleships-expo-p2p.onrender.com';

// Game states
export const GAME_STATES = {
      SETUP: 'SETUP', // Players are joining and setting up
      PLACEMENT: 'PLACEMENT', // Players are placing ships
      BATTLE: 'BATTLE', // Players are battling
      FINISHED: 'FINISHED', // Game is over
};

// Debug mode - set to true to show additional debugging information
export const DEBUG_MODE = true;

// Function to generate a short ID for display
export const shortenId = (id) => {
      if (!id) return 'unknown';
      return id.substring(0, 6);
};

export default {
      APP_VERSION,
      SERVER_URL,
      GAME_STATES,
      DEBUG_MODE,
      shortenId,
};
