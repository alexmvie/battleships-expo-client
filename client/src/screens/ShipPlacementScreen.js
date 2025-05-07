import React, { useState, useEffect, useCallback } from 'react';
import {
      View,
      Text,
      StyleSheet,
      TouchableOpacity,
      Alert,
      ScrollView,
      Dimensions,
      useWindowDimensions,
      AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHIPS } from '../utils/gameState';
import GameBoard from '../components/GameBoard';
import gameController from '../controllers/GameController';

const ShipPlacementScreen = ({ navigation, route }) => {
      const { gameCode, isHost, connection } = route.params;
      const window = useWindowDimensions();
      const [board, setBoard] = useState(gameController.getGameState().board);
      const [selectedShip, setSelectedShip] = useState(SHIPS.CARRIER);
      const [placedShips, setPlacedShips] = useState(gameController.getGameState().placedShips);
      const [isHorizontal, setIsHorizontal] = useState(true);
      const [opponentReady, setOpponentReady] = useState(gameController.getGameState().opponentReady);
      const [playerReady, setPlayerReady] = useState(gameController.getGameState().playerReady);
      const [reconnecting, setReconnecting] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);
      const [readyButtonDisabled, setReadyButtonDisabled] = useState(playerReady);

      // Initialize the game controller
      useEffect(() => {
            console.log('Initializing game controller with gameCode:', gameCode, 'isHost:', isHost);
            gameController.initialize(connection, gameCode, isHost);
            
            // Set up event listeners
            gameController.on('onBoardUpdated', (newBoard) => {
                  setBoard(newBoard);
            });
            
            gameController.on('onPlacedShipsUpdated', (newPlacedShips) => {
                  setPlacedShips(newPlacedShips);
                  
                  // Select next ship or clear selection if all ships are placed
                  if (newPlacedShips.length > 0) {
                        selectNextShip(newPlacedShips[newPlacedShips.length - 1]);
                  }
            });
            
            gameController.on('onPlayerReadyUpdated', (isReady) => {
                  setPlayerReady(isReady);
                  setReadyButtonDisabled(isReady);
            });
            
            gameController.on('onOpponentReadyUpdated', (isReady) => {
                  setOpponentReady(isReady);
                  
                  if (isReady) {
                        Alert.alert('Opponent Ready', 'Your opponent is ready for battle!');
                  }
            });
            
            gameController.on('onBothPlayersReady', () => {
                  if (isHost) {
                        Alert.alert('Both Players Ready', 'Both players are ready. You can start the battle!');
                  } else {
                        Alert.alert('Both Players Ready', 'Both players are ready. Waiting for host to start the game...');
                  }
            });
            
            gameController.on('onGameStart', () => {
                  // Navigate to game screen after a short delay
                  setTimeout(() => {
                        navigation.navigate('Game', {
                              gameCode,
                              isHost,
                              connection,
                              playerBoard: gameController.getGameState().board,
                        });
                  }, 1000);
            });
            
            gameController.on('onConnectionLost', () => {
                  Alert.alert(
                        'Connection Lost',
                        'The connection to the other player was lost. Returning to home screen.',
                        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
                  );
            });
            
            // Clean up
            return () => {
                  // Reset event listeners
                  gameController.on('onBoardUpdated', null);
                  gameController.on('onPlacedShipsUpdated', null);
                  gameController.on('onPlayerReadyUpdated', null);
                  gameController.on('onOpponentReadyUpdated', null);
                  gameController.on('onBothPlayersReady', null);
                  gameController.on('onGameStart', null);
                  gameController.on('onConnectionLost', null);
            };
      }, [connection, gameCode, isHost, navigation]);

      // Check orientation
      useEffect(() => {
            const updateOrientation = () => {
                  const window = Dimensions.get('window');
                  setIsLandscape(window.width > window.height);
            };

            // Set initial orientation
            updateOrientation();

            // Listen for orientation changes
            Dimensions.addEventListener('change', updateOrientation);

            return () => {
                  // Clean up listener
                  if (Dimensions.removeEventListener) {
                        Dimensions.removeEventListener('change', updateOrientation);
                  }
            };
      }, []);

      // Set up AppState change listener
      useEffect(() => {
            // Function to handle app state changes
            const handleAppStateChange = (nextAppState) => {
                  if (nextAppState === 'active' && connection) {
                        console.log('App has come to the foreground, checking connection...');
                        handleVisibilityChange();
                  }
            };

            // Add event listener - handle both newer and older React Native versions
            let appStateSubscription;
            if (AppState.addEventListener) {
                  // Newer versions of React Native
                  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
            } else {
                  // Older versions of React Native
                  AppState.addEventListener('change', handleAppStateChange);
            }

            // Clean up the subscription
            return () => {
                  if (appStateSubscription?.remove) {
                        // Newer versions of React Native
                        appStateSubscription.remove();
                  } else if (AppState.removeEventListener) {
                        // Older versions of React Native
                        AppState.removeEventListener('change', handleAppStateChange);
                  }
            };
      }, [connection, handleVisibilityChange]);

      // Handle tab visibility changes - modified for React Native
      const handleVisibilityChange = useCallback(() => {
            // In React Native, we don't have document.visibilityState
            // This function is primarily for web, but we'll keep a simplified version for React Native
            if (connection) {
                  console.log('Checking connection...');
                  // Send a ping to check if connection is still alive
                  const pingSuccess = connection.sendGameData({ type: 'ping', timestamp: Date.now() });

                  if (!pingSuccess && !reconnecting) {
                        setReconnecting(true);

                        // Give the connection a moment to attempt reconnection
                        setTimeout(() => {
                              setReconnecting(false);
                              // Check if we're still disconnected
                              if (connection && !connection.isConnected) {
                                    Alert.alert(
                                          'Connection Lost',
                                          'The connection to the other player was lost. Returning to home screen.',
                                          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
                                    );
                              }
                        }, 5000);
                  }
            }
      }, [connection, reconnecting, navigation]);

      const handleCellPress = (row, col) => {
            if (!selectedShip) return;
            
            // Use the game controller to place the ship
            const success = gameController.placeShip(selectedShip, row, col, isHorizontal);
            
            if (!success) {
                  Alert.alert('Invalid Placement', 'You cannot place the ship here. Try another position or orientation.');
            }
      };

      const selectNextShip = (currentShipId) => {
            const shipIds = Object.values(SHIPS).map((ship) => ship.id);
            const currentIndex = shipIds.indexOf(currentShipId);

            // Find the next unplaced ship
            for (let i = currentIndex + 1; i < shipIds.length; i++) {
                  const nextShipId = shipIds[i];
                  if (!placedShips.includes(nextShipId)) {
                        setSelectedShip(Object.values(SHIPS).find((ship) => ship.id === nextShipId));
                        return;
                  }
            }

            // If we get here, all ships are placed
            setSelectedShip(null);
      };

      const handleShipSelect = (ship) => {
            if (!placedShips.includes(ship.id)) {
                  setSelectedShip(ship);
            }
      };

      const handleRotate = () => {
            setIsHorizontal(!isHorizontal);
      };

      const handleReset = () => {
            // Use the game controller to reset the game
            gameController.reset();
            setSelectedShip(SHIPS.CARRIER);
            setIsHorizontal(true);
      };

      const handleReady = () => {
            console.log('Ready button pressed. Current state:', { readyButtonDisabled, playerReady });
            
            // Prevent multiple clicks
            if (readyButtonDisabled || playerReady) {
                  console.log('Button already disabled or player already ready, ignoring click');
                  return;
            }
            
            // Disable the button immediately
            setReadyButtonDisabled(true);
            
            // Check if all ships are placed
            if (placedShips.length < Object.keys(SHIPS).length) {
                  Alert.alert('Not Ready', 'Please place all your ships before continuing.');
                  setReadyButtonDisabled(false);
                  return;
            }
            
            // Use the game controller to mark the player as ready
            const success = gameController.markPlayerReady();
            
            if (!success) {
                  Alert.alert('Connection Issue', 'Unable to notify opponent. Please try again.');
                  setReadyButtonDisabled(false);
                  return;
            }
            
            // Show a message based on opponent status
            if (opponentReady) {
                  // Both players are ready
                  if (isHost) {
                        Alert.alert('Ready!', 'Both players are ready. You can start the battle!');
                  } else {
                        Alert.alert('Ready!', 'Both players are ready. Waiting for host to start the game...');
                  }
            } else {
                  // Show a message that we're waiting for opponent
                  Alert.alert('Ready!', 'Waiting for your opponent to be ready.');
            }
      };

      const renderShipSelector = () => {
            // Determine if we should use a scrollview (for small screens) or a flex container
            const useScrollView = window.width < 600; // window is from useWindowDimensions hook

            if (useScrollView) {
                  return (
                        <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.shipSelectorContainer}
                        >
                              {Object.values(SHIPS).map((ship) => (
                                    <TouchableOpacity
                                          key={ship.id}
                                          style={[
                                                styles.shipButton,
                                                selectedShip?.id === ship.id && styles.selectedShipButton,
                                                placedShips.includes(ship.id) && styles.placedShipButton,
                                          ]}
                                          onPress={() => handleShipSelect(ship)}
                                          disabled={placedShips.includes(ship.id)}
                                    >
                                          <Text style={styles.shipButtonText}>{ship.name}</Text>
                                          <Text style={styles.shipSizeText}>Size: {ship.size}</Text>
                                    </TouchableOpacity>
                              ))}
                        </ScrollView>
                  );
            } else {
                  return (
                        <View style={styles.shipSelectorContainer}>
                              {Object.values(SHIPS).map((ship) => (
                                    <TouchableOpacity
                                          key={ship.id}
                                          style={[
                                                styles.shipButton,
                                                selectedShip?.id === ship.id && styles.selectedShipButton,
                                                placedShips.includes(ship.id) && styles.placedShipButton,
                                          ]}
                                          onPress={() => handleShipSelect(ship)}
                                          disabled={placedShips.includes(ship.id)}
                                    >
                                          <Text style={styles.shipButtonText}>{ship.name}</Text>
                                          <Text style={styles.shipSizeText}>Size: {ship.size}</Text>
                                    </TouchableOpacity>
                              ))}
                        </View>
                  );
            }
      };
                  );
            } else {
                  return (
                        <View style={styles.shipSelectorContainer}>
                              {Object.values(SHIPS).map((ship) => (
                                    <TouchableOpacity
                                          key={ship.id}
                                          style={[
                                                styles.shipButton,
                                                selectedShip?.id === ship.id && styles.selectedShipButton,
                                                placedShips.includes(ship.id) && styles.placedShipButton,
                                          ]}
                                          onPress={() => handleShipSelect(ship)}
                                          disabled={placedShips.includes(ship.id)}
                                    >
                                          <Text style={styles.shipButtonText}>{ship.name}</Text>
                                          <Text style={styles.shipSizeText}>Size: {ship.size}</Text>
                                    </TouchableOpacity>
                              ))}
                        </View>
                  );
            }
      };
      
      return (
            <SafeAreaView style={styles.container}>
                  <View style={styles.header}>
                        <Text style={styles.headerTitle}>PLACE YOUR SHIPS</Text>
                  </View>

                  <View style={[styles.content, isLandscape && styles.contentLandscape]}>
                        <View style={[styles.boardContainer, isLandscape && styles.boardContainerLandscape]}>
                              <GameBoard
                                    board={board}
                                    onCellPress={handleCellPress}
                                    showShips={true}
                                    highlightPlacement={
                                          selectedShip
                                                ? {
                                                        ship: selectedShip,
                                                        isHorizontal,
                                                        row: 0, // Default values that will be updated on hover/press
                                                        col: 0,
                                                  }
                                                : null
                                    }
                              />
                        </View>

                        <View style={[styles.controlsContainer, isLandscape && styles.controlsContainerLandscape]}>
                              {renderShipSelector()}

                              <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                          style={styles.button}
                                          onPress={handleRotate}
                                          disabled={playerReady}
                                    >
                                          <Text style={styles.buttonText}>
                                                {isHorizontal ? 'ROTATE TO VERTICAL' : 'ROTATE TO HORIZONTAL'}
                                          </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                          style={[styles.button, styles.resetButton]}
                                          onPress={handleReset}
                                          disabled={playerReady}
                                    >
                                          <Text style={styles.buttonText}>RESET</Text>
                                    </TouchableOpacity>
                              </View>

                              <TouchableOpacity
                                    style={[
                                          styles.readyButton,
                                          (placedShips.length < Object.keys(SHIPS).length ||
                                                readyButtonDisabled ||
                                                playerReady) &&
                                                styles.disabledButton,
                                          playerReady && styles.playerReadyButton,
                                    ]}
                                    onPress={handleReady}
                                    disabled={
                                          placedShips.length < Object.keys(SHIPS).length || readyButtonDisabled || playerReady
                                    }
                              >
                                    <Text style={styles.readyButtonText}>
                                          {playerReady
                                                ? opponentReady
                                                      ? isHost 
                                                            ? 'START BATTLE!'
                                                            : 'WAITING FOR HOST...'
                                                      : 'WAITING FOR OPPONENT...'
                                                : opponentReady
                                                ? 'READY TO BATTLE!'
                                                : 'READY TO BATTLE!'}
                                    </Text>
                              </TouchableOpacity>
                              
                              {isHost && playerReady && opponentReady && (
                                    <TouchableOpacity
                                          style={[styles.startButton]}
                                          onPress={() => gameController.startGame()}
                                    >
                                          <Text style={styles.readyButtonText}>START BATTLE!</Text>
                                    </TouchableOpacity>
                              )}

                              {playerReady && <Text style={styles.readyStatusText}>You are ready for battle!</Text>}

                              {opponentReady && <Text style={styles.opponentReadyText}>Opponent is ready for battle!</Text>}
                        </View>
                  </View>
            </SafeAreaView>
      );
};

