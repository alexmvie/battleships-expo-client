import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { createEmptyBoard, SHIPS, isValidPlacement, placeShip } from '../utils/gameState';
import GameBoard from '../components/GameBoard';

const ShipPlacementScreen = ({ navigation, route }) => {
      const { gameCode, isHost, connection } = route.params;
      const window = useWindowDimensions();
      const [board, setBoard] = useState(createEmptyBoard());
      const [selectedShip, setSelectedShip] = useState(SHIPS.CARRIER);
      const [placedShips, setPlacedShips] = useState([]);
      const [isHorizontal, setIsHorizontal] = useState(true);
      const [opponentReady, setOpponentReady] = useState(false);
      const [playerReady, setPlayerReady] = useState(false);
      const [reconnecting, setReconnecting] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);
      const [readyButtonDisabled, setReadyButtonDisabled] = useState(false);

      // Flag to prevent duplicate navigation
      const navigatingToGameRef = useRef(false);

      // Reset navigation flag when component unmounts
      useEffect(() => {
            return () => {
                  navigatingToGameRef.current = false;
            };
      }, []);

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

      // Effect to periodically resend ready message if we haven't received confirmation
      useEffect(() => {
            // If we're ready but the opponent isn't, periodically resend the ready message
            if (playerReady && !opponentReady && connection) {
                  console.log('Setting up retry interval for ready message');

                  // Set up an interval to periodically resend the ready message
                  const retryInterval = setInterval(() => {
                        if (!opponentReady) {
                              console.log('Resending ready message');
                              connection.sendGameData({
                                    type: 'placement_ready',
                                    timestamp: Date.now(),
                              });

                              // Also resend the ready_to_battle message to the server
                              connection.sendGameData({
                                    type: 'ready_to_battle',
                                    timestamp: Date.now(),
                              });
                        } else {
                              // If opponent is now ready, clear the interval
                              clearInterval(retryInterval);
                        }
                  }, 3000); // Retry every 3 seconds

                  // Clean up the interval when component unmounts or when opponent becomes ready
                  return () => {
                        clearInterval(retryInterval);
                  };
            }
      }, [playerReady, opponentReady, connection]);

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

      // Effect to handle incoming messages - SIMPLIFIED
      useEffect(() => {
            if (connection) {
                  // Listen for opponent ready message
                  const originalOnDataReceived = connection.onDataReceived;

                  connection.onDataReceived = (data) => {
                        console.log('Received data in ShipPlacementScreen:', data);

                        // Handle different message types
                        switch (data.type) {
                              case 'placement_ready':
                                    // Opponent is ready
                                    console.log('Opponent is ready!');
                                    if (!opponentReady) {
                                          setOpponentReady(true);

                                          // Show notification that opponent is ready
                                          Alert.alert('Opponent Ready', 'Your opponent is ready for battle!');

                                          // If we're also ready, and we're the host, start the game
                                          if (playerReady && isHost) {
                                                console.log('Both players ready, host starting game');

                                                // Send start_battle message
                                                connection.sendGameData({
                                                      type: 'start_battle',
                                                      timestamp: Date.now(),
                                                });

                                                // Set a flag to prevent duplicate navigation
                                                if (navigatingToGameRef.current) {
                                                      console.log(
                                                            'Already navigating to Game screen, ignoring duplicate navigation attempt'
                                                      );
                                                      return;
                                                }

                                                navigatingToGameRef.current = true;

                                                // Navigate to game screen after a short delay
                                                setTimeout(() => {
                                                      navigation.navigate('Game', {
                                                            gameCode,
                                                            isHost,
                                                            connection,
                                                            playerBoard: board,
                                                      });
                                                }, 1000);
                                          }
                                    } else {
                                          console.log('Ignoring duplicate ready message from opponent');
                                    }
                                    break;

                              case 'start_battle':
                                    // Host has started the battle
                                    console.log('Received start_battle message, navigating to Game screen');

                                    // Make sure we're ready before navigating
                                    if (!playerReady) {
                                          console.log('Received start_battle but we are not ready yet');
                                          return;
                                    }

                                    // Set a flag to prevent duplicate navigation
                                    if (navigatingToGameRef.current) {
                                          console.log(
                                                'Already navigating to Game screen, ignoring duplicate start_battle message'
                                          );
                                          return;
                                    }

                                    navigatingToGameRef.current = true;

                                    // Navigate to game screen
                                    setTimeout(() => {
                                          navigation.navigate('Game', {
                                                gameCode,
                                                isHost,
                                                connection,
                                                playerBoard: board,
                                          });
                                    }, 1000);
                                    break;

                              case 'battle_start':
                                    // Server has confirmed both players are ready
                                    console.log('Received battle_start event from server');

                                    // Set a flag to prevent duplicate navigation
                                    if (navigatingToGameRef.current) {
                                          console.log(
                                                'Already navigating to Game screen, ignoring duplicate battle_start message'
                                          );
                                          return;
                                    }

                                    navigatingToGameRef.current = true;

                                    // Navigate to game screen
                                    setTimeout(() => {
                                          navigation.navigate('Game', {
                                                gameCode,
                                                isHost,
                                                connection,
                                                playerBoard: board,
                                          });
                                    }, 1000);
                                    break;

                              case 'ping':
                              case 'pong':
                                    // Handle ping/pong internally
                                    return;

                              default:
                                    // Call the original handler for other message types
                                    if (originalOnDataReceived) {
                                          originalOnDataReceived(data);
                                    }
                                    break;
                        }
                  };

                  // Set up a periodic ping to check connection
                  const pingInterval = setInterval(() => {
                        handleVisibilityChange();
                  }, 10000); // Check every 10 seconds

                  // Cleanup
                  return () => {
                        clearInterval(pingInterval);

                        if (connection) {
                              connection.onDataReceived = originalOnDataReceived;
                        }

                        // Reset navigation flag on cleanup
                        navigatingToGameRef.current = false;
                  };
            }
      }, [connection, board, gameCode, isHost, navigation, playerReady, opponentReady, handleVisibilityChange]);

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

            if (isValidPlacement(board, selectedShip, row, col, isHorizontal)) {
                  const newBoard = placeShip(board, selectedShip, row, col, isHorizontal);
                  setBoard(newBoard);

                  // Add to placed ships
                  setPlacedShips([...placedShips, selectedShip.id]);

                  // Select next ship or clear selection if all ships are placed
                  selectNextShip(selectedShip.id);
            } else {
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
            setBoard(createEmptyBoard());
            setPlacedShips([]);
            setSelectedShip(SHIPS.CARRIER);
            setIsHorizontal(true);
      };

      const handleReady = () => {
            console.log('Ready button pressed. Current state:', { readyButtonDisabled, playerReady });

            // Prevent multiple clicks - double protection
            if (readyButtonDisabled || playerReady) {
                  console.log('Button already disabled or player already ready, ignoring click');
                  return;
            }

            // Check if all ships are placed
            if (placedShips.length < Object.keys(SHIPS).length) {
                  Alert.alert('Not Ready', 'Please place all your ships before continuing.');
                  return;
            }

            // Disable the button IMMEDIATELY to prevent double clicks
            setReadyButtonDisabled(true);
            console.log('Button disabled');

            // Set player as ready FIRST to prevent race conditions
            setPlayerReady(true);
            console.log('Player marked as ready');

            // Send ready message to opponent
            if (connection) {
                  // Log the message being sent for debugging
                  console.log('Sending placement_ready message');

                  // Send the ready message - SIMPLIFIED
                  const success = connection.sendGameData({
                        type: 'placement_ready',
                        timestamp: Date.now(),
                  });

                  // Also send the ready_to_battle event to the server
                  console.log('Sending ready_to_battle message to server');
                  connection.sendGameData({
                        type: 'ready_to_battle',
                        timestamp: Date.now(),
                  });

                  if (!success) {
                        Alert.alert('Connection Issue', 'Unable to notify opponent. Please try again.');
                        // Only reset if there's a connection issue
                        setReadyButtonDisabled(false);
                        setPlayerReady(false);
                        return;
                  }

                  // Show a message based on opponent status
                  if (opponentReady) {
                        // Both players are ready
                        console.log('Both players ready in handleReady');

                        // If we're the host, start the game
                        if (isHost) {
                              console.log('Host initiating game start from handleReady');

                              // Send start_battle message
                              connection.sendGameData({
                                    type: 'start_battle',
                                    timestamp: Date.now(),
                              });

                              // Set a flag to prevent duplicate navigation
                              if (navigatingToGameRef.current) {
                                    console.log('Already navigating to Game screen');
                                    return;
                              }

                              navigatingToGameRef.current = true;

                              // Navigate to game screen after a short delay
                              setTimeout(() => {
                                    navigation.navigate('Game', {
                                          gameCode,
                                          isHost,
                                          connection,
                                          playerBoard: board,
                                    });
                              }, 1000);
                        } else {
                              // As client, wait for host to start the game
                              Alert.alert('Ready!', 'Both players are ready. Waiting for host to start the game...');
                        }
                  } else {
                        // Show a message that we're waiting for opponent
                        Alert.alert('Ready!', 'Waiting for your opponent to be ready.');
                  }

                  // DO NOT re-enable the button - it should stay disabled once player is ready
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
                                    >
                                          <Text style={styles.buttonText}>
                                                {isHorizontal ? 'ROTATE TO VERTICAL' : 'ROTATE TO HORIZONTAL'}
                                          </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                          style={[styles.button, styles.resetButton]}
                                          onPress={handleReset}
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
                                                      ? 'STARTING BATTLE...'
                                                      : 'WAITING FOR OPPONENT...'
                                                : opponentReady
                                                ? 'START BATTLE!'
                                                : 'READY TO BATTLE!'}
                                    </Text>
                              </TouchableOpacity>

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
