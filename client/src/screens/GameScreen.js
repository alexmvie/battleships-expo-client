import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Dimensions, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createEmptyBoard, processAttack, areAllShipsSunk, isShipSunk, SHIPS, CELL_STATE } from '../utils/gameState';
import GameBoard from '../components/GameBoard';

const GameScreen = ({ navigation, route }) => {
      const { isHost, connection, playerBoard } = route.params;

      const [opponentBoard, setOpponentBoard] = useState(createEmptyBoard());
      const [myBoard, setMyBoard] = useState(playerBoard);
      const [isMyTurn, setIsMyTurn] = useState(isHost); // Host goes first
      const [gameOver, setGameOver] = useState(false);
      const [winner, setWinner] = useState(null);
      const [lastAttack, setLastAttack] = useState(null);
      const [sunkShips, setSunkShips] = useState({ player: [], opponent: [] });
      const [reconnecting, setReconnecting] = useState(false);
      const [connectionLost, setConnectionLost] = useState(false);
      const [isLandscape, setIsLandscape] = useState(false);

      // Animation refs
      const fadeAnim = useRef(new Animated.Value(0)).current;
      const scaleAnim = useRef(new Animated.Value(0.5)).current;

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
                  // Note: In newer React Native versions, this would use .remove() instead
                  if (Dimensions.removeEventListener) {
                        Dimensions.removeEventListener('change', updateOrientation);
                  }
            };
      }, []);

      useEffect(() => {
            if (connection) {
                  const originalOnDataReceived = connection.onDataReceived;

                  connection.onDataReceived = (data) => {
                        if (data.type === 'attack') {
                              handleIncomingAttack(data.row, data.col);
                        } else if (data.type === 'attack_result') {
                              handleAttackResult(data);
                        } else if (data.type === 'game_over') {
                              handleGameOver(false); // Opponent won
                        } else if (data.type === 'battle_start') {
                              console.log('Received battle_start event');
                              // Both players are ready to battle
                              Alert.alert('Battle Started!', 'Both players are ready. The battle begins!');
                        } else if (data.type === 'ping' || data.type === 'pong') {
                              // Handle ping/pong internally in the connection class
                              return;
                        }

                        // Call the original handler
                        if (originalOnDataReceived) {
                              originalOnDataReceived(data);
                        }
                  };

                  // Set up AppState change listener for React Native
                  let appStateSubscription;
                  try {
                        appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
                              if (nextAppState === 'active' && connection && !gameOver) {
                                    console.log('App has come to the foreground, checking connection...');
                                    handleVisibilityChange();
                              }
                        });
                  } catch (error) {
                        console.error('Error setting up AppState listener:', error);
                        // Fallback for older React Native versions
                        AppState.addEventListener('change', (nextAppState) => {
                              if (nextAppState === 'active' && connection && !gameOver) {
                                    console.log('App has come to the foreground, checking connection...');
                                    handleVisibilityChange();
                              }
                        });
                  }

                  // Cleanup
                  return () => {
                        // Clean up the AppState subscription
                        try {
                              if (appStateSubscription?.remove) {
                                    appStateSubscription.remove();
                              } else if (AppState.removeEventListener) {
                                    // For older versions of React Native
                                    AppState.removeEventListener('change', (nextAppState) => {
                                          if (nextAppState === 'active' && connection && !gameOver) {
                                                handleVisibilityChange();
                                          }
                                    });
                              }
                        } catch (error) {
                              console.error('Error cleaning up AppState listener:', error);
                        }

                        if (connection) {
                              connection.onDataReceived = originalOnDataReceived;
                        }
                  };
            }
      }, [connection, gameOver, handleVisibilityChange]);

      // Handle visibility changes for React Native
      const handleVisibilityChange = useCallback(() => {
            if (connection && !gameOver) {
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
      }, [connection, gameOver, reconnecting, navigation]);

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
      }, [isMyTurn]);

      const handleCellPress = (row, col) => {
            // Can only attack on your turn and if game is not over or connection lost
            if (!isMyTurn || gameOver || connectionLost || reconnecting) return;

            // Can't attack a cell that's already been attacked
            if (opponentBoard[row][col].state === CELL_STATE.HIT || opponentBoard[row][col].state === CELL_STATE.MISS) {
                  return;
            }

            // Send attack to opponent
            if (connection) {
                  const sendSuccess = connection.sendGameData({
                        type: 'attack',
                        row,
                        col,
                  });

                  // If sending failed, show connection error
                  if (!sendSuccess) {
                        Alert.alert('Connection Issue', 'Unable to send your move. Checking connection...');
                        return;
                  }
            }

            // Temporarily disable turns until we get a response
            setIsMyTurn(false);
            setLastAttack({ row, col, board: 'opponent' });
      };

      const handleIncomingAttack = (row, col) => {
            // Process the attack on our board using functional update to avoid stale state
            setMyBoard((prevBoard) => {
                  const result = processAttack(prevBoard, row, col);
                  setLastAttack({ row, col, board: 'player' });

                  // Check if a ship was sunk
                  let sunkShipId = null;
                  if (result.hit && result.shipId) {
                        if (isShipSunk(result.board, result.shipId)) {
                              sunkShipId = result.shipId;
                              setSunkShips((prev) => ({
                                    ...prev,
                                    player: [...prev.player, result.shipId],
                              }));
                        }
                  }

                  // Send result back to opponent
                  if (connection) {
                        connection.sendGameData({
                              type: 'attack_result',
                              row,
                              col,
                              hit: result.hit,
                              shipId: result.shipId,
                              sunkShipId,
                        });
                  }

                  // Check if all ships are sunk (game over)
                  if (areAllShipsSunk(result.board)) {
                        if (connection) {
                              connection.sendGameData({
                                    type: 'game_over',
                              });
                        }
                        handleGameOver(false); // We lost
                  } else {
                        // It's our turn now
                        setIsMyTurn(true);
                  }

                  return result.board;
            });
      };

      const handleAttackResult = (data) => {
            const { row, col, hit, shipId, sunkShipId } = data;

            // Update opponent's board based on attack result using functional update
            setOpponentBoard((prevBoard) => {
                  const newBoard = [...prevBoard];
                  newBoard[row][col] = {
                        state: hit ? CELL_STATE.HIT : CELL_STATE.MISS,
                        ship: shipId,
                  };
                  return newBoard;
            });

            // Update sunk ships
            if (sunkShipId) {
                  setSunkShips((prev) => ({
                        ...prev,
                        opponent: [...prev.opponent, sunkShipId],
                  }));

                  // Show alert for sunk ship
                  const shipName = Object.values(SHIPS).find((ship) => ship.id === sunkShipId)?.name;
                  Alert.alert('Ship Sunk!', `You sunk the opponent's ${shipName}!`);
            }

            // Check if all ships are sunk (game over)
            if (sunkShips.opponent.length === Object.keys(SHIPS).length - 1 && sunkShipId) {
                  handleGameOver(true); // We won
            }
      };

      const handleGameOver = (didWin) => {
            setGameOver(true);
            setWinner(didWin ? 'player' : 'opponent');

            Alert.alert(didWin ? 'Victory!' : 'Defeat!', didWin ? 'You sunk all enemy ships!' : 'All your ships were sunk!', [
                  {
                        text: 'Return to Home',
                        onPress: () => navigation.navigate('Home'),
                  },
            ]);
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
      },
      gameOverText: {
            fontSize: 36,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 10,
      },
      gameOverSubText: {
            fontSize: 18,
            color: 'white',
            textAlign: 'center',
            marginBottom: 20,
            paddingHorizontal: 20,
      },
      newGameButton: {
            backgroundColor: '#15803d',
            paddingVertical: 15,
            paddingHorizontal: 30,
            borderRadius: 10,
      },
      newGameButtonText: {
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
      },
});

export default GameScreen;
