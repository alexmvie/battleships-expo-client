import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Dimensions, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHIPS, CELL_STATE } from '../utils/gameState';
import GameBoard from '../components/GameBoard';
import gameRoomController, { GAME_STATES } from '../controllers/GameRoomController';

const GameScreen = ({ navigation, route }) => {
      const { gameCode, isHost, connection, clientId } = route.params;

      // Local state
      const [clients, setClients] = useState(gameRoomController.getGameState().clients);
      const [currentTurnClientId, setCurrentTurnClientId] = useState(gameRoomController.getCurrentTurnClientId());
      const [selectedTargetId, setSelectedTargetId] = useState(null);
      const [gameOver, setGameOver] = useState(false);
      const [winner, setWinner] = useState(null);
      const [lastAttack, setLastAttack] = useState(null);
      const [reconnecting, setReconnecting] = useState(false);
      const [connectionLost, setConnectionLost] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);

      // Animation refs
      const fadeAnim = useRef(new Animated.Value(0)).current;
      const scaleAnim = useRef(new Animated.Value(0.5)).current;

      // Initialize the game room controller
      useEffect(() => {
            console.log('GameScreen: Using game room controller with clientId:', clientId);
            
            // Set up event listeners
            gameRoomController.on('onClientLeft', (leftClientId) => {
                  console.log('Client left:', leftClientId);
                  setClients(gameRoomController.getGameState().clients);
                  
                  Alert.alert('Player Left', 'A player has left the game.');
            });
            
            gameRoomController.on('onTurnChanged', (turnClientId) => {
                  console.log('Turn changed to:', turnClientId);
                  setCurrentTurnClientId(turnClientId);
            });
            
            gameRoomController.on('onBoardUpdated', (clientId, board) => {
                  console.log('Board updated for client:', clientId);
                  setClients(gameRoomController.getGameState().clients);
            });
            
            gameRoomController.on('onAttackResult', (targetClientId, row, col, hit, shipId, sunkShipId) => {
                  console.log('Attack result:', { targetClientId, row, col, hit, shipId, sunkShipId });
                  setClients(gameRoomController.getGameState().clients);
                  setLastAttack({ targetClientId, row, col });
                  
                  // Show alert for sunk ship
                  if (sunkShipId) {
                        const shipName = Object.values(SHIPS).find((ship) => ship.id === sunkShipId)?.name;
                        Alert.alert('Ship Sunk!', `You sunk a ${shipName}!`);
                  }
            });
            
            gameRoomController.on('onGameOver', (winnerId) => {
                  console.log('Game over, winner:', winnerId);
                  setGameOver(true);
                  setWinner(winnerId);
                  
                  const isLocalPlayerWinner = winnerId === clientId;
                  Alert.alert(
                        isLocalPlayerWinner ? 'Victory!' : 'Defeat!',
                        isLocalPlayerWinner ? 'You won the game!' : 'You lost the game!',
                        [{ text: 'Return to Home', onPress: () => navigation.navigate('Home') }]
                  );
            });
            
            gameRoomController.on('onConnectionLost', () => {
                  setConnectionLost(true);
                  Alert.alert(
                        'Connection Lost',
                        'The connection to the other players was lost. The game cannot continue.',
                        [{ text: 'Return to Home', onPress: () => navigation.navigate('Home') }]
                  );
            });
            
            // Initialize local state from controller
            const gameState = gameRoomController.getGameState();
            setClients(gameState.clients);
            setCurrentTurnClientId(gameRoomController.getCurrentTurnClientId());
            
            // Select the first opponent as the default target
            const opponents = Object.values(gameState.clients).filter(c => c.id !== clientId);
            if (opponents.length > 0) {
                  setSelectedTargetId(opponents[0].id);
            }
            
            // Clean up
            return () => {
                  // Reset event listeners
                  gameRoomController.on('onClientLeft', null);
                  gameRoomController.on('onTurnChanged', null);
                  gameRoomController.on('onBoardUpdated', null);
                  gameRoomController.on('onAttackResult', null);
                  gameRoomController.on('onGameOver', null);
                  gameRoomController.on('onConnectionLost', null);
            };
      }, [clientId, navigation]);

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
                                    setConnectionLost(true);
                                    Alert.alert(
                                          'Connection Lost',
                                          'The connection to the other players was lost. The game cannot continue.',
                                          [{ text: 'Return to Home', onPress: () => navigation.navigate('Home') }]
                                    );
                              }
                        }, 5000);
                  }
            }
      }, [connection, reconnecting, navigation]);

      useEffect(() => {
            // Animate turn indicator
            Animated.parallel([
                  Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 5,
                        tension: 40,
                        useNativeDriver: true,
                  }),
            ]).start();

            // Reset animation when turn changes
            return () => {
                  fadeAnim.setValue(0);
                  scaleAnim.setValue(0.5);
            };
      }, [currentTurnClientId, fadeAnim, scaleAnim]);

      const handleCellPress = (row, col) => {
            // Can only attack on your turn and if game is not over or connection lost
            if (currentTurnClientId !== clientId || gameOver || connectionLost || reconnecting) {
                  return;
            }
            
            // Can't attack if no target is selected
            if (!selectedTargetId) {
                  Alert.alert('No Target', 'Please select a target player first.');
                  return;
            }
            
            // Attack the selected target
            gameRoomController.attackClient(selectedTargetId, row, col);
      };

      const handleTargetSelect = (targetClientId) => {
            setSelectedTargetId(targetClientId);
      };

      const renderTurnIndicator = () => {
            const isMyTurn = currentTurnClientId === clientId;
            
            return (
                  <Animated.View
                        style={[
                              styles.turnIndicator,
                              {
                                    opacity: fadeAnim,
                                    transform: [{ scale: scaleAnim }],
                                    backgroundColor: isMyTurn ? '#15803d' : '#dc2626',
                              },
                        ]}
                  >
                        <Text style={styles.turnIndicatorText}>
                              {isMyTurn 
                                    ? 'YOUR TURN' 
                                    : `${currentTurnClientId === clientId 
                                          ? 'YOUR' 
                                          : currentTurnClientId.substring(0, 5) + "'S"} TURN`}
                        </Text>
                  </Animated.View>
            );
      };

      const renderTargetSelector = () => {
            // Filter out the local client
            const opponents = Object.values(clients).filter(client => client.id !== clientId);
            
            return (
                  <View style={styles.targetSelectorContainer}>
                        <Text style={styles.targetSelectorTitle}>Select Target:</Text>
                        <View style={styles.targetButtonsContainer}>
                              {opponents.map((opponent) => (
                                    <TouchableOpacity
                                          key={opponent.id}
                                          style={[
                                                styles.targetButton,
                                                selectedTargetId === opponent.id && styles.selectedTargetButton,
                                          ]}
                                          onPress={() => handleTargetSelect(opponent.id)}
                                    >
                                          <Text style={styles.targetButtonText}>
                                                Player {opponent.id.substring(0, 5)}
                                          </Text>
                                    </TouchableOpacity>
                              ))}
                        </View>
                  </View>
            );
      };

      const renderSunkShips = (client) => {
            return (
                  <View style={styles.sunkShipsContainer}>
                        <Text style={styles.sunkShipsTitle}>
                              {client.id === clientId 
                                    ? 'Your Sunk Ships:' 
                                    : `Player ${client.id.substring(0, 5)}'s Sunk Ships:`}
                        </Text>
                        <View style={styles.sunkShipsList}>
                              {Object.values(SHIPS).map((ship) => (
                                    <View
                                          key={ship.id}
                                          style={[
                                                styles.sunkShipItem,
                                                client.sunkShips.includes(ship.id) ? styles.sunkShip : styles.activeShip,
                                          ]}
                                    >
                                          <Text
                                                style={[
                                                      styles.sunkShipText,
                                                      client.sunkShips.includes(ship.id)
                                                            ? styles.sunkShipText
                                                            : styles.activeShipText,
                                                ]}
                                          >
                                                {ship.name}
                                          </Text>
                                    </View>
                              ))}
                        </View>
                  </View>
            );
      };
      return (
            <SafeAreaView style={styles.container}>
                  <View style={styles.header}>
                        <Text style={styles.headerTitle}>BATTLESHIPS</Text>
                        {renderTurnIndicator()}
                  </View>

                  <View style={styles.content}>
                        {renderTargetSelector()}
                        
                        <View style={[styles.boardsContainer, isLandscape && styles.boardsContainerLandscape]}>
                              <View style={styles.boardSection}>
                                    <Text style={styles.boardTitle}>
                                          {selectedTargetId 
                                                ? `PLAYER ${selectedTargetId.substring(0, 5)}'S WATERS` 
                                                : "SELECT A TARGET"}
                                    </Text>
                                    {selectedTargetId && (
                                          <GameBoard
                                                board={clients[selectedTargetId]?.board || []}
                                                onCellPress={handleCellPress}
                                                showShips={false}
                                                highlightLastMove={
                                                      lastAttack?.targetClientId === selectedTargetId ? lastAttack : null
                                                }
                                                disabled={currentTurnClientId !== clientId || gameOver}
                                          />
                                    )}
                              </View>

                              <View style={styles.boardSection}>
                                    <Text style={styles.boardTitle}>YOUR WATERS</Text>
                                    <GameBoard
                                          board={clients[clientId]?.board || []}
                                          showShips={true}
                                          disabled={true}
                                    />
                              </View>
                        </View>

                        <View style={[styles.statsContainer, isLandscape && styles.statsContainerLandscape]}>
                              {Object.values(clients).map((client) => renderSunkShips(client))}
                        </View>
                  </View>

                  {(gameOver || connectionLost) && (
                        <View style={styles.gameOverContainer}>
                              <Text style={styles.gameOverText}>
                                    {connectionLost 
                                          ? 'CONNECTION LOST' 
                                          : winner === clientId 
                                                ? 'VICTORY!' 
                                                : 'DEFEAT!'}
                              </Text>
                              <Text style={styles.gameOverSubText}>
                                    {connectionLost
                                          ? 'The connection to the other players was lost.'
                                          : winner === clientId
                                          ? 'You sunk all enemy ships!'
                                          : 'All your ships were sunk!'}
                              </Text>
                              <TouchableOpacity
                                    style={styles.newGameButton}
                                    onPress={() => navigation.navigate('Home')}
                              >
                                    <Text style={styles.newGameButtonText}>RETURN TO HOME</Text>
                              </TouchableOpacity>
                        </View>
                  )}
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
            marginBottom: 10,
      },
      turnIndicator: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            marginTop: 5,
      },
      turnIndicatorText: {
            color: 'white',
            fontWeight: 'bold',
            fontSize: 16,
      },
      content: {
            flex: 1,
            padding: 10,
      },
      targetSelectorContainer: {
            marginBottom: 15,
            padding: 10,
            backgroundColor: '#f1f5f9',
            borderRadius: 8,
      },
      targetSelectorTitle: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 10,
      },
      targetButtonsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
      },
      targetButton: {
            backgroundColor: '#2563eb',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            marginRight: 10,
            marginBottom: 10,
      },
      selectedTargetButton: {
            backgroundColor: '#1e3a8a',
            borderWidth: 2,
            borderColor: '#fbbf24',
      },
      targetButtonText: {
            color: 'white',
            fontWeight: 'bold',
      },
      boardsContainer: {
            flex: 1,
      },
      boardsContainerLandscape: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingHorizontal: 10,
      },
      boardSection: {
            marginBottom: 20,
            flex: 1,
            alignItems: 'center',
      },
      boardTitle: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#1e3a8a',
            marginBottom: 5,
            textAlign: 'center',
      },
      statsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 10,
            marginBottom: 10,
            flexWrap: 'wrap',
      },
      statsContainerLandscape: {
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(240, 248, 255, 0.8)',
            paddingVertical: 5,
            borderRadius: 10,
      },
      sunkShipsContainer: {
            flex: 1,
            minWidth: 150,
            marginBottom: 10,
      },
      sunkShipsTitle: {
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 5,
      },
      sunkShipsList: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
      },
      sunkShipItem: {
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 4,
            marginRight: 5,
            marginBottom: 5,
      },
      sunkShip: {
            backgroundColor: '#dc2626',
      },
      activeShip: {
            backgroundColor: '#2563eb',
      },
      sunkShipText: {
            color: 'white',
            fontSize: 12,
      },
      activeShipText: {
            color: 'white',
            fontSize: 12,
      },
      gameOverContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
      },
      gameOverText: {
            fontSize: 32,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 10,
      },
      gameOverSubText: {
            fontSize: 18,
            color: 'white',
            marginBottom: 20,
            textAlign: 'center',
            paddingHorizontal: 20,
      },
      newGameButton: {
            backgroundColor: '#15803d',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 8,
      },
      newGameButtonText: {
            color: 'white',
            fontWeight: 'bold',
            fontSize: 16,
      },
});

export default GameScreen;
