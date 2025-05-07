import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SocketConnection from '../utils/socketConnection';
import gameRoomController, { GAME_STATES } from '../controllers/GameRoomController';

const GameSetupScreen = ({ navigation, route }) => {
      const { gameCode, isHost } = route.params;
      const [status, setStatus] = useState(isHost ? 'waiting' : 'connecting');
      const [connection, setConnection] = useState(null);
      const [reconnecting, setReconnecting] = useState(false);

      useEffect(() => {
            console.log('Initializing game connection with code:', gameCode, 'isHost:', isHost);

            // Initialize the game connection
            const gameConnection = new SocketConnection(
                  gameCode,
                  isHost,
                  () => {
                        console.log('Connection established callback');
                        // Make sure we have the connection object set before calling the handler
                        if (gameConnection) {
                              handleConnectionEstablished();
                        } else {
                              console.error('gameConnection is null in established callback');

                              // Try to recover by creating a new connection after a delay
                              setTimeout(() => {
                                    if (!connection) {
                                          console.log('Attempting to recreate connection');
                                          const newConnection = new SocketConnection(
                                                gameCode,
                                                isHost,
                                                handleConnectionEstablished,
                                                handleDataReceived,
                                                handleDisconnect
                                          );
                                          setConnection(newConnection);
                                    }
                              }, 2000);
                        }
                  },
                  handleDataReceived,
                  handleDisconnect
            );

            // Set the connection in state
            setConnection(gameConnection);

            // Log the connection state
            console.log('Connection initialized:', gameConnection ? 'success' : 'failed');

            // Add event listener for visibility changes to handle tab focus/blur
            if (typeof document !== 'undefined') {
                  document.addEventListener('visibilitychange', handleVisibilityChange);
            }

            // Set a timeout to check if connection was established
            const connectionCheckTimeout = setTimeout(() => {
                  if (status === 'connecting' || status === 'waiting') {
                        console.log('Connection not established after timeout, attempting to reconnect');
                        if (gameConnection) {
                              gameConnection.disconnect();
                        }

                        // Create a new connection
                        const newConnection = new SocketConnection(
                              gameCode,
                              isHost,
                              handleConnectionEstablished,
                              handleDataReceived,
                              handleDisconnect
                        );
                        setConnection(newConnection);
                  }
            }, 15000);

            // Cleanup on unmount
            return () => {
                  if (typeof document !== 'undefined') {
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                  }

                  clearTimeout(connectionCheckTimeout);

                  if (gameConnection) {
                        console.log('Disconnecting game connection on cleanup');
                        gameConnection.disconnect();
                  }
            };
      }, [gameCode, isHost, status]);

      // Handle tab visibility changes
      const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && connection) {
                  console.log('Tab became visible, checking connection...');
                  // Send a ping to check if connection is still alive
                  const pingSuccess = connection.sendGameData({ type: 'ping', timestamp: Date.now() });

                  if (!pingSuccess && !reconnecting) {
                        setReconnecting(true);
                        setStatus(isHost ? 'reconnecting_host' : 'reconnecting_client');

                        // Give the connection a moment to attempt reconnection
                        setTimeout(() => {
                              setReconnecting(false);
                              // Check if we're still disconnected
                              if (connection && !connection.isConnected) {
                                    handleDisconnect();
                              }
                        }, 5000);
                  }
            }
      };

      // This function is now called from the useEffect with the gameConnection parameter
      const handleConnectionEstablished = () => {
            console.log('handleConnectionEstablished called, isHost:', isHost);

            // Update the status
            setStatus('connected');
            setReconnecting(false);

            // If we're not the host, send a ready message
            if (!isHost) {
                  // We're using the connection from state, which should be set by now
                  if (connection) {
                        console.log('Sending ready message to host using connection from state');

                        // Try sending the ready message multiple times to ensure it gets through
                        const sendReadyMessage = () => {
                              console.log('Sending ready message');

                              // Check if connection exists before sending
                              if (!connection) {
                                    console.error('Connection is null in sendReadyMessage');
                                    // Try again after a delay
                                    setTimeout(sendReadyMessage, 2000);
                                    return;
                              }

                              const success = connection.sendGameData({ type: 'ready' });

                              if (!success) {
                                    console.warn('Failed to send ready message, will retry');
                                    // Retry after a short delay
                                    setTimeout(sendReadyMessage, 2000);
                              }
                        };

                        // Start sending ready messages
                        sendReadyMessage();

                        // Also set a backup timer to retry a few times
                        let retryCount = 0;
                        const maxRetries = 10; // Increase max retries
                        const readyInterval = setInterval(() => {
                              if (retryCount >= maxRetries) {
                                    clearInterval(readyInterval);
                                    return;
                              }

                              if (status !== 'ready') {
                                    console.log(`Retry ${retryCount + 1}/${maxRetries} sending ready message`);

                                    // Check if connection exists before sending
                                    if (connection) {
                                          connection.sendGameData({ type: 'ready' });
                                    } else {
                                          console.error('Connection is null in retry interval');
                                    }

                                    retryCount++;
                              } else {
                                    clearInterval(readyInterval);
                              }
                        }, 3000); // Increase interval to 3 seconds
                  } else {
                        console.error('Connection is null in handleConnectionEstablished');

                        // Try to recover by setting a timeout to retry
                        setTimeout(() => {
                              if (connection) {
                                    console.log('Retrying to send ready message');
                                    connection.sendGameData({ type: 'ready' });
                              } else {
                                    console.error('Connection still null after retry');

                                    // Last resort - create a new connection
                                    Alert.alert(
                                          'Connection Issue',
                                          'There was a problem connecting to the game. Would you like to try again?',
                                          [
                                                {
                                                      text: 'Try Again',
                                                      onPress: () => {
                                                            // Restart the screen
                                                            navigation.replace('GameSetup', {
                                                                  gameCode,
                                                                  isHost,
                                                            });
                                                      },
                                                },
                                                {
                                                      text: 'Cancel',
                                                      onPress: () => navigation.navigate('Home'),
                                                      style: 'cancel',
                                                },
                                          ]
                                    );
                              }
                        }, 1000);
                  }
            }
      };

      const handleDataReceived = (data) => {
            if (data.type === 'ready' && isHost) {
                  setStatus('ready');
            } else if (data.type === 'start_game') {
                  console.log('Received start_game event, preparing to navigate to ShipPlacement...');

                  // Generate a unique client ID
                  const clientId = `client_${Date.now()}`;

                  // Initialize the game room controller
                  gameRoomController.initialize(connection, gameCode, isHost, clientId);

                  // Add a small delay before navigating to ensure the connection is stable
                  setTimeout(() => {
                        console.log('Navigating to ShipPlacement screen...');
                        navigation.navigate('ShipPlacement', {
                              gameCode,
                              isHost,
                              connection,
                              clientId,
                        });
                  }, 500);
            }
      };

      const handleDisconnect = () => {
            // Only show alert and navigate home if we're not already trying to reconnect
            if (!reconnecting) {
                  Alert.alert('Connection Lost', 'The connection to the other player was lost and could not be reestablished.', [
                        {
                              text: 'Return to Home',
                              onPress: () => navigation.navigate('Home'),
                        },
                  ]);
            }
      };

      const handleShareCode = async () => {
            try {
                  await Share.share({
                        message: `Join my Battleships game with code: ${gameCode}`,
                  });
            } catch (error) {
                  Alert.alert('Error', 'Could not share game code');
            }
      };

      const handleCopyCode = () => {
            Clipboard.setString(gameCode);
            Alert.alert('Copied!', 'Game code copied to clipboard');
      };

      const handleStartGame = () => {
            if (connection) {
                  // Generate a unique client ID
                  const clientId = `client_${Date.now()}`;

                  // Initialize the game room controller
                  gameRoomController.initialize(connection, gameCode, isHost, clientId);

                  // Send start_game message
                  connection.sendGameData({ type: 'start_game' });

                  // Navigate to ship placement screen
                  navigation.navigate('ShipPlacement', {
                        gameCode,
                        isHost,
                        connection,
                        clientId,
                  });
            }
      };

      const renderContent = () => {
            // Handle reconnection states for both host and client
            if (status === 'reconnecting_host' || status === 'reconnecting_client') {
                  return (
                        <View style={styles.statusContainer}>
                              <Text style={styles.gameCodeLabel}>RECONNECTING:</Text>
                              <View style={styles.gameCodeContainer}>
                                    <Text style={styles.gameCode}>{gameCode}</Text>
                              </View>
                              <View style={styles.codeButtonsContainer}>
                                    <TouchableOpacity
                                          style={[styles.codeButton, styles.copyButton]}
                                          onPress={handleCopyCode}
                                    >
                                          <Text style={styles.codeButtonText}>COPY CODE</Text>
                                    </TouchableOpacity>
                              </View>
                              <Text style={styles.waitingText}>Connection lost. Attempting to reconnect...</Text>
                              <ActivityIndicator
                                    size='large'
                                    color='#dc2626'
                                    style={styles.spinner}
                              />
                              <TouchableOpacity
                                    style={[styles.shareButton, { backgroundColor: '#dc2626', marginTop: 20 }]}
                                    onPress={() => navigation.navigate('Home')}
                              >
                                    <Text style={styles.shareButtonText}>CANCEL</Text>
                              </TouchableOpacity>
                        </View>
                  );
            }

            if (isHost) {
                  if (status === 'waiting') {
                        return (
                              <View style={styles.statusContainer}>
                                    <Text style={styles.gameCodeLabel}>GAME CODE:</Text>
                                    <View style={styles.gameCodeContainer}>
                                          <Text style={styles.gameCode}>{gameCode}</Text>
                                    </View>
                                    <View style={styles.codeButtonsContainer}>
                                          <TouchableOpacity
                                                style={[styles.codeButton, styles.copyButton]}
                                                onPress={handleCopyCode}
                                          >
                                                <Text style={styles.codeButtonText}>COPY CODE</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                                style={[styles.codeButton, styles.shareButton]}
                                                onPress={handleShareCode}
                                          >
                                                <Text style={styles.codeButtonText}>SHARE CODE</Text>
                                          </TouchableOpacity>
                                    </View>
                                    <Text style={styles.waitingText}>Waiting for opponent to join...</Text>
                                    <ActivityIndicator
                                          size='large'
                                          color='#1e3a8a'
                                          style={styles.spinner}
                                    />
                              </View>
                        );
                  } else if (status === 'connected' || status === 'ready') {
                        return (
                              <View style={styles.statusContainer}>
                                    <Text style={styles.connectedText}>Opponent connected!</Text>
                                    <View style={styles.gameCodeContainer}>
                                          <Text style={styles.gameCode}>{gameCode}</Text>
                                    </View>
                                    <View style={styles.codeButtonsContainer}>
                                          <TouchableOpacity
                                                style={[styles.codeButton, styles.copyButton]}
                                                onPress={handleCopyCode}
                                          >
                                                <Text style={styles.codeButtonText}>COPY CODE</Text>
                                          </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                          style={styles.startButton}
                                          onPress={handleStartGame}
                                    >
                                          <Text style={styles.startButtonText}>START GAME</Text>
                                    </TouchableOpacity>
                              </View>
                        );
                  }
            } else {
                  if (status === 'connecting') {
                        return (
                              <View style={styles.statusContainer}>
                                    <Text style={styles.gameCodeLabel}>JOINING GAME:</Text>
                                    <View style={styles.gameCodeContainer}>
                                          <Text style={styles.gameCode}>{gameCode}</Text>
                                    </View>
                                    <View style={styles.codeButtonsContainer}>
                                          <TouchableOpacity
                                                style={[styles.codeButton, styles.copyButton]}
                                                onPress={handleCopyCode}
                                          >
                                                <Text style={styles.codeButtonText}>COPY CODE</Text>
                                          </TouchableOpacity>
                                    </View>
                                    <Text style={styles.waitingText}>Connecting to host...</Text>
                                    <ActivityIndicator
                                          size='large'
                                          color='#1e3a8a'
                                          style={styles.spinner}
                                    />
                              </View>
                        );
                  } else if (status === 'connected') {
                        return (
                              <View style={styles.statusContainer}>
                                    <Text style={styles.connectedText}>Connected to host!</Text>
                                    <View style={styles.gameCodeContainer}>
                                          <Text style={styles.gameCode}>{gameCode}</Text>
                                    </View>
                                    <View style={styles.codeButtonsContainer}>
                                          <TouchableOpacity
                                                style={[styles.codeButton, styles.copyButton]}
                                                onPress={handleCopyCode}
                                          >
                                                <Text style={styles.codeButtonText}>COPY CODE</Text>
                                          </TouchableOpacity>
                                    </View>
                                    <Text style={styles.waitingText}>Waiting for host to start the game...</Text>
                                    <ActivityIndicator
                                          size='large'
                                          color='#1e3a8a'
                                          style={styles.spinner}
                                    />
                              </View>
                        );
                  }
            }

            // Fallback for any other state
            return (
                  <View style={styles.statusContainer}>
                        <Text style={styles.waitingText}>Connecting...</Text>
                        <ActivityIndicator
                              size='large'
                              color='#1e3a8a'
                              style={styles.spinner}
                        />
                  </View>
            );
      };

      return (
            <SafeAreaView style={styles.container}>
                  <View style={styles.header}>
                        <TouchableOpacity
                              style={styles.backButton}
                              onPress={() => {
                                    if (connection) connection.disconnect();
                                    navigation.goBack();
                              }}
                        >
                              <Text style={styles.backButtonText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{isHost ? 'HOST GAME' : 'JOIN GAME'}</Text>
                        <View style={styles.placeholder} />
                  </View>

                  {renderContent()}
            </SafeAreaView>
      );
};

