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
import gameRoomController from '../controllers/GameRoomController';
import { GAME_STATES, APP_VERSION, shortenId } from '../config/appConfig';

const ShipPlacementScreen = ({ navigation, route }) => {
      const { gameCode, isHost, connection } = route.params;
      const window = useWindowDimensions();

      // Generate a unique client ID
      const clientId = `client_${Date.now()}`;

      // Local state
      const [board, setBoard] = useState(gameRoomController.getGameState().clients[clientId]?.board || null);
      const [selectedShip, setSelectedShip] = useState(SHIPS.CARRIER);
      const [placedShips, setPlacedShips] = useState([]);
      const [isHorizontal, setIsHorizontal] = useState(true);
      const [playerReady, setPlayerReady] = useState(false);
      const [allPlayersReady, setAllPlayersReady] = useState(false);
      const [reconnecting, setReconnecting] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);
      const [readyButtonDisabled, setReadyButtonDisabled] = useState(false);
      const [clients, setClients] = useState({});

      // Initialize the game room controller
      useEffect(() => {
            console.log('Initializing game room controller with gameCode:', gameCode, 'isHost:', isHost);
            gameRoomController.initialize(connection, gameCode, isHost, clientId);

            // Set up event listeners
            gameRoomController.on('onClientJoined', (client) => {
                  console.log('Client joined:', client.id);
                  setClients(gameRoomController.getGameState().clients);
            });

            gameRoomController.on('onClientLeft', (clientId) => {
                  console.log('Client left:', clientId);
                  setClients(gameRoomController.getGameState().clients);

                  Alert.alert('Player Left', 'A player has left the game.');
            });

            gameRoomController.on('onClientReadyChanged', (clientId, ready) => {
                  console.log('Client ready changed:', clientId, ready);
                  setClients(gameRoomController.getGameState().clients);

                  if (clientId !== gameRoomController.localClientId && ready) {
                        Alert.alert('Player Ready', 'Another player is ready for battle!');
                  }
            });

            gameRoomController.on('onAllClientsReady', () => {
                  console.log('All clients ready');
                  setAllPlayersReady(true);

                  if (isHost) {
                        Alert.alert('All Players Ready', 'All players are ready. You can start the battle!');
                  } else {
                        Alert.alert('All Players Ready', 'All players are ready. Waiting for host to start the game...');
                  }
            });

            gameRoomController.on('onGameStateChanged', (state) => {
                  console.log('Game state changed:', state);

                  if (state === GAME_STATES.BATTLE) {
                        // Navigate to battle screen
                        setTimeout(() => {
                              navigation.navigate('Game', {
                                    gameCode,
                                    isHost,
                                    connection,
                                    clientId,
                              });
                        }, 1000);
                  }
            });

            gameRoomController.on('onConnectionLost', () => {
                  Alert.alert('Connection Lost', 'The connection to the other players was lost. Returning to home screen.', [
                        { text: 'OK', onPress: () => navigation.navigate('Home') },
                  ]);
            });

            // Initialize local state from controller
            const gameState = gameRoomController.getGameState();
            setBoard(gameState.clients[clientId]?.board || null);
            setClients(gameState.clients);

            // Clean up
            return () => {
                  // Reset event listeners
                  gameRoomController.on('onClientJoined', null);
                  gameRoomController.on('onClientLeft', null);
                  gameRoomController.on('onClientReadyChanged', null);
                  gameRoomController.on('onAllClientsReady', null);
                  gameRoomController.on('onGameStateChanged', null);
                  gameRoomController.on('onConnectionLost', null);
            };
      }, [connection, gameCode, isHost, navigation, clientId]);

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
                                          'The connection to the other players was lost. Returning to home screen.',
                                          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
                                    );
                              }
                        }, 5000);
                  }
            }
      }, [connection, reconnecting, navigation]);

      const handleCellPress = (row, col) => {
            if (!selectedShip) return;

            // TODO: Implement ship placement using gameRoomController
            // For now, just update local state
            console.log('Placing ship at:', row, col);

            // If successful, update placed ships
            setPlacedShips([...placedShips, selectedShip.id]);

            // Select next ship or clear selection if all ships are placed
            if (placedShips.length + 1 >= Object.keys(SHIPS).length) {
                  setSelectedShip(null);
            } else {
                  // Find the next unplaced ship
                  const shipIds = Object.values(SHIPS).map((ship) => ship.id);
                  const nextUnplacedShip = Object.values(SHIPS).find(
                        (ship) => !placedShips.includes(ship.id) && ship.id !== selectedShip.id
                  );
                  setSelectedShip(nextUnplacedShip || null);
            }
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
            // Reset ship placement
            setPlacedShips([]);
            setSelectedShip(SHIPS.CARRIER);
            setIsHorizontal(true);

            // TODO: Reset board in gameRoomController
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

            // Mark player as ready in the controller
            const success = gameRoomController.markReady(true);

            if (!success) {
                  Alert.alert('Connection Issue', 'Unable to notify other players. Please try again.');
                  setReadyButtonDisabled(false);
                  return;
            }

            // Update local state
            setPlayerReady(true);

            // Show a message
            Alert.alert('Ready!', 'Waiting for other players to be ready.');
      };

      const handleStartBattle = () => {
            if (!isHost) {
                  Alert.alert('Not Host', 'Only the host can start the battle.');
                  return;
            }

            if (!allPlayersReady) {
                  Alert.alert('Not Ready', 'All players must be ready before starting the battle.');
                  return;
            }

            // Start the battle
            gameRoomController.startBattle();
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
      const renderPlayerList = () => {
            return (
                  <View style={styles.playerListContainer}>
                        <Text style={styles.playerListTitle}>Players:</Text>
                        {Object.values(clients).map((client) => (
                              <View
                                    key={client.id}
                                    style={styles.playerItem}
                              >
                                    <Text style={styles.playerName}>
                                          {client.id === clientId ? 'You' : `Player ${shortenId(client.id)}`}
                                          {client.isHost ? ' (Host)' : ''}
                                    </Text>
                                    <View
                                          style={[styles.playerStatus, client.ready ? styles.playerReady : styles.playerNotReady]}
                                    />
                              </View>
                        ))}
                        <Text style={styles.clientIdText}>Your ID: {shortenId(clientId)}</Text>
                        <Text style={styles.versionText}>v{APP_VERSION}</Text>
                  </View>
            );
      };

      return (
            <SafeAreaView style={styles.container}>
                  <View style={styles.header}>
                        <Text style={styles.headerTitle}>PLACE YOUR SHIPS</Text>
                        <Text style={styles.gameCodeText}>Game Code: {gameCode}</Text>
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

                              {renderPlayerList()}

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
                                    <Text style={styles.readyButtonText}>{playerReady ? 'READY!' : 'READY TO BATTLE!'}</Text>
                              </TouchableOpacity>

                              {isHost && allPlayersReady && (
                                    <TouchableOpacity
                                          style={[styles.startButton]}
                                          onPress={handleStartBattle}
                                    >
                                          <Text style={styles.readyButtonText}>START BATTLE!</Text>
                                    </TouchableOpacity>
                              )}

                              {playerReady && <Text style={styles.readyStatusText}>You are ready for battle!</Text>}
                              {allPlayersReady && <Text style={styles.allReadyText}>All players are ready!</Text>}
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
      gameCodeText: {
            fontSize: 16,
            color: '#4b5563',
            marginTop: 5,
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
      playerListContainer: {
            marginTop: 20,
            padding: 10,
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
      },
      playerListTitle: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 10,
      },
      playerItem: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 5,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
      },
      playerName: {
            fontSize: 14,
            fontWeight: '500',
      },
      playerStatus: {
            width: 12,
            height: 12,
            borderRadius: 6,
      },
      playerReady: {
            backgroundColor: '#15803d',
      },
      playerNotReady: {
            backgroundColor: '#dc2626',
      },
      clientIdText: {
            fontSize: 12,
            color: '#4b5563',
            marginTop: 10,
            textAlign: 'center',
      },
      versionText: {
            fontSize: 10,
            color: '#6b7280',
            marginTop: 5,
            textAlign: 'center',
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
      allReadyText: {
            color: '#15803d',
            fontWeight: 'bold',
            textAlign: 'center',
            marginTop: 5,
      },
});

export default ShipPlacementScreen;
