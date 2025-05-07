import React, { useEffect, useState } from 'react';
import { View, Text, Button, TextInput, StyleSheet, ScrollView } from 'react-native';
// Import socket.io-client directly
import io from 'socket.io-client';

const SocketTest = () => {
      const [socket, setSocket] = useState(null);
      const [connected, setConnected] = useState(false);
      const [gameCode, setGameCode] = useState('TEST123');
      const [logs, setLogs] = useState([]);

      const addLog = (message) => {
            console.log(message);
            setLogs((prevLogs) => [...prevLogs, `${new Date().toISOString().slice(11, 19)} - ${message}`]);
      };

      useEffect(() => {
            addLog('Initializing...');

            try {
                  // Connect to the deployed Socket.io server on Render.com
                  const socketUrl = 'https://battleships-expo-p2p.onrender.com';
                  addLog(`Socket URL: ${socketUrl}`);

                  // Use the exact same configuration that worked in our test script
                  const newSocket = io(socketUrl, {
                        transports: ['websocket', 'polling'],
                        reconnection: true,
                        forceNew: true,
                        timeout: 20000,
                  });

                  // Log the socket object
                  addLog(`Socket object created: ${!!newSocket}`);
                  addLog(`Socket ID: ${newSocket.id || 'not assigned yet'}`);
                  addLog(`Socket connected: ${newSocket.connected}`);
                  addLog(`Socket disconnected: ${newSocket.disconnected}`);

                  addLog(`Socket object created: ${!!newSocket}`);
                  setSocket(newSocket);

                  newSocket.on('connect', () => {
                        addLog(`Connected to server with ID: ${newSocket.id}`);
                        setConnected(true);
                  });

                  newSocket.on('connect_error', (error) => {
                        addLog(`Connection error: ${error.message}`);
                  });

                  newSocket.on('disconnect', (reason) => {
                        addLog(`Disconnected from server: ${reason}`);
                        setConnected(false);
                  });

                  newSocket.on('error', (error) => {
                        addLog(`Server error: ${error}`);
                  });

                  newSocket.on('game-created', (data) => {
                        addLog(`Game created: ${data.gameCode}`);
                  });

                  newSocket.on('game-joined', (data) => {
                        addLog(`Game joined: ${data.gameCode}`);
                  });

                  newSocket.on('game-ready', (data) => {
                        addLog(`Game ready: ${data.gameCode}`);
                  });

                  newSocket.on('opponent-disconnected', () => {
                        addLog('Opponent disconnected');
                  });

                  return () => {
                        if (newSocket) {
                              newSocket.disconnect();
                        }
                  };
            } catch (error) {
                  addLog(`Error initializing socket: ${error.message}`);
            }
      }, []);

      const createGame = () => {
            if (socket && connected) {
                  addLog(`Creating game with code: ${gameCode}`);
                  socket.emit('create-game', gameCode);
            } else {
                  addLog('Cannot create game: not connected');
            }
      };

      const joinGame = () => {
            if (socket && connected) {
                  addLog(`Joining game with code: ${gameCode}`);
                  socket.emit('join-game', gameCode);
            } else {
                  addLog('Cannot join game: not connected');
            }
      };

      return (
            <View style={styles.container}>
                  <Text style={styles.title}>Socket.io Test</Text>
                  <Text style={styles.status}>Status: {connected ? 'Connected' : 'Disconnected'}</Text>
                  <View style={styles.inputContainer}>
                        <TextInput
                              style={styles.input}
                              value={gameCode}
                              onChangeText={setGameCode}
                              placeholder='Game Code'
                        />
                        <View style={styles.buttonContainer}>
                              <Button
                                    title='Create Game'
                                    onPress={createGame}
                                    disabled={!connected}
                              />
                              <Button
                                    title='Join Game'
                                    onPress={joinGame}
                                    disabled={!connected}
                              />
                        </View>
                  </View>
                  <ScrollView style={styles.logContainer}>
                        {logs.map((log, index) => (
                              <Text
                                    key={index}
                                    style={styles.logText}
                              >
                                    {log}
                              </Text>
                        ))}
                  </ScrollView>
            </View>
      );
};

const styles = StyleSheet.create({
      container: {
            flex: 1,
            padding: 20,
            backgroundColor: '#f5f5f5',
      },
      title: {
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 10,
      },
      status: {
            fontSize: 18,
            marginBottom: 20,
      },
      inputContainer: {
            marginBottom: 20,
      },
      input: {
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 5,
            padding: 10,
            marginBottom: 10,
      },
      buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
      },
      logContainer: {
            flex: 1,
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 5,
            padding: 10,
            backgroundColor: '#fff',
      },
      logText: {
            fontSize: 14,
            marginBottom: 5,
      },
});

export default SocketTest;
