import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Dimensions, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHIPS, CELL_STATE } from '../utils/gameState';
import GameBoard from '../components/GameBoard';
import battleController from '../controllers/BattleController';

const GameScreen = ({ navigation, route }) => {
      const { isHost, connection, playerBoard } = route.params;

      const [opponentBoard, setOpponentBoard] = useState(battleController.getGameState().opponentBoard);
      const [myBoard, setMyBoard] = useState(battleController.getGameState().playerBoard || playerBoard);
      const [isMyTurn, setIsMyTurn] = useState(battleController.getGameState().isMyTurn);
      const [gameOver, setGameOver] = useState(battleController.getGameState().gameOver);
      const [winner, setWinner] = useState(battleController.getGameState().winner);
      const [lastAttack, setLastAttack] = useState(battleController.getGameState().lastAttack);
      const [sunkShips, setSunkShips] = useState(battleController.getGameState().sunkShips);
      const [reconnecting, setReconnecting] = useState(false);
      const [connectionLost, setConnectionLost] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);

      // Animation refs
      const fadeAnim = useRef(new Animated.Value(0)).current;
      const scaleAnim = useRef(new Animated.Value(0.5)).current;

      // Initialize the battle controller
      useEffect(() => {
            console.log('Initializing battle controller with gameCode:', route.params.gameCode, 'isHost:', isHost);
            battleController.initialize(connection, route.params.gameCode, isHost, playerBoard);
            
            // Set up event listeners
            battleController.on('onPlayerBoardUpdated', (newBoard) => {
                  setMyBoard(newBoard);
            });
            
            battleController.on('onOpponentBoardUpdated', (newBoard) => {
                  setOpponentBoard(newBoard);
            });
            
            battleController.on('onTurnChanged', (isMyTurn) => {
                  setIsMyTurn(isMyTurn);
            });
            
            battleController.on('onGameOver', (didWin) => {
                  setGameOver(true);
                  setWinner(didWin ? 'player' : 'opponent');
                  
                  Alert.alert(
                        didWin ? 'Victory!' : 'Defeat!', 
                        didWin ? 'You sunk all enemy ships!' : 'All your ships were sunk!',
                        [{ text: 'Return to Home', onPress: () => navigation.navigate('Home') }]
                  );
            });
            
            battleController.on('onLastAttackUpdated', (attack) => {
                  setLastAttack(attack);
            });
            
            battleController.on('onSunkShipsUpdated', (ships) => {
                  setSunkShips(ships);
                  
                  // Show alert for sunk ship if it's a new opponent ship
                  const opponentShips = ships.opponent;
                  const prevOpponentShips = sunkShips.opponent;
                  
                  if (opponentShips.length > prevOpponentShips.length) {
                        const newSunkShipId = opponentShips[opponentShips.length - 1];
                        const shipName = Object.values(SHIPS).find((ship) => ship.id === newSunkShipId)?.name;
                        Alert.alert('Ship Sunk!', `You sunk the opponent's ${shipName}!`);
                  }
            });
            
            battleController.on('onConnectionLost', () => {
                  setConnectionLost(true);
                  Alert.alert(
                        'Connection Lost',
                        'The connection to the other player was lost. The game cannot continue.',
                        [{ text: 'Return to Home', onPress: () => navigation.navigate('Home') }]
                  );
            });
            
            // Clean up
            return () => {
                  // Reset event listeners
                  battleController.on('onPlayerBoardUpdated', null);
                  battleController.on('onOpponentBoardUpdated', null);
                  battleController.on('onTurnChanged', null);
                  battleController.on('onGameOver', null);
                  battleController.on('onLastAttackUpdated', null);
                  battleController.on('onSunkShipsUpdated', null);
                  battleController.on('onConnectionLost', null);
            };
      }, [connection, isHost, navigation, playerBoard, route.params.gameCode, sunkShips.opponent]);

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
                                          'The connection to the other player was lost. The game cannot continue.',
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
      }, [isMyTurn, fadeAnim, scaleAnim]);

      const handleCellPress = (row, col) => {
            // Use the battle controller to attack a cell
            if (reconnecting || connectionLost) return;
            
            battleController.attackCell(row, col);
      };

      const renderTurnIndicator = () => {
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
                        <Text style={styles.turnIndicatorText}>{isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}</Text>
                  </Animated.View>
            );
      };

      const renderSunkShips = (player) => {
            const sunkShipsList = sunkShips[player];
            return (
                  <View style={styles.sunkShipsContainer}>
                        <Text style={styles.sunkShipsTitle}>
                              {player === 'player' ? 'Your Sunk Ships:' : "Opponent's Sunk Ships:"}
                        </Text>
                        <View style={styles.sunkShipsList}>
                              {Object.values(SHIPS).map((ship) => (
                                    <View
                                          key={ship.id}
                                          style={[
                                                styles.sunkShipItem,
                                                sunkShipsList.includes(ship.id) ? styles.sunkShip : styles.activeShip,
                                          ]}
                                    >
                                          <Text
                                                style={[
                                                      styles.sunkShipText,
                                                      sunkShipsList.includes(ship.id)
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
                        <View style={[styles.boardsContainer, isLandscape && styles.boardsContainerLandscape]}>
                              <View style={styles.boardSection}>
                                    <Text style={styles.boardTitle}>OPPONENT'S WATERS</Text>
                                    <GameBoard
                                          board={opponentBoard}
                                          onCellPress={handleCellPress}
                                          showShips={false}
                                          highlightLastMove={lastAttack?.board === 'opponent' ? lastAttack : null}
                                          disabled={!isMyTurn || gameOver}
                                    />
                              </View>

                              <View style={styles.boardSection}>
                                    <Text style={styles.boardTitle}>YOUR WATERS</Text>
                                    <GameBoard
                                          board={myBoard}
                                          showShips={true}
                                          highlightLastMove={lastAttack?.board === 'player' ? lastAttack : null}
                                          disabled={true}
                                    />
                              </View>
                        </View>

                        <View style={[styles.statsContainer, isLandscape && styles.statsContainerLandscape]}>
                              {renderSunkShips('opponent')}
                              {renderSunkShips('player')}
                        </View>
                  </View>

                  {(gameOver || connectionLost) && (
                        <View style={styles.gameOverContainer}>
                              <Text style={styles.gameOverText}>
                                    {connectionLost ? 'CONNECTION LOST' : winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
                              </Text>
                              <Text style={styles.gameOverSubText}>
                                    {connectionLost
                                          ? 'The connection to your opponent was lost.'
                                          : winner === 'player'
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
      },
      sunkShipsTitle: {
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 5,
      },
      sunkShipsList: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
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