const styles = StyleSheet.create({
      container: {
            flex: 1,
            backgroundColor: '#f0f8ff',
      },
      header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#ddd',
      },
      backButton: {
            padding: 8,
      },
      backButtonText: {
            fontSize: 16,
            color: '#1e3a8a',
            fontWeight: '500',
      },
      headerTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: '#1e3a8a',
      },
      placeholder: {
            width: 50,
      },
      statusContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
      },
      gameCodeLabel: {
            fontSize: 18,
            color: '#555',
            marginBottom: 10,
      },
      gameCodeContainer: {
            backgroundColor: 'white',
            borderRadius: 10,
            padding: 15,
            minWidth: 200,
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#1e3a8a',
            marginBottom: 20,
      },
      gameCode: {
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1e3a8a',
            letterSpacing: 5,
      },
      codeButtonsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 300,
            marginBottom: 30,
      },
      codeButton: {
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 8,
            flex: 1,
            marginHorizontal: 5,
            alignItems: 'center',
      },
      copyButton: {
            backgroundColor: '#15803d',
      },
      shareButton: {
            backgroundColor: '#2563eb',
      },
      codeButtonText: {
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
      },
      shareButtonText: {
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
      },
      waitingText: {
            fontSize: 18,
            color: '#555',
            textAlign: 'center',
            marginBottom: 20,
      },
      spinner: {
            marginTop: 20,
      },
      connectedText: {
            fontSize: 24,
            fontWeight: 'bold',
            color: '#15803d',
            marginBottom: 30,
      },
      startButton: {
            backgroundColor: '#15803d',
            paddingVertical: 15,
            paddingHorizontal: 30,
            borderRadius: 10,
      },
      startButtonText: {
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
      },
});

export default GameSetupScreen;