const styles = StyleSheet.create({
      container: {
            flex: 1,
            backgroundColor: '#f0f8ff',
      },
      header: {
            padding: 16,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#ddd',
      },
      headerTitle: {
            fontSize: 24,
            fontWeight: 'bold',
            color: '#1e3a8a',
      },
      content: {
            flex: 1,
            padding: 16,
      },
      contentLandscape: {
            flexDirection: 'row',
            alignItems: 'center',
      },
      boardContainer: {
            alignItems: 'center',
            justifyContent: 'center',
      },
      boardContainerLandscape: {
            flex: 1,
      },
      controlsContainer: {
            marginTop: 20,
      },
      controlsContainerLandscape: {
            flex: 1,
            marginTop: 0,
            marginLeft: 20,
      },
      shipSelectorContainer: {
            paddingVertical: 10,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
      },
      shipButton: {
            backgroundColor: '#2563eb',
            padding: 12,
            borderRadius: 8,
            marginRight: 10,
            minWidth: 100,
            maxWidth: 150,
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
      },
      selectedShipButton: {
            backgroundColor: '#1e3a8a',
            borderWidth: 2,
            borderColor: '#fbbf24',
      },
      placedShipButton: {
            backgroundColor: '#64748b',
      },
      shipButtonText: {
            color: 'white',
            fontWeight: 'bold',
            fontSize: 14,
      },
      shipSizeText: {
            color: 'white',
            fontSize: 12,
            marginTop: 4,
      },
      buttonRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 20,
      },
      button: {
            backgroundColor: '#2563eb',
            padding: 12,
            borderRadius: 8,
            flex: 1,
            marginHorizontal: 5,
            alignItems: 'center',
      },
      resetButton: {
            backgroundColor: '#dc2626',
      },
      buttonText: {
            color: 'white',
            fontWeight: 'bold',
      },
      readyButton: {
            backgroundColor: '#15803d',
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 20,
      },
      startButton: {
            backgroundColor: '#9333ea',
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 10,
      },
      disabledButton: {
            backgroundColor: '#94a3b8',
      },
      playerReadyButton: {
            backgroundColor: '#0d9488', // Teal color to indicate player is ready
            borderWidth: 2,
            borderColor: '#fbbf24',
      },
      readyButtonText: {
            color: 'white',
            fontWeight: 'bold',
            fontSize: 18,
      },
      readyStatusText: {
            color: '#0d9488',
            fontWeight: 'bold',
            textAlign: 'center',
            marginTop: 10,
      },
      opponentReadyText: {
            color: '#15803d',
            fontWeight: 'bold',
            textAlign: 'center',
            marginTop: 5,
      },
});

export default ShipPlacementScreen;
