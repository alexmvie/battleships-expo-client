import React, { useState, useEffect } from 'react';
import {
      View,
      Text,
      StyleSheet,
      TouchableOpacity,
      Image,
      TextInput,
      KeyboardAvoidingView,
      Platform,
      Alert,
      Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import gameRoomController from '../controllers/GameRoomController';
import { APP_VERSION, SERVER_URL } from '../config/appConfig';

const HomeScreen = ({ navigation }) => {
      const [gameCode, setGameCode] = useState('');

      const handleHostGame = () => {
            // Generate a random 6-character game code
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            navigation.navigate('GameSetup', { gameCode: randomCode, isHost: true });
      };

      const handleJoinGame = () => {
            if (!gameCode.trim()) {
                  Alert.alert('Error', 'Please enter a game code');
                  return;
            }

            navigation.navigate('GameSetup', { gameCode: gameCode.toUpperCase(), isHost: false });
      };

      const handlePasteCode = async () => {
            try {
                  const clipboardContent = await Clipboard.getString();
                  if (clipboardContent) {
                        // Extract only alphanumeric characters and limit to 6 characters
                        const cleanCode = clipboardContent
                              .replace(/[^A-Za-z0-9]/g, '')
                              .substring(0, 6)
                              .toUpperCase();
                        setGameCode(cleanCode);
                  }
            } catch (error) {
                  console.error('Failed to paste from clipboard:', error);
            }
      };

      return (
            <SafeAreaView style={styles.container}>
                  <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardAvoidingView}
                  >
                        <View style={styles.content}>
                              <Text style={styles.title}>BATTLESHIPS</Text>

                              <View style={styles.serverIndicator}>
                                    <Text style={styles.serverIndicatorText}>
                                          Connected to: <Text style={styles.serverUrl}>{SERVER_URL.replace('https://', '')}</Text>
                                    </Text>
                                    <Text style={styles.versionText}>v{APP_VERSION}</Text>
                              </View>

                              <View style={styles.logoContainer}>
                                    {/* Placeholder for logo - replace with actual image */}
                                    <View style={styles.logoPlaceholder}>
                                          <Text style={styles.logoText}>⚓</Text>
                                    </View>
                              </View>

                              <View style={styles.buttonsContainer}>
                                    <TouchableOpacity
                                          style={[styles.button, styles.hostButton]}
                                          onPress={handleHostGame}
                                    >
                                          <Text style={styles.buttonText}>HOST GAME</Text>
                                    </TouchableOpacity>

                                    <View style={styles.joinContainer}>
                                          <View style={styles.inputContainer}>
                                                <TextInput
                                                      style={styles.input}
                                                      placeholder='Enter Game Code'
                                                      placeholderTextColor='#888'
                                                      value={gameCode}
                                                      onChangeText={setGameCode}
                                                      autoCapitalize='characters'
                                                      maxLength={6}
                                                />
                                                <TouchableOpacity
                                                      style={styles.pasteButton}
                                                      onPress={handlePasteCode}
                                                >
                                                      <Text style={styles.pasteButtonText}>PASTE</Text>
                                                </TouchableOpacity>
                                          </View>

                                          <TouchableOpacity
                                                style={[styles.button, styles.joinButton]}
                                                onPress={handleJoinGame}
                                          >
                                                <Text style={styles.buttonText}>JOIN GAME</Text>
                                          </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                          style={[styles.button, { backgroundColor: '#dc2626' }]}
                                          onPress={() => navigation.navigate('SocketTest')}
                                    >
                                          <Text style={styles.buttonText}>TEST SOCKET</Text>
                                    </TouchableOpacity>
                              </View>
                        </View>
                  </KeyboardAvoidingView>
            </SafeAreaView>
      );
};

const styles = StyleSheet.create({
      container: {
            flex: 1,
            backgroundColor: '#f0f8ff',
      },
      keyboardAvoidingView: {
            flex: 1,
      },
      content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
      },
      title: {
            fontSize: 36,
            fontWeight: 'bold',
            color: '#1e3a8a',
            marginBottom: 40,
            textAlign: 'center',
      },
      logoContainer: {
            marginBottom: 60,
      },
      logoPlaceholder: {
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: '#1e3a8a',
            justifyContent: 'center',
            alignItems: 'center',
      },
      logoText: {
            fontSize: 80,
            color: 'white',
      },
      serverIndicator: {
            backgroundColor: '#15803d',
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            marginBottom: 20,
      },
      serverIndicatorText: {
            color: 'white',
            fontSize: 14,
            textAlign: 'center',
      },
      serverUrl: {
            fontWeight: 'bold',
      },
      versionText: {
            color: 'white',
            fontSize: 12,
            marginTop: 4,
            textAlign: 'center',
      },
      buttonsContainer: {
            width: '100%',
            maxWidth: 300,
      },
      button: {
            paddingVertical: 15,
            borderRadius: 10,
            alignItems: 'center',
            marginVertical: 10,
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
      },
      hostButton: {
            backgroundColor: '#1e3a8a',
      },
      joinButton: {
            backgroundColor: '#2563eb',
      },
      buttonText: {
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
      },
      joinContainer: {
            marginTop: 20,
      },
      inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
      },
      input: {
            backgroundColor: 'white',
            borderRadius: 10,
            padding: 15,
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#ddd',
            flex: 1,
      },
      pasteButton: {
            backgroundColor: '#15803d',
            paddingVertical: 15,
            paddingHorizontal: 10,
            borderRadius: 10,
            marginLeft: 10,
      },
      pasteButtonText: {
            color: 'white',
            fontSize: 14,
            fontWeight: 'bold',
      },
});

export default HomeScreen;
